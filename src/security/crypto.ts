import { xchacha20poly1305 } from '@noble/ciphers/chacha.js'

/**
 * Cryptographic primitives of Codex (D-241, docs/SECURITE.md).
 *
 * - Data key: 256 random bits, generated once per account, never stored in clear.
 * - Records and wrapped keys: XChaCha20-Poly1305 (authenticated, 192-bit random
 *   nonce, so random nonces never collide in practice). It is synchronous, which
 *   lets the database encrypt inside IndexedDB transactions.
 * - Passwords: PBKDF2-HMAC-SHA-256 through WebCrypto, 600 000 iterations
 *   (OWASP 2023), 128-bit random salt per secret.
 */

export const KEY_BYTES = 32
const NONCE_BYTES = 24
const SALT_BYTES = 16

/** OWASP Password Storage Cheat Sheet (2023) for PBKDF2-HMAC-SHA-256. */
export const DEFAULT_ITERATIONS = 600_000

export interface KdfParams {
  algorithm: 'PBKDF2-SHA-256'
  iterations: number
  /** Base64. */
  salt: string
}

export class DecryptionError extends Error {
  constructor() {
    super('Decryption failed: wrong key or tampered data')
    this.name = 'DecryptionError'
  }
}

export function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(length)
  // getRandomValues fills at most 65 536 bytes per call.
  for (let i = 0; i < length; i += 65_536) crypto.getRandomValues(out.subarray(i, i + 65_536))
  return out
}

export function newKdfParams(iterations = DEFAULT_ITERATIONS): KdfParams {
  return { algorithm: 'PBKDF2-SHA-256', iterations, salt: toBase64(randomBytes(SALT_BYTES)) }
}

/** Derives a 256-bit key from a secret (password or recovery code). */
export async function deriveKey(secret: string, params: KdfParams): Promise<Uint8Array> {
  if (params.algorithm !== 'PBKDF2-SHA-256') throw new Error(`Unknown KDF ${params.algorithm}`)
  const material = await crypto.subtle.importKey(
    'raw',
    utf8(secret.normalize('NFKC')),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: fromBase64(params.salt),
      iterations: params.iterations,
    },
    material,
    KEY_BYTES * 8,
  )
  return new Uint8Array(bits)
}

/** Encrypts and authenticates `plaintext` (and `aad`, which is not stored). Output: nonce ‖ ciphertext ‖ tag. */
export function seal(key: Uint8Array, plaintext: Uint8Array, aad?: Uint8Array): Uint8Array {
  const nonce = randomBytes(NONCE_BYTES)
  const sealed = xchacha20poly1305(key, nonce, aad).encrypt(plaintext)
  const out = new Uint8Array(NONCE_BYTES + sealed.length)
  out.set(nonce)
  out.set(sealed, NONCE_BYTES)
  return out
}

/** Reverses `seal`; throws `DecryptionError` on a wrong key, a wrong `aad` or any altered byte. */
export function unseal(key: Uint8Array, sealed: Uint8Array, aad?: Uint8Array): Uint8Array {
  if (!(sealed instanceof Uint8Array) || sealed.length < NONCE_BYTES + 16)
    throw new DecryptionError()
  try {
    return xchacha20poly1305(key, sealed.subarray(0, NONCE_BYTES), aad).decrypt(
      sealed.subarray(NONCE_BYTES),
    )
  } catch {
    throw new DecryptionError()
  }
}

/** Overwrites key material that is no longer needed. */
export function wipe(...arrays: (Uint8Array | null | undefined)[]): void {
  for (const a of arrays) a?.fill(0)
}

const encoder = new TextEncoder()
const decoder = new TextDecoder('utf-8', { fatal: true })

export function utf8(text: string): Uint8Array<ArrayBuffer> {
  return encoder.encode(text)
}

export function fromUtf8(bytes: Uint8Array): string {
  return decoder.decode(bytes)
}

export function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}

export function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

// Crockford base32: no I, L, O, U — easy to read back from paper.
const RECOVERY_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/** 160-bit recovery code, written as 8 groups of 4 characters. */
export function newRecoveryCode(): string {
  const bytes = randomBytes(20)
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += RECOVERY_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  wipe(bytes)
  return out.match(/.{4}/g)!.join('-')
}

/** Accepts lowercase, spaces, missing dashes and look-alike letters (O→0, I/L→1). */
export function normalizeRecoveryCode(input: string): string {
  const clean = input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
  return (clean.match(/.{1,4}/g) ?? []).join('-')
}
