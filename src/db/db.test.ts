import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { starterConditions } from '@/domain/conditions'
import { createEntity } from '@/domain/entity'
import { newItem } from '@/domain/items'
import { defaultRules } from '@/rules'
import { CodexDB, SCHEMA } from './db'

const names: string[] = []
afterEach(async () => {
  for (const name of names.splice(0)) await Dexie.delete(name)
})

describe('schema migrations', () => {
  it('v1 → v4 adds default rules, the starter conditions and the new tables', async () => {
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
    expect(db.verno).toBe(8)
    expect((await db.campaigns.get('c1'))?.rules).toEqual(defaultRules())
    expect((await db.campaigns.get('c1'))?.library).toEqual({
      conditions: starterConditions(),
      macros: [],
    })
    expect(await db.rolls.count()).toBe(0)
    expect(await db.entities.count()).toBe(0)
    expect(await db.bestiary.count()).toBe(0)
    db.close()
  })

  it('v2 → v4 upgrades phase-1 characters and completes rule sets', async () => {
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
    expect(campaign?.rules.currency).toEqual([])
    const e = await db.entities.get('e1')
    expect(e).toMatchObject({ purse: 0, exhaustion: 0, luckSpent: 0 })
    expect(e?.skills[0]).toMatchObject({ cooldown: 0, effect: { kind: 'none' } })
    expect(e?.conditions[0]).toMatchObject({ name: 'Fatigué', remaining: null })
    expect(e?.inventory[0]).toMatchObject({ name: 'Corde', rarity: 'common', slot: null })
    db.close()
  })

  it('v3 → v4 switches off the invented phase-2 defaults but keeps GM choices', async () => {
    const name = 'codex-migration-' + crypto.randomUUID()
    names.push(name)
    const v3 = new Dexie(name)
    v3.version(1).stores(SCHEMA[1])
    v3.version(2).stores(SCHEMA[2])
    v3.version(3).stores(SCHEMA[3])
    await v3.open()
    const phase2 = {
      ...defaultRules(),
      combat: { strengthDamageBonus: true, unarmedDamage: '1d4' },
      carry: { kgPerStrength: 5, overloadedDexPenalty: 2 },
      fatigue: { maxExhaustion: 6, checkPenaltyPerLevel: 1, shortRestHeal: '1d6' },
      luck: { pointsPerLuck: 5 },
      xp: { perLevel: 100 },
      disposition: { step: 1, criticalStep: 2 },
      currency: [
        { id: 'gold', name: 'Or', short: 'po', value: 100 },
        { id: 'silver', name: 'Argent', short: 'pa', value: 10 },
        { id: 'copper', name: 'Cuivre', short: 'pc', value: 1 },
      ],
    }
    const base = { description: '', createdAt: 1, updatedAt: 1, lastOpenedAt: null }
    await v3.table('campaigns').bulkAdd([
      {
        ...base,
        id: 'untouched',
        name: 'A',
        rules: phase2,
        library: { conditions: [], macros: [] },
      },
      {
        ...base,
        id: 'custom',
        name: 'B',
        // The GM changed these two groups: they must survive.
        rules: { ...phase2, luck: { pointsPerLuck: 3 }, xp: { perLevel: 250 } },
        library: { conditions: [{ id: 'x', name: 'Maudit' }], macros: [] },
      },
    ])
    v3.close()

    const db = new CodexDB(name)
    await db.open()
    const untouched = (await db.campaigns.get('untouched'))!
    expect(untouched.rules).toEqual(defaultRules())
    expect(untouched.library.conditions).toEqual(starterConditions())
    const custom = (await db.campaigns.get('custom'))!
    expect(custom.rules.luck.pointsPerLuck).toBe(3)
    expect(custom.rules.xp).toEqual({ mode: 'linear', perLevel: 250, table: [] })
    expect(custom.rules.carry.kgPerStrength).toBe(0)
    expect(custom.library.conditions.map((c) => c.name)).toEqual(['Maudit'])
    db.close()
  })

  it('v5 → v6 gives every campaign its own bestiary and item library', async () => {
    const name = 'codex-migration-' + crypto.randomUUID()
    names.push(name)
    const v5 = new Dexie(name)
    for (const v of [1, 2, 3, 4, 5] as const) v5.version(v).stores(SCHEMA[v])
    await v5.open()
    const base = { description: '', createdAt: 1, updatedAt: 1, lastOpenedAt: null }
    await v5.table('campaigns').bulkAdd([
      {
        ...base,
        id: 'a',
        name: 'A',
        rules: defaultRules(),
        library: { conditions: [], macros: [] },
      },
      {
        ...base,
        id: 'b',
        name: 'B',
        rules: defaultRules(),
        library: { conditions: [], macros: [] },
      },
    ])
    const goblin = createEntity('enemy', '', defaultRules(), { identity: { pseudo: 'Gobelin' } })
    await v5.table('bestiary').add(goblin)
    await v5.table('itemLibrary').add(newItem({ name: 'Potion' }))
    // An enemy made from the shared template in campaign B.
    const copy = createEntity('enemy', 'b', defaultRules())
    copy.details.templateId = goblin.id
    await v5.table('entities').add(copy)
    v5.close()

    const db = new CodexDB(name)
    await db.open()
    const inA = await db.bestiary.where('campaignId').equals('a').toArray()
    const inB = await db.bestiary.where('campaignId').equals('b').toArray()
    expect(inA.map((t) => t.identity.pseudo)).toEqual(['Gobelin'])
    expect(inB.map((t) => t.identity.pseudo)).toEqual(['Gobelin'])
    expect(inA[0]!.id).not.toBe(inB[0]!.id)
    const enemy = await db.entities.get(copy.id)
    expect(enemy?.kind === 'enemy' && enemy.details.templateId).toBe(inB[0]!.id)
    expect(await db.itemLibrary.where('campaignId').equals('a').count()).toBe(1)
    expect(await db.itemLibrary.where('campaignId').equals('b').count()).toBe(1)
    db.close()
  })
})
