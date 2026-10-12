import { describe, expect, it } from 'vitest'
import { cueForHp, cueForTurn, cuesForRoll, someoneLeveledUp } from './soundEvents'

const check = (success: boolean, critical: 'success' | 'failure' | null = null) => ({
  check: {
    stat: 'strength' as const,
    value: 12,
    bonus: 0,
    mode: 'normal' as const,
    natural: 10,
    outcome: {
      success,
      margin: 0,
      critical: critical ? { kind: critical, tier: 'major' as const } : null,
    },
  },
})

describe('cuesForRoll', () => {
  it('rattles the dice, then gives the verdict', () => {
    expect(cuesForRoll({ check: null }).map((c) => c.name)).toEqual(['dice'])
    expect(cuesForRoll(check(true)).map((c) => c.name)).toEqual(['dice', 'success'])
    expect(cuesForRoll(check(false)).map((c) => c.name)).toEqual(['dice', 'failure'])
    expect(cuesForRoll(check(true, 'success')).map((c) => c.name)).toEqual(['dice', 'critSuccess'])
    expect(cuesForRoll(check(false, 'failure')).map((c) => c.name)).toEqual(['dice', 'critFailure'])
    expect(cuesForRoll(check(true))[1]!.delay).toBeGreaterThan(0)
  })
})

describe('cueForHp', () => {
  it('makes one sound for a burst, the heaviest one', () => {
    expect(cueForHp([])).toBeNull()
    expect(cueForHp([{ kind: 'heal', severe: false }])).toBe('heal')
    expect(
      cueForHp([
        { kind: 'heal', severe: false },
        { kind: 'damage', severe: false },
      ]),
    ).toBe('damage')
    expect(
      cueForHp([
        { kind: 'damage', severe: false },
        { kind: 'damage', severe: true },
      ]),
    ).toBe('heavyDamage')
  })
})

describe('cueForTurn', () => {
  const playing = (round: number, memberId: string) =>
    ({ status: 'playing', round, groupId: 'g', memberId }) as const
  it('drums a new round, rings a new turn, sounds the horn for the GM', () => {
    expect(cueForTurn({ status: 'stopped' }, playing(1, 'a'))).toBe('round')
    expect(cueForTurn(playing(1, 'a'), playing(1, 'b'))).toBe('turn')
    expect(cueForTurn(playing(1, 'b'), { status: 'gm', round: 1 })).toBe('gmTurn')
    expect(cueForTurn({ status: 'gm', round: 1 }, playing(2, 'a'))).toBe('round')
    expect(cueForTurn(playing(1, 'a'), playing(1, 'a'))).toBeNull()
    expect(cueForTurn(playing(1, 'a'), { status: 'stopped' })).toBeNull()
  })
})

describe('someoneLeveledUp', () => {
  it('only counts characters already there', () => {
    expect(someoneLeveledUp({ a: { level: 2 } }, { a: { level: 3 } })).toBe(true)
    expect(someoneLeveledUp({ a: { level: 2 } }, { a: { level: 2 }, b: { level: 9 } })).toBe(false)
    expect(someoneLeveledUp({ a: { level: 3 } }, { a: { level: 2 } })).toBe(false)
  })
})
