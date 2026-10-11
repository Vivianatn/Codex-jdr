import { describe, expect, it } from 'vitest'
import { parseStatInput } from './checks'

describe('quick characteristic input (D-234)', () => {
  it('adds or removes points with a sign', () => {
    expect(parseStatInput('-2', 12)).toBe(10)
    expect(parseStatInput('+3', 12)).toBe(15)
    expect(parseStatInput(' - 1 ', 12)).toBe(11)
  })

  it('sets the value with a bare number', () => {
    expect(parseStatInput('14', 12)).toBe(14)
  })

  it('rejects anything else', () => {
    for (const text of ['', '-', 'abc', '2d6', '+1.5', '1234'])
      expect(parseStatInput(text, 12)).toBeNull()
  })
})
