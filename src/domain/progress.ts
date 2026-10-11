import { roll, type Rng } from '@/dice'
import { clampHp, hpMax, type CheckOutcome, type RulesConfig } from '@/rules'
import { effectiveStats } from './entity'
import { DISPOSITIONS, type Disposition, type Entity, type Skill } from './types'

// ---------------------------------------------------------------------------
// Experience (SPEC §4.1)
// ---------------------------------------------------------------------------

/** Total XP needed to reach `level` (level 1 = 0). Going from L to L+1 costs perLevel × L. */
export function xpForLevel(level: number, rules: RulesConfig): number {
  const l = Math.max(1, Math.floor(level))
  return (rules.xp.perLevel * (l - 1) * l) / 2
}

/** Highest level reachable with `xp`. */
export function levelForXp(xp: number, rules: RulesConfig): number {
  if (rules.xp.perLevel <= 0) return 1
  let level = 1
  while (xpForLevel(level + 1, rules) <= xp) level++
  return level
}

export interface XpProgress {
  /** XP earned inside the current level. */
  into: number
  /** XP the current level spans. */
  span: number
  ratio: number
  /** Levels that can be gained right now (0 if none). */
  pendingLevels: number
}

export function xpProgress(level: number, xp: number, rules: RulesConfig): XpProgress {
  const start = xpForLevel(level, rules)
  const end = xpForLevel(level + 1, rules)
  const span = Math.max(1, end - start)
  const into = Math.max(0, xp - start)
  return {
    into,
    span,
    ratio: Math.min(1, into / span),
    pendingLevels: Math.max(0, levelForXp(xp, rules) - level),
  }
}

// ---------------------------------------------------------------------------
// Luck points (SPEC §4.9)
// ---------------------------------------------------------------------------

export function luckPointsMax(entity: Entity, rules: RulesConfig): number {
  if (rules.luck.pointsPerLuck <= 0) return 0
  return Math.floor(effectiveStats(entity, rules).luck.total / rules.luck.pointsPerLuck)
}

export function luckPointsLeft(entity: Entity, rules: RulesConfig): number {
  return Math.max(0, luckPointsMax(entity, rules) - entity.luckSpent)
}

// ---------------------------------------------------------------------------
// Disposition (SPEC §4.7)
// ---------------------------------------------------------------------------

/**
 * Social check on an NPC: success moves the gauge up, failure down;
 * major criticals move it further.
 */
export function shiftDisposition(
  current: Disposition,
  outcome: Pick<CheckOutcome, 'success' | 'critical'>,
  rules: RulesConfig,
): Disposition {
  const major = outcome.critical?.tier === 'major'
  const steps =
    (major ? rules.disposition.criticalStep : rules.disposition.step) * (outcome.success ? 1 : -1)
  const index = DISPOSITIONS.indexOf(current) + steps
  return DISPOSITIONS[Math.min(DISPOSITIONS.length - 1, Math.max(0, index))]!
}

// ---------------------------------------------------------------------------
// Rests & fatigue (SPEC §4.4)
// ---------------------------------------------------------------------------

export function setExhaustion<E extends Entity>(entity: E, level: number, rules: RulesConfig): E {
  return {
    ...entity,
    exhaustion: Math.min(rules.fatigue.maxExhaustion, Math.max(0, Math.round(level))),
  }
}

/** Short rest: heals the configured dice. Returns the healed amount too. */
export function shortRest<E extends Entity>(
  entity: E,
  rules: RulesConfig,
  rng?: Rng,
): { entity: E; healed: number; breakdown: string } {
  const r = roll(rules.fatigue.shortRestHeal, { rng, rounding: rules.stats.rounding })
  const max = hpMax(entity.hp.roll, entity.level, rules)
  const current = clampHp(entity.hp.current + Math.max(0, r.total), max)
  return {
    entity: { ...entity, hp: { ...entity.hp, current } },
    healed: current - entity.hp.current,
    breakdown: r.breakdown,
  }
}

/**
 * Long rest: full HP, temporary HP lost, one exhaustion level less, luck points
 * and skill uses restored, cooldowns reset.
 */
export function longRest<E extends Entity>(entity: E, rules: RulesConfig): E {
  return {
    ...entity,
    hp: { ...entity.hp, current: hpMax(entity.hp.roll, entity.level, rules), temp: 0 },
    exhaustion: Math.max(0, entity.exhaustion - 1),
    luckSpent: 0,
    skills: entity.skills.map((s) => ({ ...s, usesLeft: s.usesMax, cooldownLeft: 0 })),
  }
}

// ---------------------------------------------------------------------------
// Active skills (SPEC §4.12)
// ---------------------------------------------------------------------------

export type SkillBlock = 'cooldown' | 'noUses' | null

export function skillBlock(skill: Skill): SkillBlock {
  if (skill.cooldownLeft > 0) return 'cooldown'
  if (skill.usesLeft !== null && skill.usesLeft <= 0) return 'noUses'
  return null
}

/** Marks a skill as used: starts its cooldown and spends one use. */
export function spendSkill<E extends Entity>(entity: E, skillId: string): E {
  return {
    ...entity,
    skills: entity.skills.map((s) =>
      s.id === skillId
        ? {
            ...s,
            cooldownLeft: s.cooldown,
            usesLeft: s.usesLeft === null ? null : Math.max(0, s.usesLeft - 1),
          }
        : s,
    ),
  }
}
