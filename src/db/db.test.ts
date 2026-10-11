import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { defaultRules } from '@/rules'
import { CodexDB, SCHEMA } from './db'

const names: string[] = []
afterEach(async () => {
  for (const name of names.splice(0)) await Dexie.delete(name)
})

describe('schema migrations', () => {
  it('v1 → v3 adds default rules, the campaign library and the new tables', async () => {
    const name = `codex-migration-${crypto.randomUUID()}`
    names.push(name)

    // A database as phase 0 left it.
    const v1 = new Dexie(name)
    v1.version(1).stores(SCHEMA[1])
    await v1.open()
    await v1.table('campaigns').add({
      id: 'c1',
      name: 'Ancienne',
      description: '',
      createdAt: 1,
      updatedAt: 1,
      lastOpenedAt: null,
    })
    v1.close()

    const db = new CodexDB(name)
    await db.open()
    expect(db.verno).toBe(3)
    expect((await db.campaigns.get('c1'))?.rules).toEqual(defaultRules())
    expect((await db.campaigns.get('c1'))?.library).toEqual({ conditions: [], macros: [] })
    expect(await db.rolls.count()).toBe(0)
    expect(await db.entities.count()).toBe(0)
    expect(await db.bestiary.count()).toBe(0)
    db.close()
  })

  it('v2 → v3 upgrades phase-1 characters and completes rule sets', async () => {
    const name = `codex-migration-${crypto.randomUUID()}`
    names.push(name)
    const v2 = new Dexie(name)
    v2.version(1).stores(SCHEMA[1])
    v2.version(2).stores(SCHEMA[2])
    await v2.open()
    const phase1Rules = {
      version: 1,
      stats: { rounding: 'ceil', min: 1, max: 20 },
      hp: { base: 10, perLevel: 1 },
    }
    await v2.table('campaigns').add({
      id: 'c1',
      name: 'Ancienne',
      description: '',
      rules: phase1Rules,
      createdAt: 1,
      updatedAt: 1,
      lastOpenedAt: null,
    })
    await v2.table('entities').add({
      id: 'e1',
      campaignId: 'c1',
      kind: 'player',
      identity: { pseudo: 'Gorak' },
      level: 1,
      hp: { roll: 14, current: 25, temp: 0 },
      stats: {},
      modifiers: [],
      skills: [
        {
          id: 's',
          name: 'Rage',
          kind: 'active',
          stat: null,
          description: '',
          enabled: true,
          modifiers: [],
        },
      ],
      conditions: [{ id: 'c', name: 'Fatigué', note: '' }],
      inventory: [{ id: 'i', name: 'Corde', quantity: 1, description: '' }],
      journal: [],
      details: { xp: 0 },
      createdAt: 1,
      updatedAt: 1,
    })
    v2.close()

    const db = new CodexDB(name)
    await db.open()
    const campaign = await db.campaigns.get('c1')
    expect(campaign?.rules.hp).toEqual({
      base: 10,
      perLevel: 1,
      woundedBelow: 0.5,
      criticalBelow: 0.25,
    })
    expect(campaign?.rules.currency).toHaveLength(3)
    const e = await db.entities.get('e1')
    expect(e).toMatchObject({ purse: 0, exhaustion: 0, luckSpent: 0 })
    expect(e?.skills[0]).toMatchObject({ cooldown: 0, effect: { kind: 'none' } })
    expect(e?.conditions[0]).toMatchObject({ name: 'Fatigué', remaining: null })
    expect(e?.inventory[0]).toMatchObject({ name: 'Corde', rarity: 'common', slot: null })
    db.close()
  })
})
