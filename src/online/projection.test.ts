import { describe, expect, it } from 'vitest'
import { emptyLibrary, type Campaign } from '@/db/types'
import { createEntity } from '@/domain/entity'
import { newElement, newMap, type GameMap } from '@/domain/maps'
import type { RollRecord } from '@/domain/rolls'
import { emptyPlayState } from '@/domain/turns'
import type { Entity } from '@/domain/types'
import { defaultRules } from '@/rules'
import {
  applyChanges,
  emptyCampaignData,
  projectForPlayer,
  Replica,
  type CampaignData,
} from './projection'

const rules = defaultRules()
const campaign: Campaign = {
  id: 'c1',
  name: 'Test',
  description: 'Notes du MJ',
  rules,
  library: emptyLibrary(),
  createdAt: 0,
  updatedAt: 0,
  lastOpenedAt: null,
}

const token = (entityId: string, hidden = false) => ({
  id: `t-${entityId}`,
  entityId,
  col: 1,
  row: 1,
  size: 1,
  hidden,
})

describe('players each see the map their character is on (D-256)', () => {
  const ayla = createEntity('player', 'c1', rules, { identity: { pseudo: 'Ayla' } })
  const brann = createEntity('player', 'c1', rules, { identity: { pseudo: 'Brann' } })
  const goule = createEntity('enemy', 'c1', rules, { identity: { pseudo: 'Goule' } })
  const hall: GameMap = { ...newMap('c1', { name: 'Hall' }), tokens: [token(brann.id)] }
  const cellar: GameMap = {
    ...newMap('c1', { name: 'Cave' }),
    tokens: [token(ayla.id), token(goule.id)],
  }
  const data = {
    ...emptyCampaignData(),
    campaigns: [{ ...campaign, play: { ...emptyPlayState(), mapId: hall.id } }],
    entities: [ayla, brann, goule],
    maps: [hall, cellar],
  }

  it('the one who went through gets the other map, the others keep the GM board', () => {
    const forAyla = projectForPlayer(data, [ayla.id])
    expect(forAyla.maps.map((m) => m.id)).toEqual([cellar.id])
    expect(forAyla.campaigns[0]!.play?.mapId).toBe(cellar.id)
    expect(forAyla.entities.map((e) => e.id)).toContain(goule.id)

    const forBrann = projectForPlayer(data, [brann.id])
    expect(forBrann.maps.map((m) => m.id)).toEqual([hall.id])
    // The ghoul is on a map Brann does not see.
    expect(forBrann.entities.map((e) => e.id)).not.toContain(goule.id)
  })

  it('a hidden token does not give its map away; no token falls back to the GM board', () => {
    const hidden = {
      ...data,
      maps: [hall, { ...cellar, tokens: [token(ayla.id, true)] }],
    }
    expect(projectForPlayer(hidden, [ayla.id]).maps.map((m) => m.id)).toEqual([hall.id])
    expect(projectForPlayer(data, []).maps.map((m) => m.id)).toEqual([hall.id])
  })
})

describe('fast diffs keep what players see exact (D-270)', () => {
  const ayla = createEntity('player', 'c1', rules, { identity: { pseudo: 'Ayla' } })
  const goule = createEntity('enemy', 'c1', rules, {
    identity: { pseudo: 'Goule', description: 'Secret du MJ' },
  })
  const boss = createEntity('enemy', 'c1', rules, { identity: { pseudo: 'Boss' } })
  const hall: GameMap = {
    ...newMap('c1', { name: 'Hall' }),
    tokens: [token(ayla.id), token(goule.id), token(boss.id, true)],
    elements: [newElement('note', { col: 0, row: 0 }, { label: 'Note du MJ' })],
  }
  const roll = (i: number, secret = false): RollRecord => ({
    id: crypto.randomUUID(),
    campaignId: 'c1',
    at: 1000 + i,
    entityId: null,
    kind: 'free',
    label: '1d20',
    expression: '1d20',
    total: 10,
    breakdown: '[10]',
    groups: [],
    secret,
    check: null,
    rerollOf: null,
    note: '',
  })
  const base = (): CampaignData => ({
    ...emptyCampaignData(),
    campaigns: [{ ...campaign, play: { ...emptyPlayState(), mapId: hall.id } }],
    entities: [ayla, goule, boss],
    maps: [hall],
  })

  it('sends a changed record, skips the same one and an equal copy, resends a forgotten one', () => {
    const replica = new Replica()
    const data = base()
    expect(replica.diff(projectForPlayer(data, [ayla.id])).map((c) => c.table)).toEqual([
      'campaigns',
      'entities',
      'maps',
    ])
    expect(replica.diff(projectForPlayer(data, [ayla.id]))).toEqual([])
    // A new object with the same content: nothing to send.
    const same = { ...data, maps: [{ ...hall }] }
    expect(replica.diff(projectForPlayer(same, [ayla.id]))).toEqual([])
    // The token moved: the map goes, alone.
    const moved = {
      ...data,
      maps: [
        {
          ...hall,
          tokens: hall.tokens.map((t) => (t.entityId === ayla.id ? { ...t, col: 4 } : t)),
        },
      ],
    }
    const changes = replica.diff(projectForPlayer(moved, [ayla.id]))
    expect(changes.map((c) => c.table)).toEqual(['maps'])
    const sent = changes[0]!.put[0] as unknown as GameMap
    expect(sent.tokens.find((t) => t.entityId === ayla.id)?.col).toBe(4)
    replica.forget('maps', [hall.id])
    expect(replica.diff(projectForPlayer(moved, [ayla.id])).map((c) => c.table)).toEqual(['maps'])
    // An enemy hit: its masked copy goes, still masked.
    const hit = { ...moved, entities: [ayla, { ...goule, hp: { ...goule.hp, current: 1 } }, boss] }
    const [entities] = replica.diff(projectForPlayer(hit, [ayla.id]))
    expect(entities!.table).toBe('entities')
    const seen = entities!.put[0] as unknown as Entity
    expect(seen.hp.current).toBe(1)
    expect(seen.identity.description).toBe('')
    expect(Object.values(seen.stats).every((v) => v === 0)).toBe(true)
  })

  it('never shows hidden tokens, GM notes, secret rolls; shows the newest public rolls', () => {
    const rolls = [...Array.from({ length: 150 }, (_, i) => roll(i)), roll(200, true), roll(300)]
    // Stored in any order (by id): the newest still reaches the players.
    const data = { ...base(), rolls: rolls.toSorted((a, b) => a.id.localeCompare(b.id)) }
    const view = projectForPlayer(data, [ayla.id])
    expect(view.entities.map((e) => e.id)).not.toContain(boss.id)
    expect(view.maps[0]!.tokens.map((t) => t.entityId)).not.toContain(boss.id)
    expect(view.maps[0]!.elements).toEqual([])
    expect(view.rolls).toHaveLength(100)
    expect(view.rolls.some((r) => r.secret)).toBe(false)
    expect(view.rolls.at(-1)!.at).toBe(1300)
    expect(view.campaigns[0]!.description).toBe('')
  })

  it('brings committed writes in without reading back, ignoring other campaigns', () => {
    const data = base()
    const moved = { ...hall, name: 'Grand hall' }
    const other = { ...newMap('c2', { name: 'Ailleurs' }) }
    const next = applyChanges(data, 'c1', [
      { table: 'maps', put: [moved, other] as unknown as Record<string, unknown>[], del: [] },
      { table: 'entities', put: [], del: [boss.id] },
      { table: 'outbox', put: [{ id: 'x' }], del: [] },
    ])
    expect(next.maps).toEqual([moved])
    expect(next.entities.map((e) => e.id)).toEqual([ayla.id, goule.id])
    expect(next.skills).toBe(data.skills)
    expect(applyChanges(data, 'c1', [])).toBe(data)
  })
})
