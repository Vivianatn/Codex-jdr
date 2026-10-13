import { describe, expect, it } from 'vitest'
import { activeDb } from '@/db/db'
import { sessionRepository } from '@/db/sessions'
import {
  moveSessionMap,
  newSessionPlan,
  nextSessionMapId,
  normalizeSessionPlan,
  startMapId,
} from './sessions'

describe('a session is a route of maps (D-258)', () => {
  it('plans saved with one map get it as their route', () => {
    const legacy = { ...newSessionPlan('c1', 'Crypte'), mapIds: undefined, mapId: 'hall' }
    expect(normalizeSessionPlan(legacy, 'c1')!.mapIds).toEqual(['hall'])
    const none = { ...newSessionPlan('c1', 'Crypte'), mapIds: undefined, mapId: null }
    expect(normalizeSessionPlan(none, 'c1')!.mapIds).toEqual([])
  })

  it('keeps the order, drops duplicates and junk', () => {
    const raw = { ...newSessionPlan('c1', 'Crypte'), mapIds: ['b', 'a', 'b', '', 3] }
    expect(normalizeSessionPlan(raw, 'c1')!.mapIds).toEqual(['b', 'a'])
  })

  it('starts on the first map and moves on in order', () => {
    const plan = { mapIds: ['hall', 'cellar', 'crypt'] }
    expect(startMapId(plan)).toBe('hall')
    expect(startMapId({ mapIds: [] })).toBeNull()
    expect(nextSessionMapId(plan, 'hall')).toBe('cellar')
    expect(nextSessionMapId(plan, 'crypt')).toBeNull()
    // Board elsewhere: the next map is the first one.
    expect(nextSessionMapId(plan, 'inn')).toBe('hall')
    expect(nextSessionMapId(plan, null)).toBe('hall')
  })

  it('reorders by moving one map', () => {
    expect(moveSessionMap(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
    expect(moveSessionMap(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
    expect(moveSessionMap(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c'])
    expect(moveSessionMap(['a', 'b'], 5, 0)).toEqual(['a', 'b'])
  })

  it('the repository upgrades plans stored by older versions', async () => {
    const plan = newSessionPlan('c1', 'Crypte')
    const { mapIds: _dropped, ...stored } = plan
    await activeDb().sessions.put({ ...stored, mapId: 'hall' } as never)
    expect((await sessionRepository.getPlan(plan.id))?.mapIds).toEqual(['hall'])
    expect((await sessionRepository.listPlans('c1')).map((p) => p.mapIds)).toEqual([['hall']])
  })
})
