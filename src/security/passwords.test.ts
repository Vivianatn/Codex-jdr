import { describe, expect, it } from 'vitest'
import { checkPassword, checkUsername, usernameKey } from './passwords'

describe('password rules (NIST SP 800-63B rev. 4)', () => {
  it.each([
    ['lanterne verte sous le pont', null],
    ['Tr0is-corbeaux/sur*la tour', null],
    ['quatorze carac', 'passwordTooShort'],
    ['x'.repeat(257), 'passwordTooLong'],
    ['aaaaaaaaaaaaaaaaaaaa', 'passwordTooSimple'],
    ['azertyuiop1234567890', 'passwordTooSimple'],
    ['motdepasse123456789', 'passwordTooSimple'],
    ['Agathe aime les dragons', 'passwordContainsUsername'],
  ])('%s → %s', (password, problem) => {
    expect(checkPassword(password, 'agathe')).toBe(problem)
  })

  it('counts characters, not UTF-16 units', () => {
    expect(checkPassword('🐉🐉🐉🐉🐉🐉🐉🐉🐉🐉🐉🐉🐉🐉')).toBe('passwordTooShort')
  })
})

describe('usernames', () => {
  it('compare without case, accents or extra spaces', () => {
    expect(usernameKey('  Élodie   La Grise ')).toBe('elodie la grise')
  })

  it('must be 1–40 characters without control characters', () => {
    expect(checkUsername('MJ')).toBeNull()
    expect(checkUsername('')).toBe('usernameInvalid')
    expect(checkUsername('a'.repeat(41))).toBe('usernameInvalid')
    expect(checkUsername('a\u0000b')).toBe('usernameInvalid')
  })
})
