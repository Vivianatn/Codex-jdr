import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { seededRng } from '@/dice'
import { defaultRules } from '@/rules'
import { opposedWinner, parseHpInput, performCheck } from './checks'
import { BUILTIN_CONDITIONS, conditionFromTemplate, startOfTurn } from './conditions'
import {
  createEntity,
  effectiveStats,
  entityHpMax,
  normalizeEntityShape,
  normalizeSkill,
} from './entity'
import {
  carriedWeight,
  carryCapacity,
  equip,
  equippedWeapon,
  formatPurse,
  isOverloaded,
  newItem,
  parseMoney,
  transferItem,
} from './items'
import {
  levelForXp,
  longRest,
  luckPointsLeft,
  shiftDisposition,
  shortRest,
  skillBlock,
  spendSkill,
  xpForLevel,
  xpProgress,
} from './progress'
import type { Entity } from './types'

const rules = defaultRules()
const template = (id: string) => BUILTIN_CONDITIONS.find((c) => c.id === id)!

function hero(): Entity {
  return createEntity('player', 'c1', rules, {
    identity: { pseudo: 'Gorak' },
    hpRoll: 14,
    stats: {
      strength: 12,
      constitution: 12,
      dexterity: 12,
      intelligence: 10,
      charisma: 10,
      wisdom: 10,
      luck: 12,
    },
  })
}

/** An rng whose next d20 is `face`. */
const d20 = (...faces: number[]) => {
  let i = 0
  return () => (faces[i++ % faces.length]! - 0.5) / 20
}

describe('equipment and carrying', () => {
  it('equipped items apply their modifiers; carried ones do not', () => {
    let e = hero()
    const gauntlets = newItem({
      name: 'Gantelets',
      type: 'accessory',
      modifiers: [{ id: 'm', stat: 'strength', value: 2, label: '' }],
    })
    e = { ...e, inventory: [gauntlets] }
    expect(effectiveStats(e, rules).strength.total).toBe(12)
    e = equip(e, gauntlets.id, 'accessory1')
    expect(effectiveStats(e, rules).strength.total).toBe(14)
    expect(effectiveStats(e, rules).strength.modifiers[0]?.label).toBe('Gantelets')
  })

  it('equipping a slot unequips its previous occupant', () => {
    const a = newItem({ name: 'Épée', type: 'weapon', damage: '1d8' })
    const b = newItem({ name: 'Hache', type: 'weapon', damage: '1d10' })
    let e = { ...hero(), inventory: [a, b] }
    e = equip(equip(e, a.id, 'mainHand'), b.id, 'mainHand')
    expect(e.inventory.map((i) => i.slot)).toEqual([null, 'mainHand'])
    expect(equippedWeapon(e)?.name).toBe('Hache')
  })

  it('becomes overloaded above Strength × 5 kg, with a Dexterity malus', () => {
    const e = { ...hero(), inventory: [newItem({ name: 'Pierres', weight: 10, quantity: 6 })] }
    expect(carriedWeight(e)).toBe(60)
    expect(carryCapacity(e, rules)).toBe(60)
    expect(isOverloaded(e, rules)).toBe(false)
    const heavier = { ...e, inventory: [...e.inventory, newItem({ name: 'Plume', weight: 0.5 })] }
    expect(isOverloaded(heavier, rules)).toBe(true)
    expect(effectiveStats(heavier, rules).dexterity.total).toBe(10)
  })

  it('transfers units and stacks identical items', () => {
    const potion = newItem({ name: 'Potion', type: 'consumable', quantity: 3 })
    const giver = { ...hero(), inventory: [potion] }
    const receiver = {
      ...hero(),
      inventory: [newItem({ name: 'Potion', type: 'consumable', quantity: 1 })],
    }
    const [g, r] = transferItem(giver, receiver, potion.id, 2)!
    expect(g.inventory[0]?.quantity).toBe(1)
    expect(r.inventory).toHaveLength(1)
    expect(r.inventory[0]?.quantity).toBe(3)
    const [g2] = transferItem(g, r, potion.id, 5)!
    expect(g2.inventory).toEqual([])
  })
})

describe('money', () => {
  const coins = rules.currency
  it('formats a purse in coins', () => {
    expect(formatPurse(342, coins)).toBe('3 po 4 pa 2 pc')
    expect(formatPurse(0, coins)).toBe('0 pc')
    expect(formatPurse(500, coins)).toBe('5 po')
  })

  it('parses tolerant money changes', () => {
    expect(parseMoney('+3 po', coins)).toBe(300)
    expect(parseMoney('-50pc', coins)).toBe(-50)
    expect(parseMoney('2 po 5 pa', coins)).toBe(250)
    expect(parseMoney('1,5 po', coins)).toBe(150)
    expect(parseMoney('12', coins)).toBe(12)
    expect(parseMoney('3 dragons', coins)).toBeNull()
    expect(parseMoney('', coins)).toBeNull()
  })
})

describe('conditions and turns', () => {
  it('applies per-turn damage, counts down, expires, and reminds the save', () => {
    let e = hero()
    e = { ...e, conditions: [{ ...conditionFromTemplate(template('poisoned')), remaining: 2 }] }
    const max = entityHpMax(e, rules)

    const t1 = startOfTurn(e, rules, max, d20(4)) // 1d4 → 4? rng maps to a d4 face
    expect(t1.entity.hp.current).toBeLessThan(e.hp.current)
    expect(t1.entity.conditions[0]?.remaining).toBe(1)
    expect(t1.events.map((ev) => ev.type)).toEqual(['perTurn', 'save'])

    const t2 = startOfTurn(t1.entity, rules, max)
    expect(t2.entity.conditions).toEqual([])
    expect(t2.events.map((ev) => ev.type)).toEqual(['perTurn', 'expired'])
  })

  it('damage from conditions consumes temporary HP first and never goes below 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 40 }),
        fc.integer({ min: 0, max: 10 }),
        fc.integer(),
        (current, temp, seed) => {
          const e = {
            ...hero(),
            hp: { roll: 14, current, temp },
            conditions: [conditionFromTemplate(template('burning'))],
          }
          const next = startOfTurn(e, rules, 25, seededRng(seed)).entity
          expect(next.hp.current).toBeGreaterThanOrEqual(0)
          const dealt = current + temp - next.hp.current - next.hp.temp
          if (dealt <= temp) expect(next.hp.current).toBe(Math.min(current, 25))
        },
      ),
    )
  })

  it('condition modifiers apply to effective stats', () => {
    const e = { ...hero(), conditions: [conditionFromTemplate(template('stunned'))] }
    expect(effectiveStats(e, rules).dexterity.total).toBe(10)
  })

  it('counts skill cooldowns down at the start of the turn', () => {
    const skill = normalizeSkill({ id: 's', name: 'Rage', kind: 'active', cooldown: 2 })
    let e = spendSkill({ ...hero(), skills: [skill] }, 's')
    expect(skillBlock(e.skills[0]!)).toBe('cooldown')
    e = startOfTurn(e, rules, 25).entity
    const { entity, events } = startOfTurn(e, rules, 25)
    expect(skillBlock(entity.skills[0]!)).toBeNull()
    expect(events).toContainEqual({ type: 'cooldownReady', skill: 'Rage' })
  })
})

describe('checks', () => {
  it('rolls under the effective value, with criticals from the rules', () => {
    const e = hero()
    expect(performCheck(e, 'strength', rules, { rng: d20(12) }).outcome.success).toBe(true)
    expect(performCheck(e, 'strength', rules, { rng: d20(13) }).outcome.success).toBe(false)
    expect(performCheck(e, 'strength', rules, { rng: d20(2) }).outcome.critical).toEqual({
      kind: 'success',
      tier: 'minor',
    })
    expect(performCheck(e, 'strength', rules, { rng: d20(19) }).outcome.critical).toEqual({
      kind: 'failure',
      tier: 'minor',
    })
  })

  it('keeps the best die with advantage and the worst with disadvantage', () => {
    const e = hero()
    const adv = performCheck(e, 'strength', rules, { mode: 'advantage', rng: d20(18, 5) })
    expect(adv.natural).toBe(18)
    const dis = performCheck(e, 'strength', rules, { mode: 'disadvantage', rng: d20(18, 5) })
    expect(dis.natural).toBe(5)
  })

  it('applies circumstance bonus and the exhaustion malus', () => {
    const tired = { ...hero(), exhaustion: 2 }
    const c = performCheck(tired, 'strength', rules, { bonus: 1, rng: d20(12) })
    expect(c.bonus).toBe(-1)
    expect(c.outcome.success).toBe(false) // 12 > 12 − 1
  })

  it('resolves opposed checks', () => {
    const ok = { success: true, critical: null, margin: 3 }
    const better = { success: true, critical: null, margin: 6 }
    const fail = { success: false, critical: null, margin: -2 }
    const crit = {
      success: true,
      critical: { kind: 'success' as const, tier: 'major' as const },
      margin: 1,
    }
    expect(opposedWinner(ok, fail)).toBe('first')
    expect(opposedWinner(ok, better)).toBe('second')
    expect(opposedWinner(crit, better)).toBe('first')
    expect(opposedWinner(ok, { ...ok })).toBe('tie')
  })

  it('parses the quick HP field', () => {
    expect(parseHpInput('-7')).toEqual({ kind: 'damage', expression: '7' })
    expect(parseHpInput('+5')).toEqual({ kind: 'heal', expression: '5' })
    expect(parseHpInput('t+4')).toEqual({ kind: 'temp', expression: '4' })
    expect(parseHpInput('T4')).toEqual({ kind: 'temp', expression: '4' })
    expect(parseHpInput('-2d6')).toEqual({ kind: 'damage', expression: '2d6' })
    expect(parseHpInput('7')).toEqual({ kind: 'damage', expression: '7' })
    expect(parseHpInput(' ')).toBeNull()
    expect(parseHpInput('+')).toBeNull()
  })
})

describe('progress', () => {
  it('XP thresholds grow by 100 × level', () => {
    expect(xpForLevel(1, rules)).toBe(0)
    expect(xpForLevel(2, rules)).toBe(100)
    expect(xpForLevel(3, rules)).toBe(300)
    expect(levelForXp(299, rules)).toBe(2)
    expect(levelForXp(300, rules)).toBe(3)
    expect(xpProgress(2, 250, rules)).toMatchObject({ into: 150, span: 200, pendingLevels: 0 })
    expect(xpProgress(2, 450, rules).pendingLevels).toBe(1)
  })

  it('luck points come from Luck and are restored by a long rest', () => {
    let e = hero() // Luck 12 → 2 points
    expect(luckPointsLeft(e, rules)).toBe(2)
    e = { ...e, luckSpent: 2 }
    expect(luckPointsLeft(e, rules)).toBe(0)
    expect(luckPointsLeft(longRest(e, rules), rules)).toBe(2)
  })

  it('social checks move the disposition gauge', () => {
    const hit = { success: true, critical: null }
    const crit = { success: true, critical: { kind: 'success' as const, tier: 'major' as const } }
    const miss = { success: false, critical: null }
    expect(shiftDisposition('neutral', hit, rules)).toBe('friendly')
    expect(shiftDisposition('neutral', crit, rules)).toBe('devoted')
    expect(shiftDisposition('wary', miss, rules)).toBe('hostile')
    expect(shiftDisposition('hostile', miss, rules)).toBe('hostile')
  })

  it('rests restore HP, uses and exhaustion', () => {
    const skill = normalizeSkill({
      id: 's',
      name: 'Soin',
      kind: 'active',
      usesMax: 2,
      usesLeft: 0,
      cooldown: 3,
      cooldownLeft: 2,
    })
    const e = { ...hero(), hp: { roll: 14, current: 5, temp: 3 }, exhaustion: 2, skills: [skill] }
    const short = shortRest(e, rules, d20(20))
    expect(short.entity.hp.current).toBeGreaterThan(5)
    const rested = longRest(e, rules)
    expect(rested.hp).toEqual({ roll: 14, current: 25, temp: 0 })
    expect(rested.exhaustion).toBe(1)
    expect(rested.skills[0]).toMatchObject({ usesLeft: 2, cooldownLeft: 0 })
  })
})

describe('older saves', () => {
  it('upgrades phase-1 entities to the current shape', () => {
    const old = hero() as unknown as Record<string, unknown>
    delete old.purse
    delete old.exhaustion
    old.skills = [
      {
        id: 's',
        name: 'Rage',
        kind: 'active',
        stat: null,
        description: '',
        enabled: true,
        modifiers: [],
      },
    ]
    old.conditions = [{ id: 'c', name: 'Fatigué', note: '' }]
    old.inventory = [{ id: 'i', name: 'Corde', quantity: 1, description: '' }]
    const e = normalizeEntityShape(old as unknown as Entity)
    expect(e.purse).toBe(0)
    expect(e.skills[0]).toMatchObject({ cooldown: 0, usesMax: null, effect: { kind: 'none' } })
    expect(e.conditions[0]).toMatchObject({ name: 'Fatigué', remaining: null, modifiers: [] })
    expect(e.inventory[0]).toMatchObject({ id: 'i', name: 'Corde', rarity: 'common', slot: null })
  })
})
