import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  adjustCurrentForNewMax,
  applyHpDelta,
  cellsToMeters,
  checkCreationSkills,
  defaultRules,
  effectiveStat,
  hpBand,
  hpFormulaParts,
  hpMax,
  hpRollFromMax,
  isOverSkillAllowance,
  nextExtraSkillLevel,
  resolveCheck,
  skillAllowance,
  statFromDice,
  statModifier,
  withDefaultRules,
  type RulesConfig,
} from '.'

const rules = defaultRules()
const d20 = fc.integer({ min: 1, max: 20 })
const level = fc.integer({ min: 1, max: 100 })

function withRules(patch: (r: RulesConfig) => void): RulesConfig {
  const r = defaultRules()
  patch(r)
  return r
}

describe('characteristics', () => {
  it('2d20/2 rounded up is always an integer between 1 and 20', () => {
    fc.assert(
      fc.property(d20, d20, (a, b) => {
        const v = statFromDice(a, b, rules)
        expect(Number.isInteger(v)).toBe(true)
        expect(v).toBeGreaterThanOrEqual(1)
        expect(v).toBeLessThanOrEqual(20)
      }),
    )
  })

  it('applies the configured rounding', () => {
    expect(statFromDice(14, 9, rules)).toBe(12)
    expect(
      statFromDice(
        14,
        9,
        withRules((r) => (r.stats.rounding = 'floor')),
      ),
    ).toBe(11)
    expect(
      statFromDice(
        14,
        9,
        withRules((r) => (r.stats.rounding = 'half')),
      ),
    ).toBe(11.5)
  })

  it('stacks modifiers and never goes below 0', () => {
    expect(effectiveStat(12, [2, -1, 3])).toBe(16)
    expect(effectiveStat(3, [-5])).toBe(0)
  })

  it('computes the d20 + modifier bonus', () => {
    expect(statModifier(10)).toBe(0)
    expect(statModifier(15)).toBe(2)
    expect(statModifier(7)).toBe(-2)
  })
})

describe('hit points', () => {
  it('level 1 max HP is between 12 and 31 (10 + 1..20 + 1)', () => {
    fc.assert(
      fc.property(d20, (roll) => {
        const max = hpMax(roll, 1, rules)
        expect(max).toBeGreaterThanOrEqual(12)
        expect(max).toBeLessThanOrEqual(31)
        expect(max).toBe(10 + roll + 1)
      }),
    )
  })

  it('gains +1 max HP per level (house rule), so max = 10 + roll + level', () => {
    fc.assert(
      fc.property(d20, level, (roll, lvl) => {
        expect(hpMax(roll, lvl, rules)).toBe(10 + roll + lvl)
      }),
    )
  })

  it('recovers the roll from a max (inverse)', () => {
    fc.assert(
      fc.property(d20, level, (roll, lvl) => {
        expect(hpRollFromMax(hpMax(roll, lvl, rules), lvl, rules)).toBe(roll)
      }),
    )
  })

  it('shows the formula parts', () => {
    expect(hpFormulaParts(14, 1, rules)).toEqual([10, 14, 1])
    expect(hpFormulaParts(14, 5, rules)).toEqual([10, 14, 1, 4])
  })

  it('never drops below 0 and damage consumes temporary HP first', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 60 }),
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: -100, max: 100 }),
        (current, temp, delta) => {
          const max = 60
          const next = applyHpDelta({ current, temp }, delta, max)
          expect(next.current).toBeGreaterThanOrEqual(0)
          expect(next.current).toBeLessThanOrEqual(max)
          expect(next.temp).toBeGreaterThanOrEqual(0)
          if (delta < 0) {
            const absorbed = Math.min(temp, -delta)
            expect(next.temp).toBe(temp - absorbed)
            if (-delta <= temp) expect(next.current).toBe(current)
          }
        },
      ),
    )
  })

  it('a level-up heals the HP it adds', () => {
    expect(adjustCurrentForNewMax(20, 25, 26)).toBe(21)
    expect(adjustCurrentForNewMax(0, 25, 24)).toBe(0)
  })

  it('classifies HP bands', () => {
    expect(hpBand(20, 20)).toBe('healthy')
    expect(hpBand(9, 20)).toBe('wounded')
    expect(hpBand(4, 20)).toBe('critical')
    expect(hpBand(0, 20)).toBe('down')
  })
})

describe('skills', () => {
  it('earns one extra skill every 10 levels', () => {
    expect(skillAllowance(1, rules)).toEqual({ active: 2, passive: 1, extra: 0, total: 3 })
    expect(skillAllowance(9, rules).extra).toBe(0)
    expect(skillAllowance(10, rules).extra).toBe(1)
    expect(skillAllowance(25, rules).total).toBe(5)
    expect(nextExtraSkillLevel(1, rules)).toBe(10)
    expect(nextExtraSkillLevel(10, rules)).toBe(20)
  })

  it('requires exactly 2 actives, 1 passive and 1 class passive for players', () => {
    const skills = (...kinds: ('active' | 'passive' | 'class')[]) => kinds.map((kind) => ({ kind }))
    expect(
      checkCreationSkills(skills('active', 'active', 'passive', 'class'), 'player', rules).ok,
    ).toBe(true)
    expect(checkCreationSkills(skills('active', 'passive', 'class'), 'player', rules).ok).toBe(
      false,
    )
    expect(
      checkCreationSkills(skills('active', 'active', 'active', 'passive', 'class'), 'player', rules)
        .ok,
    ).toBe(false)
    // Not enforced for enemies by default.
    expect(checkCreationSkills([], 'enemy', rules)).toMatchObject({ ok: true, enforced: false })
  })

  it('flags sheets with more skills than the level allows', () => {
    const four = [
      { kind: 'active' as const },
      { kind: 'active' as const },
      { kind: 'passive' as const },
      { kind: 'passive' as const },
    ]
    expect(isOverSkillAllowance(four, 9, rules)).toBe(true)
    expect(isOverSkillAllowance(four, 10, rules)).toBe(false)
  })
})

describe('checks (roll under)', () => {
  it('succeeds when d20 ≤ value', () => {
    expect(resolveCheck({ natural: 12, value: 12 }, rules)).toMatchObject({
      success: true,
      margin: 0,
    })
    expect(resolveCheck({ natural: 13, value: 12 }, rules)).toMatchObject({ success: false })
    expect(resolveCheck({ natural: 13, value: 12, bonus: 1 }, rules).success).toBe(true)
  })

  it('1 is a major and 2 a minor critical success', () => {
    expect(resolveCheck({ natural: 1, value: 10 }, rules).critical).toEqual({
      kind: 'success',
      tier: 'major',
    })
    expect(resolveCheck({ natural: 2, value: 10 }, rules).critical).toEqual({
      kind: 'success',
      tier: 'minor',
    })
  })

  it('20 is a major and 19 a minor critical failure', () => {
    expect(resolveCheck({ natural: 20, value: 10 }, rules).critical).toEqual({
      kind: 'failure',
      tier: 'major',
    })
    expect(resolveCheck({ natural: 19, value: 10 }, rules).critical).toEqual({
      kind: 'failure',
      tier: 'minor',
    })
  })

  it('critical faces override the comparison', () => {
    expect(resolveCheck({ natural: 2, value: 1 }, rules).success).toBe(true)
    expect(resolveCheck({ natural: 19, value: 20 }, rules).success).toBe(false)
  })

  it('outcome is consistent for every face and value (property)', () => {
    fc.assert(
      fc.property(d20, fc.integer({ min: 0, max: 30 }), (natural, value) => {
        const out = resolveCheck({ natural, value }, rules)
        if (natural <= 2) expect(out.success).toBe(true)
        else if (natural >= 19) expect(out.success).toBe(false)
        else expect(out.success).toBe(natural <= value)
      }),
    )
  })

  it('optionally widens critical success for high Luck', () => {
    const lucky = withRules((r) => (r.checks.luckWidening = { enabled: true, threshold: 18 }))
    expect(resolveCheck({ natural: 3, value: 10, luck: 18 }, lucky).critical).toEqual({
      kind: 'success',
      tier: 'minor',
    })
    expect(resolveCheck({ natural: 3, value: 10, luck: 17 }, lucky).critical).toBeNull()
  })
})

describe('checks (d20 + modifier)', () => {
  const over = withRules((r) => (r.checks.resolution = 'rollOver'))
  it('succeeds when d20 + modifier ≥ difficulty', () => {
    expect(resolveCheck({ natural: 10, value: 14, difficulty: 12 }, over)).toMatchObject({
      success: true,
      margin: 0,
    })
    expect(resolveCheck({ natural: 9, value: 14, difficulty: 12 }, over).success).toBe(false)
  })
})

describe('grid & config', () => {
  it('1 cell = 1 m by default', () => {
    expect(cellsToMeters(6, rules)).toBe(6)
  })

  it('fills missing or invalid rule keys with defaults', () => {
    const merged = withDefaultRules({ hp: { perLevel: 2 }, grid: { cellMeters: 'x' } })
    expect(merged.hp).toEqual({ base: 10, perLevel: 2 })
    expect(merged.grid.cellMeters).toBe(1)
    expect(merged.checks.criticalSuccess).toEqual({ major: [1], minor: [2] })
    expect(withDefaultRules(undefined)).toEqual(defaultRules())
  })
})
