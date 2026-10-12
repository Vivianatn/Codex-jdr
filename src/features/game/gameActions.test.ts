import { beforeEach, describe, expect, it } from 'vitest'
import { activeDb } from '@/db/db'
import { emptyLibrary, type Campaign } from '@/db/types'
import { conditionFromTemplate } from '@/domain/conditions'
import { defaultRules } from '@/rules'
import { configuredRules, TEST_CONDITIONS } from '@/test/fixtures'
import { createEntity, normalizeSkill } from '@/domain/entity'
import { equip, newItem } from '@/domain/items'
import type { Entity } from '@/domain/types'
import { getMessages } from '@/i18n'
import { campaignHistory, useCampaignStore } from '@/stores/campaignStore'
import { useRollStore } from '@/stores/rollStore'
import { createGameActions } from './gameActions'

const t = getMessages('fr')
const rules = configuredRules()
const campaign: Campaign = {
  id: 'c1',
  name: 'Test',
  description: '',
  rules,
  library: emptyLibrary(),
  createdAt: 0,
  updatedAt: 0,
  lastOpenedAt: null,
}

/**
 * Loaded dice: each call returns face/20, so a d20 shows exactly `face` and
 * smaller dice scale (face 20 → max). The sequence repeats.
 */
function d20(...faces: number[]) {
  let i = 0
  return () => (faces[i++ % faces.length]! - 0.5) / 20
}

const entity = (id: string) => useCampaignStore.getState().entities[id]!

async function setup(...entities: Entity[]) {
  await useCampaignStore.getState().unload()
  await activeDb().entities.clear()
  await activeDb().entities.bulkAdd(entities)
  await useCampaignStore.getState().load('c1')
  useRollStore.setState({ campaignId: 'c1', rolls: [] })
}

function hero(name = 'Gorak') {
  return createEntity('player', 'c1', rules, {
    identity: { pseudo: name },
    hpRoll: 14,
    stats: {
      strength: 14,
      constitution: 12,
      dexterity: 12,
      intelligence: 10,
      charisma: 12,
      wisdom: 10,
      luck: 10,
    },
  })
}

beforeEach(() => campaignHistory.getState().clear())

describe('game actions', () => {
  it('applies the quick HP field: damage, heal, temporary HP (temp absorbs first)', async () => {
    const g = hero()
    await setup(g)
    const actions = createGameActions(t, campaign)
    expect(actions.applyHpText(g.id, '-7')).toBeNull()
    expect(entity(g.id).hp.current).toBe(18)
    actions.applyHpText(g.id, '+5')
    expect(entity(g.id).hp.current).toBe(23)
    actions.applyHpText(g.id, 't+4')
    actions.applyHpText(g.id, '-6')
    expect(entity(g.id).hp).toMatchObject({ current: 21, temp: 0 })
    expect(actions.applyHpText(g.id, 'abc')).toBe(t.hp.invalid)
    expect(entity(g.id).journal.at(-1)?.text).toBe('−6 PV')
  })

  it('records a check in the history with its outcome', async () => {
    const g = hero()
    await setup(g)
    const actions = createGameActions(t, campaign, d20(2))
    const result = actions.check(g.id, 'dexterity', {
      label: 'Discrétion (Dextérité)',
      secret: true,
    })!
    expect(result.check.outcome.critical).toEqual({ kind: 'success', tier: 'minor' })
    const [last] = useRollStore.getState().rolls
    expect(last).toMatchObject({
      entityId: g.id,
      label: 'Discrétion (Dextérité)',
      secret: true,
      kind: 'check',
    })
  })

  it('passes a turn: poison damage, countdown, expiry', async () => {
    const g = hero()
    g.conditions = [
      {
        ...conditionFromTemplate(TEST_CONDITIONS.poisoned),
        remaining: 1,
      },
    ]
    await setup(g)
    const actions = createGameActions(t, campaign, d20(20)) // 1d4 → 4
    const events = actions.passTurn(g.id)!
    expect(events.map((e) => e.type)).toEqual(['perTurn', 'expired'])
    expect(entity(g.id).hp.current).toBe(21)
    expect(entity(g.id).conditions).toEqual([])
    // One undo restores HP and the condition together.
    campaignHistory.getState().undo()
    expect(entity(g.id).hp.current).toBe(25)
    expect(entity(g.id).conditions).toHaveLength(1)
  })

  it('uses a consumable: heals, spends one unit, single undo', async () => {
    const g = hero()
    g.hp.current = 10
    g.inventory = [
      newItem({
        name: 'Potion de soin',
        type: 'consumable',
        quantity: 2,
        use: { kind: 'heal', expression: '2d4' },
      }),
    ]
    await setup(g)
    const actions = createGameActions(t, campaign, d20(20)) // 2d4 → 8
    actions.useItem(g.id, g.inventory[0]!.id)
    expect(entity(g.id).hp.current).toBe(18)
    expect(entity(g.id).inventory[0]?.quantity).toBe(1)
    expect(campaignHistory.getState().past).toHaveLength(1)
    campaignHistory.getState().undo()
    expect(entity(g.id)).toMatchObject({ hp: { current: 10 }, inventory: [{ quantity: 2 }] })
  })

  it('melee attack hits with weapon damage + Strength modifier on the target', async () => {
    const g = hero()
    const sword = newItem({ name: 'Épée', type: 'weapon', damage: '1d8' })
    const armed = equip({ ...g, inventory: [sword] }, sword.id, 'mainHand')
    const goblin = createEntity('enemy', 'c1', rules, {
      identity: { pseudo: 'Gobelin 1' },
      hpRoll: 10,
    })
    await setup(armed, goblin)
    // d20 = 5 (hit under 14), then 1d8 = 8 (face 20 → 8)… + FOR mod (14 → +2)
    const actions = createGameActions(t, campaign, d20(5, 20))
    const result = actions.attack(armed.id, { kind: 'melee', targetId: goblin.id })!
    expect(result.damage?.total).toBe(10)
    expect(entity(goblin.id).hp.current).toBe(21 - 10)
  })

  it('with no damage rule and no weapon, a hit applies nothing: the GM decides', async () => {
    const g = hero()
    const goblin = createEntity('enemy', 'c1', rules, {
      identity: { pseudo: 'Gobelin 1' },
      hpRoll: 10,
    })
    await setup(g, goblin)
    const free = { ...campaign, rules: defaultRules() }
    const result = createGameActions(t, free, d20(5)).attack(g.id, {
      kind: 'melee',
      targetId: goblin.id,
    })!
    expect(result.check?.outcome.success).toBe(true)
    expect(result.damage).toBeNull()
    expect(entity(goblin.id).hp.current).toBe(21)
    // …or types the damage: no Strength bonus is added when the rule is off.
    const typed = createGameActions(t, free, d20(5, 20)).attack(g.id, {
      kind: 'melee',
      targetId: goblin.id,
      damage: '1d6',
    })!
    expect(typed.damage?.total).toBe(6)
    expect(entity(goblin.id).hp.current).toBe(15)
  })

  it('launches a skill: check, effect on every target, cooldown, one undo', async () => {
    const mage = hero('Lyra')
    mage.skills = [
      normalizeSkill({
        id: 'fb',
        name: 'Boule de feu',
        kind: 'active',
        stat: 'intelligence',
        cooldown: 2,
        usesMax: 3,
        usesLeft: 3,
        effect: { kind: 'damage', expression: '2d6', conditionId: null },
      }),
    ]
    const a = createEntity('enemy', 'c1', rules, { identity: { pseudo: 'A' }, hpRoll: 20 })
    const b = createEntity('enemy', 'c1', rules, { identity: { pseudo: 'B' }, hpRoll: 20 })
    await setup(mage, a, b)
    const actions = createGameActions(t, campaign, d20(3, 20, 20)) // check 3 ≤ 10, 2d6 → 12
    expect(actions.launchSkill(mage.id, 'fb', [a.id, b.id], true)).toBe(true)
    expect(entity(a.id).hp.current).toBe(31 - 12)
    expect(entity(b.id).hp.current).toBe(31 - 12)
    expect(entity(mage.id).skills[0]).toMatchObject({ cooldownLeft: 2, usesLeft: 2 })
    // On cooldown: cannot be launched again.
    expect(actions.launchSkill(mage.id, 'fb', [a.id], false)).toBeNull()
    campaignHistory.getState().undo()
    expect(entity(a.id).hp.current).toBe(31)
    expect(entity(mage.id).skills[0]).toMatchObject({ cooldownLeft: 0, usesLeft: 3 })
  })

  it('a social check moves an ally disposition', async () => {
    const g = hero()
    const ally = createEntity('ally', 'c1', rules, { identity: { pseudo: 'Bran' } })
    await setup(g, ally)
    createGameActions(t, campaign, d20(5)).social(g.id, 'persuasion', ally.id)
    expect(entity(ally.id).details).toMatchObject({ disposition: 'friendly' })
  })

  it('identifies a hidden property with an Intelligence check', async () => {
    const g = hero()
    g.inventory = [
      newItem({
        name: 'Anneau',
        hidden: { text: 'Invisibilité', difficulty: 2, identified: false },
      }),
    ]
    await setup(g)
    createGameActions(t, campaign, d20(9)).identify(g.id, g.inventory[0]!.id) // 9 > 10 − 2 → failure
    expect(entity(g.id).inventory[0]?.hidden?.identified).toBe(false)
    createGameActions(t, campaign, d20(4)).identify(g.id, g.inventory[0]!.id)
    expect(entity(g.id).inventory[0]?.hidden?.identified).toBe(true)
  })

  it('spends a luck point to reroll the last roll', async () => {
    const g = hero()
    g.stats.luck = 10 // 2 points
    await setup(g)
    const actions = createGameActions(t, campaign, d20(18, 3))
    const first = actions.check(g.id, 'strength')!
    const again = actions.luckReroll(g.id)!
    expect(again.rerollOf).toBe(first.record.id)
    expect(again.check?.natural).toBe(3)
    expect(entity(g.id).luckSpent).toBe(1)
  })

  it('gives an item to another character in one undoable step', async () => {
    const g = hero()
    const l = hero('Lyra')
    g.inventory = [newItem({ name: 'Corde', quantity: 1 })]
    await setup(g, l)
    createGameActions(t, campaign).giveItem(g.id, l.id, g.inventory[0]!.id)
    expect(entity(g.id).inventory).toEqual([])
    expect(entity(l.id).inventory[0]?.name).toBe('Corde')
    campaignHistory.getState().undo()
    expect(entity(g.id).inventory).toHaveLength(1)
    expect(entity(l.id).inventory).toHaveLength(0)
  })
})
