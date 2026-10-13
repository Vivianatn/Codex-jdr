import Dexie, { type EntityTable } from 'dexie'
import { accountDbName, CodexDB, LEGACY_DB_NAME } from '@/db/db'
import {
  DecryptionError,
  DEFAULT_ITERATIONS,
  deriveKey,
  fromBase64,
  KEY_BYTES,
  newKdfParams,
  newRecoveryCode,
  normalizeRecoveryCode,
  randomBytes,
  seal,
  toBase64,
  unseal,
  utf8,
  wipe,
  type KdfParams,
} from './crypto'
import { checkPassword, checkUsername, usernameKey, type PasswordProblem } from './passwords'

/**
 * Local accounts (D-241). There is no server: an account is a name, a password
 * and its own encrypted database on this device. The password never leaves
 * memory and is never stored; it unwraps the account's data key.
 */

/** Minutes without activity before Codex locks itself; 0 = never. */
export type AutoLockMinutes = 0 | 5 | 15 | 30 | 60
export const AUTO_LOCK_CHOICES: AutoLockMinutes[] = [5, 15, 30, 60, 0]
export const DEFAULT_AUTO_LOCK: AutoLockMinutes = 15

/** Failed attempts allowed before waiting, then the wait doubles up to the maximum. */
export const FREE_ATTEMPTS = 5
const FIRST_DELAY_MS = 30_000
const MAX_DELAY_MS = 15 * 60_000

interface WrappedKey {
  kdf: KdfParams
  /** Base64 of the data key sealed with the key derived from the secret. */
  sealed: string
}

export interface AccountRecord {
  id: string
  username: string
  usernameKey: string
  createdAt: number
  lastLoginAt: number | null
  password: WrappedKey
  recovery: WrappedKey
  failedAttempts: number
  lockedUntil: number
  autoLockMinutes: AutoLockMinutes
}

export type AccountSummary = Pick<
  AccountRecord,
  'id' | 'username' | 'createdAt' | 'lastLoginAt' | 'autoLockMinutes'
>

export type AccountErrorCode =
  | 'notFound'
  | 'usernameTaken'
  | 'usernameInvalid'
  | PasswordProblem
  | 'wrongPassword'
  | 'wrongRecoveryCode'
  | 'throttled'

export class AccountError extends Error {
  constructor(
    readonly code: AccountErrorCode,
    /** For `throttled`: when the next attempt is allowed (ms since epoch). */
    readonly retryAt?: number,
  ) {
    super(`Account error: ${code}`)
    this.name = 'AccountError'
  }
}

class AccountsDB extends Dexie {
  accounts!: EntityTable<AccountRecord, 'id'>
  constructor(name: string) {
    super(name)
    this.version(1).stores({ accounts: 'id, &usernameKey' })
  }
}

export const ACCOUNTS_DB_NAME = 'codex-accounts'

export interface Unlocked {
  account: AccountSummary
  /** Data key of the account. The session owns it and wipes it on lock. */
  key: Uint8Array
}

export function summarize(record: AccountRecord): AccountSummary {
  const { id, username, createdAt, lastLoginAt, autoLockMinutes } = record
  return { id, username, createdAt, lastLoginAt, autoLockMinutes }
}

function aad(accountId: string, purpose: 'password' | 'recovery') {
  return utf8(`codex-data-key|${accountId}|${purpose}`)
}

async function wrap(
  key: Uint8Array,
  secret: string,
  accountId: string,
  purpose: 'password' | 'recovery',
  iterations: number,
): Promise<WrappedKey> {
  const kdf = newKdfParams(iterations)
  const kek = await deriveKey(secret, kdf)
  try {
    return { kdf, sealed: toBase64(seal(kek, key, aad(accountId, purpose))) }
  } finally {
    wipe(kek)
  }
}

/** Both wraps at once: WebCrypto runs the two PBKDF2 derivations in parallel. */
async function wrapBoth(
  key: Uint8Array,
  secrets: { password: string; recovery: string },
  accountId: string,
  iterations: number,
): Promise<{ password: WrappedKey; recovery: WrappedKey }> {
  const [password, recovery] = await Promise.all([
    wrap(key, secrets.password, accountId, 'password', iterations),
    wrap(key, secrets.recovery, accountId, 'recovery', iterations),
  ])
  return { password, recovery }
}

async function unwrap(
  wrapped: WrappedKey,
  secret: string,
  accountId: string,
  purpose: 'password' | 'recovery',
): Promise<Uint8Array | null> {
  const kek = await deriveKey(secret, wrapped.kdf)
  try {
    const key = unseal(kek, fromBase64(wrapped.sealed), aad(accountId, purpose))
    return key.length === KEY_BYTES ? key : null
  } catch (error) {
    if (error instanceof DecryptionError) return null
    throw error
  } finally {
    wipe(kek)
  }
}

export function createAccountService(
  options: { name?: string; iterations?: number; now?: () => number } = {},
) {
  const registry = new AccountsDB(options.name ?? ACCOUNTS_DB_NAME)
  const iterations = options.iterations ?? DEFAULT_ITERATIONS
  const now = options.now ?? Date.now

  async function find(accountId: string): Promise<AccountRecord> {
    const record = await registry.accounts.get(accountId)
    if (!record) throw new AccountError('notFound')
    return record
  }

  /** Throws `throttled` while the account must wait after too many failures. */
  function assertNotThrottled(record: AccountRecord) {
    if (record.lockedUntil > now()) throw new AccountError('throttled', record.lockedUntil)
  }

  async function registerFailure(record: AccountRecord, code: AccountErrorCode): Promise<never> {
    const failedAttempts = record.failedAttempts + 1
    const extra = failedAttempts - FREE_ATTEMPTS
    const lockedUntil = extra >= 0 ? now() + Math.min(MAX_DELAY_MS, FIRST_DELAY_MS * 2 ** extra) : 0
    await registry.accounts.update(record.id, { failedAttempts, lockedUntil })
    throw new AccountError(code, lockedUntil || undefined)
  }

  /** Re-authentication before sensitive actions; counts toward the throttling. */
  async function verifyPassword(accountId: string, password: string): Promise<Uint8Array> {
    const record = await find(accountId)
    assertNotThrottled(record)
    const key = await unwrap(record.password, password, record.id, 'password')
    if (!key) return registerFailure(record, 'wrongPassword')
    await registry.accounts.update(record.id, { failedAttempts: 0, lockedUntil: 0 })
    return key
  }

  return {
    registry,

    async list(): Promise<AccountSummary[]> {
      const all = await registry.accounts.toArray()
      return all
        .sort((a, b) => (b.lastLoginAt ?? b.createdAt) - (a.lastLoginAt ?? a.createdAt))
        .map(summarize)
    },

    /** Creates the account and its encrypted database. Show `recoveryCode` once. */
    async create(input: {
      username: string
      password: string
    }): Promise<Unlocked & { recoveryCode: string }> {
      const username = input.username.trim().replace(/\s+/g, ' ')
      if (checkUsername(username)) throw new AccountError('usernameInvalid')
      const problem = checkPassword(input.password, username)
      if (problem) throw new AccountError(problem)
      const nameKey = usernameKey(username)
      if (await registry.accounts.where('usernameKey').equals(nameKey).count())
        throw new AccountError('usernameTaken')

      const id = crypto.randomUUID()
      const key = randomBytes(KEY_BYTES)
      const recoveryCode = newRecoveryCode()
      const record: AccountRecord = {
        id,
        username,
        usernameKey: nameKey,
        createdAt: now(),
        lastLoginAt: now(),
        ...(await wrapBoth(
          key,
          { password: input.password, recovery: recoveryCode },
          id,
          iterations,
        )),
        failedAttempts: 0,
        lockedUntil: 0,
        autoLockMinutes: DEFAULT_AUTO_LOCK,
      }
      await registry.accounts.add(record)
      return { account: summarize(record), key, recoveryCode }
    },

    async unlock(accountId: string, password: string): Promise<Unlocked> {
      const key = await verifyPassword(accountId, password)
      await registry.accounts.update(accountId, { lastLoginAt: now() })
      return { account: summarize(await find(accountId)), key }
    },

    /** Forgotten password: the recovery code sets a new password, and is replaced. */
    async recover(
      accountId: string,
      code: string,
      newPassword: string,
    ): Promise<Unlocked & { recoveryCode: string }> {
      const record = await find(accountId)
      const problem = checkPassword(newPassword, record.username)
      if (problem) throw new AccountError(problem)
      assertNotThrottled(record)
      const key = await unwrap(record.recovery, normalizeRecoveryCode(code), record.id, 'recovery')
      if (!key) return registerFailure(record, 'wrongRecoveryCode')
      const recoveryCode = newRecoveryCode()
      await registry.accounts.update(record.id, {
        ...(await wrapBoth(
          key,
          { password: newPassword, recovery: recoveryCode },
          record.id,
          iterations,
        )),
        failedAttempts: 0,
        lockedUntil: 0,
        lastLoginAt: now(),
      })
      return { account: summarize(await find(accountId)), key, recoveryCode }
    },

    async changePassword(accountId: string, current: string, next: string): Promise<void> {
      const record = await find(accountId)
      const problem = checkPassword(next, record.username)
      if (problem) throw new AccountError(problem)
      const key = await verifyPassword(accountId, current)
      try {
        await registry.accounts.update(accountId, {
          password: await wrap(key, next, accountId, 'password', iterations),
        })
      } finally {
        wipe(key)
      }
    },

    /** New recovery code (the previous one stops working). */
    async renewRecoveryCode(accountId: string, password: string): Promise<string> {
      const key = await verifyPassword(accountId, password)
      const recoveryCode = newRecoveryCode()
      try {
        await registry.accounts.update(accountId, {
          recovery: await wrap(key, recoveryCode, accountId, 'recovery', iterations),
        })
      } finally {
        wipe(key)
      }
      return recoveryCode
    },

    /** Re-authentication only (throttled like a login). */
    async verify(accountId: string, password: string): Promise<void> {
      wipe(await verifyPassword(accountId, password))
    },

    async setAutoLock(accountId: string, minutes: AutoLockMinutes): Promise<void> {
      await registry.accounts.update(accountId, { autoLockMinutes: minutes })
    },

    /** Deletes the account and its whole database (right to erasure). */
    async remove(accountId: string, password: string): Promise<void> {
      wipe(await verifyPassword(accountId, password))
      await Dexie.delete(accountDbName(accountId))
      await registry.accounts.delete(accountId)
    },
  }
}

export type AccountService = ReturnType<typeof createAccountService>

export const accounts = createAccountService()

/** Campaigns saved before accounts existed (unencrypted), waiting for the first account. */
export async function legacyCampaignCount(name = LEGACY_DB_NAME): Promise<number> {
  if (!(await Dexie.exists(name))) return 0
  const legacy = new CodexDB(name)
  try {
    return await legacy.campaigns.count()
  } finally {
    legacy.close()
  }
}

/**
 * Moves the unencrypted data of the single-user versions into `target` (encrypted),
 * then deletes it. On any failure nothing is deleted. Returns the campaigns moved.
 */
export async function migrateLegacyData(target: CodexDB, name = LEGACY_DB_NAME): Promise<number> {
  if (!(await Dexie.exists(name))) return 0
  const legacy = new CodexDB(name)
  try {
    const tables = target.tables.filter((t) => t.name !== 'backups')
    const rows = new Map<string, unknown[]>()
    for (const table of tables) rows.set(table.name, await legacy.table(table.name).toArray())
    await target.transaction('rw', tables, async () => {
      for (const table of tables) await table.bulkPut(rows.get(table.name)!)
    })
    const count = rows.get('campaigns')!.length
    legacy.close()
    await Dexie.delete(name)
    return count
  } finally {
    legacy.close()
  }
}
