import { describe, expect, it } from 'vitest'
import {
  DecryptionError,
  deriveKey,
  fromBase64,
  newKdfParams,
  newRecoveryCode,
  normalizeRecoveryCode,
  randomBytes,
  seal,
  toBase64,
  unseal,
  utf8,
  fromUtf8,
} from './crypto'

describe('authenticated encryption', () => {
  const key = randomBytes(32)

  it('round-trips and never repeats a ciphertext', () => {
    const a = seal(key, utf8('Gorak, barbare'), utf8('entities'))
    const b = seal(key, utf8('Gorak, barbare'), utf8('entities'))
    expect(toBase64(a)).not.toBe(toBase64(b))
    expect(fromUtf8(unseal(key, a, utf8('entities')))).toBe('Gorak, barbare')
  })

  it('rejects a wrong key, wrong associated data and any altered byte', () => {
    const sealed = seal(key, utf8('secret'), utf8('aad'))
    expect(() => unseal(randomBytes(32), sealed, utf8('aad'))).toThrow(DecryptionError)
    expect(() => unseal(key, sealed, utf8('other'))).toThrow(DecryptionError)
    for (const index of [0, 30, sealed.length - 1]) {
      const altered = sealed.slice()
      altered[index]! ^= 1
      expect(() => unseal(key, altered, utf8('aad'))).toThrow(DecryptionError)
    }
    expect(() => unseal(key, new Uint8Array(10))).toThrow(DecryptionError)
  })
})

describe('key derivation', () => {
  it('is deterministic for a salt and differs across salts and secrets', async () => {
    const params = newKdfParams(1000)
    const a = await deriveKey('lanterne verte sous le pont', params)
    expect(a).toHaveLength(32)
    expect(await deriveKey('lanterne verte sous le pont', params)).toEqual(a)
    expect(await deriveKey('lanterne verte sous le pont', newKdfParams(1000))).not.toEqual(a)
    expect(await deriveKey('lanterne verte sous le ponT', params)).not.toEqual(a)
  })

  it('treats canonically equivalent Unicode the same (é composed or not)', async () => {
    const params = newKdfParams(1000)
    expect(await deriveKey('café', params)).toEqual(await deriveKey('café', params))
  })
})

describe('recovery codes and encoding', () => {
  it('are 8 groups of 4 unambiguous characters, forgiving when typed back', () => {
    const code = newRecoveryCode()
    expect(code).toMatch(/^([0-9A-HJKMNP-TV-Z]{4}-){7}[0-9A-HJKMNP-TV-Z]{4}$/)
    expect(normalizeRecoveryCode(code.toLowerCase().replace(/-/g, ' '))).toBe(code)
    expect(normalizeRecoveryCode('oil0-ABCD')).toBe('0110-ABCD')
  })

  it('base64 survives large binary data', () => {
    const data = randomBytes(200_000)
    expect(fromBase64(toBase64(data))).toEqual(data)
  })
})

describe('cost of a password guess', () => {
  it('follows OWASP 2023 for PBKDF2-HMAC-SHA-256', () => {
    expect(newKdfParams()).toMatchObject({ algorithm: 'PBKDF2-SHA-256', iterations: 600_000 })
  })
})
