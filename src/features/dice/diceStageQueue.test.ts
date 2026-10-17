import { describe, expect, it } from 'vitest'
import type { RollRecord } from '@/domain/rolls'
import {
  enqueueRolls,
  freshRolls,
  STAGE_FRESH_MS,
  STAGE_MAX_QUEUE,
  stageDuration,
} from './diceStageQueue'

const NOW = 1_000_000

function roll(id: string, patch: Partial<RollRecord> = {}): RollRecord {
  return {
    id,
    campaignId: 'c',
    at: NOW - 100,
    entityId: null,
    kind: 'free',
    label: '1d20',
    expression: '1d20',
    total: 12,
    breakdown: '[12]',
    groups: [],
    secret: false,
    check: null,
    rerollOf: null,
    note: '',
    ...patch,
  }
}

describe('dice stage queue (D-268)', () => {
  it('stages only rolls never seen, oldest first, each once', () => {
    const seen = new Set(['old'])
    const rolls = [roll('b', { at: NOW - 50 }), roll('old'), roll('a', { at: NOW - 200 })]
    expect(freshRolls(rolls, seen, { now: NOW, showSecret: true }).map((r) => r.id)).toEqual([
      'a',
      'b',
    ])
    expect(freshRolls(rolls, seen, { now: NOW, showSecret: true })).toEqual([])
  })

  it('never replays history arriving late (sync, reconnection)', () => {
    const seen = new Set<string>()
    const late = roll('late', { at: NOW - STAGE_FRESH_MS - 1 })
    expect(freshRolls([late], seen, { now: NOW, showSecret: true })).toEqual([])
    expect(seen.has('late')).toBe(true)
  })

  it('keeps secret rolls for the GM devices', () => {
    const secret = roll('s', { secret: true })
    expect(freshRolls([secret], new Set(), { now: NOW, showSecret: false })).toEqual([])
    expect(freshRolls([secret], new Set(), { now: NOW, showSecret: true })).toEqual([secret])
  })

  it('caps the waiting rolls, dropping the oldest but never the one showing', () => {
    const many = Array.from({ length: 7 }, (_, i) => roll(`r${i}`))
    const queue = enqueueRolls([roll('now')], many)
    expect(queue[0]!.id).toBe('now')
    expect(queue.slice(1).map((r) => r.id)).toEqual(['r3', 'r4', 'r5', 'r6'])
    expect(queue).toHaveLength(STAGE_MAX_QUEUE + 1)
    expect(enqueueRolls([], [roll('x')]).map((r) => r.id)).toEqual(['x'])
  })

  it('goes faster when rolls wait, and without motion', () => {
    expect(stageDuration(0, true)).toBeGreaterThan(stageDuration(1, true))
    expect(stageDuration(1, true)).toBeGreaterThan(stageDuration(3, true))
    expect(stageDuration(0, false)).toBeLessThan(stageDuration(0, true))
    expect(stageDuration(0, true)).toBeLessThanOrEqual(2600)
  })
})
