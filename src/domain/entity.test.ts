import { describe, expect, it } from 'vitest'
import { defaultRules } from '@/rules'
import { newItem } from './items'
import {
  activeModifiers,
  normalizeSkill,
  cloneEntity,
  createEntity,
  effectiveStats,
  entityHpMax,
  entityName,
  instantiateTemplate,
  withJournal,
} from './entity'

const rules = defaultRules()

describe('createEntity', () => {
  it('starts at full HP with kind-specific details', () => {
    const e = createEntity('player', 'c1', rules, { hpRoll: 14, identity: { pseudo: 'Gorak' } })
    expect(entityHpMax(e, rules)).toBe(25)
    expect(e.hp).toMatchObject({ roll: 14, fixedMax: null, current: 25, temp: 0 })
    expect(e.details).toEqual({ xp: 0, color: null })
    expect(entityName(e)).toBe('Gorak')
  })

  it('falls back to the Discord name', () => {
    const e = createEntity('player', 'c1', rules, { identity: { discordName: 'bob#1' } })
    expect(entityName(e)).toBe('bob#1')
  })
})

describe('effective stats', () => {
  it('stacks manual modifiers and enabled passive skills, ignoring actives', () => {
    const e = createEntity('player', 'c1', rules)
    e.stats.strength = 12
    e.modifiers = [{ id: 'm1', stat: 'strength', value: 2, label: 'Gantelets' }]
    e.skills = [
      normalizeSkill({
        id: 's1',
        name: 'Colosse',
        kind: 'class',
        modifiers: [{ id: 'm2', stat: 'strength', value: 1, label: '' }],
      }),
      normalizeSkill({
        id: 's2',
        name: 'Rage',
        kind: 'active',
        modifiers: [{ id: 'm3', stat: 'strength', value: 5, label: '' }],
      }),
      normalizeSkill({
        id: 's3',
        name: 'Endurci',
        kind: 'passive',
        enabled: false,
        modifiers: [{ id: 'm4', stat: 'strength', value: 3, label: '' }],
      }),
    ]
    expect(effectiveStats(e).strength.total).toBe(15)
    expect(activeModifiers(e, 'strength').map((m) => m.label)).toEqual(['Gantelets', 'Colosse'])
  })
})

describe('journal & cloning', () => {
  it('appends journal entries', () => {
    const e = withJournal(createEntity('ally', 'c1', rules), 'created', 'Créé', 42)
    expect(e.journal).toEqual([{ id: expect.any(String), at: 42, kind: 'created', text: 'Créé' }])
  })

  it('clones with fresh ids and an empty journal', () => {
    const e = withJournal(createEntity('player', 'c1', rules), 'created', 'x')
    e.inventory = [newItem({ id: 'i1', name: 'Potion', quantity: 2 })]
    const copy = cloneEntity(e)
    expect(copy.id).not.toBe(e.id)
    expect(copy.inventory[0]?.id).not.toBe('i1')
    expect(copy.inventory[0]?.name).toBe('Potion')
    expect(copy.journal).toEqual([])
  })
})

describe('instantiateTemplate', () => {
  const goblin = createEntity('enemy', '', rules, { identity: { pseudo: 'Gobelin' }, hpRoll: 4 })
  goblin.details.xpReward = 50

  it('creates numbered copies at the requested level', () => {
    const copies = instantiateTemplate(goblin, {
      campaignId: 'c1',
      quantity: 3,
      level: 2,
      existing: [],
      rules,
    })
    expect(copies.map((c) => c.identity.pseudo)).toEqual(['Gobelin 1', 'Gobelin 2', 'Gobelin 3'])
    expect(copies.every((c) => c.campaignId === 'c1' && c.level === 2)).toBe(true)
    expect(copies[0]?.hp).toMatchObject({ roll: 4, current: 16, temp: 0 })
    expect(copies[0]?.details).toMatchObject({ templateId: goblin.id, copyNumber: 1, xpReward: 50 })
    expect(new Set(copies.map((c) => c.id)).size).toBe(3)
  })

  it('continues numbering after existing copies', () => {
    const first = instantiateTemplate(goblin, {
      campaignId: 'c1',
      quantity: 2,
      level: 1,
      existing: [],
      rules,
    })
    const next = instantiateTemplate(goblin, {
      campaignId: 'c1',
      quantity: 2,
      level: 1,
      existing: first,
      rules,
    })
    expect(next.map((c) => c.identity.pseudo)).toEqual(['Gobelin 3', 'Gobelin 4'])
  })
})
