import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto'

/**
 * Passwords, session tokens and records at rest (D-262).
 *
 * - Passwords: scrypt (N = 2^15, r = 8, p = 1, OWASP), 16-byte random salt.
 * - Tokens (sessions, password resets): 32 random bytes; only their SHA-256 is
 *   stored, so a copy of the database opens no session.
 * - Records: AES-256-GCM with the server's data key, bound to their table, id
 *   and campaign (a record cannot be moved to another place in the database).
 */

const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }
const KEY_LENGTH = 32

function derive(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, options, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  )
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await derive(password, salt, SCRYPT)
  return [
    'scrypt',
    SCRYPT.N,
    SCRYPT.r,
    SCRYPT.p,
    salt.toString('base64'),
    hash.toString('base64'),
  ].join('$')
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, n, r, p, salt, hash] = stored.split('$')
  if (algorithm !== 'scrypt' || !salt || !hash) return false
  const expected = Buffer.from(hash, 'base64')
  const actual = await derive(password, Buffer.from(salt, 'base64'), {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: SCRYPT.maxmem,
  })
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

/** A password hash to compare against when the account does not exist (same timing). */
let dummyHash: Promise<string> | null = null
export function dummyPasswordHash(): Promise<string> {
  dummyHash ??= hashPassword('codex-dummy-password-for-timing')
  return dummyHash
}

export function newToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Short code for invitation links (URL-safe, ~72 bits). */
export function newInviteCode(): string {
  return randomBytes(9).toString('base64url')
}

export interface RecordCipher {
  seal(value: unknown, aad: string): Buffer
  open(sealed: Uint8Array, aad: string): unknown
}

export function recordCipher(key: Buffer): RecordCipher {
  if (key.length !== 32) throw new Error('CODEX_DATA_KEY must be 32 bytes (64 hex characters)')
  return {
    seal(value, aad) {
      const iv = randomBytes(12)
      const cipher = createCipheriv('aes-256-gcm', key, iv)
      cipher.setAAD(Buffer.from(aad))
      const body = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
      return Buffer.concat([iv, cipher.getAuthTag(), body])
    },
    open(sealed, aad) {
      const bytes = Buffer.from(sealed)
      const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12))
      decipher.setAAD(Buffer.from(aad))
      decipher.setAuthTag(bytes.subarray(12, 28))
      const text = Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()])
      return JSON.parse(text.toString('utf8'))
    },
  }
}
