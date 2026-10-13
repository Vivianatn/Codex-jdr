import { toast } from 'sonner'
import { create } from 'zustand'
import { accountDbName, CodexDB, setActiveDb } from '@/db/db'
import { getMessages } from '@/i18n'
import { useCampaignStore } from '@/stores/campaignStore'
import { useRollStore } from '@/stores/rollStore'
import type { AccountSummary } from './accounts'
import { wipe } from './crypto'

/**
 * The unlocked account (D-241). The data key lives only in memory, here and in
 * the database middleware: never in localStorage, sessionStorage or IndexedDB.
 * Reloading the page or locking forgets it.
 */

export type SessionStatus = 'locked' | 'unlocking' | 'unlocked'

interface SessionState {
  status: SessionStatus
  account: AccountSummary | null
  /** Players' window: unlocked by the GM window, and locked with it. */
  delegated: boolean
}

export const useSessionStore = create<SessionState>()(() => ({
  status: 'locked',
  account: null,
  delegated: false,
}))

let currentKey: Uint8Array | null = null
/** The account's own database, kept open while a guest works on a remote copy. */
let accountDb: CodexDB | null = null

const onLockListeners = new Set<() => void>()

/** Called when the GM locks (not the players' window). Returns the unsubscribe. */
export function onLock(listener: () => void): () => void {
  onLockListeners.add(listener)
  return () => onLockListeners.delete(listener)
}

/** Data key of the open session, for the players' window hand-off only. */
export function sessionKey(): Uint8Array | null {
  return currentKey
}

function reportCorrupt() {
  toast.error(getMessages().account.corruptRecord, { id: 'codex-corrupt-record' })
}

/** Opens the account's encrypted database and makes it the active one. Takes ownership of `key`. */
export async function startSession(
  account: AccountSummary,
  key: Uint8Array,
  { delegated = false }: { delegated?: boolean } = {},
): Promise<CodexDB> {
  const db = new CodexDB(accountDbName(account.id), { key, onCorrupt: reportCorrupt })
  await db.open()
  setActiveDb(db)
  accountDb = db
  void deleteStaleCopies()
  if (currentKey && currentKey !== key) wipe(currentKey)
  currentKey = key
  // Ask the browser not to evict the data under storage pressure.
  void navigator.storage?.persist?.().catch(() => false)
  if (import.meta.env.DEV) (window as unknown as { __codexDb?: CodexDB }).__codexDb = db
  useSessionStore.setState({ status: 'unlocked', account, delegated })
  return db
}

export function updateSessionAccount(patch: Partial<AccountSummary>): void {
  const { account } = useSessionStore.getState()
  if (account) useSessionStore.setState({ account: { ...account, ...patch } })
}

/** Saves what is pending, forgets every decrypted copy and the key. */
export async function lockSession(): Promise<void> {
  const { status, delegated } = useSessionStore.getState()
  if (status !== 'unlocked') return
  if (!delegated) onLockListeners.forEach((listener) => listener())
  try {
    await useCampaignStore.getState().unload()
  } finally {
    useRollStore.setState({ campaignId: null, rolls: [] })
    setActiveDb(null)
    accountDb?.close()
    accountDb = null
    wipe(currentKey)
    currentKey = null
    if (import.meta.env.DEV) delete (window as unknown as { __codexDb?: CodexDB }).__codexDb
    useSessionStore.setState({ status: 'locked', account: null, delegated: false })
  }
}

/** The account's own database, even while a player works on a game's copy (D-262). */
export function accountDatabase(): CodexDB {
  if (!accountDb) throw new Error('No account is unlocked')
  return accountDb
}

/** Prefix of the temporary databases holding a joined campaign (D-245). */
export const REMOTE_DB_PREFIX = 'codex-remote-'

/** Guest: works on the copy of the host's campaign; the account database stays open. */
export function enterRemoteDb(copy: CodexDB): void {
  setActiveDb(copy, { keepPrevious: true })
  if (import.meta.env.DEV) (window as unknown as { __codexDb?: CodexDB }).__codexDb = copy
}

/** Guest leaving: back to the account database (the copy is closed). */
export function leaveRemoteDb(): void {
  if (!accountDb) return
  setActiveDb(accountDb)
  if (import.meta.env.DEV) (window as unknown as { __codexDb?: CodexDB }).__codexDb = accountDb
}

/** Copies left behind by a crash or a closed tab are deleted at the next unlock. */
async function deleteStaleCopies(): Promise<void> {
  try {
    const all = (await indexedDB.databases?.()) ?? []
    for (const { name } of all)
      if (name?.startsWith(REMOTE_DB_PREFIX)) indexedDB.deleteDatabase(name)
  } catch {
    // Listing databases is not available everywhere: the copies then stay until erased.
  }
}
