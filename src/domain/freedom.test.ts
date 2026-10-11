import { describe, expect, it } from 'vitest'
import { defaultRules, dropLegacyPhase2Defaults } from '@/rules'
import { starterConditions } from './conditions'
import { createEntity, effectiveStats } from './entity'
import { defenseValue, equip, formatPurse, isOverloaded, newItem, parseMoney } from './items'
import {
  hasXpThresholds,
  levelForXp,
  longRest,
  luckPointsMax,
  restsAvailable,
  shiftDisposition,
  xpForLevel,
  xpProgress,
} from './progress'

/** D-217: Codex imposes no optional mechanic; the GM switches on what they use. */
describe('nothing is imposed by default', () => {
  const rules = defaultRules()
  const hero = () => {
    const e = createEntity('player', 'c', rules, { hpRoll: 10 })
    e.stats.strength = 1
    e.stats.luck = 20
    return e
  }

  it('optional rule groups are all off', () => {
    expect(rules.combat).toEqual({ strengthDamageBonus: false, unarmedDamage: '' })
    expect(rules.defense).toEqual({ fromDexterity: false, fromEquipment: false })
    expect(rules.carry.kgPerStrength).toBe(0)
    expect(rules.fatigue.maxExhaustion).toBe(0)
    expect(restsAvailable(rules)).toEqual({ short: false, long: false })
    expect(rules.luck.pointsPerLuck).toBe(0)
    expect(rules.xp.mode).toBe('none')
    expect(rules.disposition).toEqual({ step: 0, criticalStep: 0 })
    expect(rules.currency).toEqual([])
  })

  it('no defense, no overload, no luck points, no XP thresholds', () => {
    const e = hero()
    e.inventory = [newItem({ name: 'Enclume', weight: 500 })]
    expect(defenseValue(e, rules, 12)).toBeNull()
    expect(isOverloaded(e, rules)).toBe(false)
    expect(effectiveStats(e, rules).dexterity.modifiers).toEqual([])
    expect(luckPointsMax(e, rules)).toBe(0)
    expect(hasXpThresholds(rules)).toBe(false)
    expect(xpProgress(1, 99999, rules)).toBeNull()
    expect(levelForXp(99999, rules)).toBe(1)
  })

  it('social checks leave the gauge to the GM', () => {
    expect(
      shiftDisposition(
        'neutral',
        { success: true, critical: { kind: 'success', tier: 'major' } },
        rules,
      ),
    ).toBe('neutral')
  })

  it('the purse is a plain number until coins are defined', () => {
    expect(formatPurse(42, rules.currency)).toBe('42')
    expect(parseMoney('+30', rules.currency)).toBe(30)
    expect(parseMoney('-5', rules.currency)).toBe(-5)
    expect(parseMoney('3 po', rules.currency)).toBeNull()
  })

  it('starter conditions have no duration and no numeric effect', () => {
    for (const c of starterConditions()) {
      expect(c).toMatchObject({
        duration: null,
        modifiers: [],
        perTurn: null,
        save: null,
        concentration: false,
      })
    }
  })
})

describe('the GM configures what they want', () => {
  it('custom XP table', () => {
    const rules = defaultRules()
    rules.xp = { mode: 'table', perLevel: 0, table: [50, 200, 600] }
    expect(xpForLevel(2, rules)).toBe(50)
    expect(xpForLevel(4, rules)).toBe(600)
    expect(xpForLevel(5, rules)).toBeNull()
    expect(levelForXp(250, rules)).toBe(3)
    expect(levelForXp(10_000, rules)).toBe(4)
    expect(xpProgress(4, 10_000, rules)).toBeNull() // end of the table
  })

  it('a long rest only does what is ticked', () => {
    const rules = defaultRules()
    rules.rests.longRest.fullHp = true
    const e = createEntity('player', 'c', rules, { hpRoll: 10 })
    const hurt = { ...e, hp: { ...e.hp, current: 1, temp: 4 }, exhaustion: 2, luckSpent: 1 }
    const rested = longRest(hurt, rules)
    expect(rested.hp).toMatchObject({ current: e.hp.current, temp: 4 })
    expect(rested.exhaustion).toBe(2)
    expect(rested.luckSpent).toBe(1)
    expect(restsAvailable(rules)).toEqual({ short: false, long: true })
  })

  it('defense from equipment only', () => {
    const rules = defaultRules()
    rules.defense.fromEquipment = true
    let e = createEntity('player', 'c', rules)
    const shield = newItem({ name: 'Bouclier', type: 'armor', defense: 3 })
    e = equip({ ...e, inventory: [shield] }, shield.id, 'offHand')
    expect(defenseValue(e, rules, 15)).toBe(3)
  })

  it('legacy phase-2 defaults are dropped once, custom values kept', () => {
    const legacy = {
      ...defaultRules(),
      carry: { kgPerStrength: 5, overloadedDexPenalty: 2 },
      luck: { pointsPerLuck: 3 },
    }
    const cleaned = dropLegacyPhase2Defaults(legacy)
    expect(cleaned.carry.kgPerStrength).toBe(0)
    expect(cleaned.luck.pointsPerLuck).toBe(3)
  })
})
