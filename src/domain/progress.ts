import { roll, type Rng } from '@/dice'
import { clampHp, hpMaxAt, type CheckOutcome, type RulesConfig } from '@/rules'
import { effectiveStats } from './entity'
import { DISPOSITIONS, type Disposition, type Entity, type Skill } from './types'
import { clamp } from '@/lib/numbers'

// ---------------------------------------------------------------------------
// Experience (SPEC §4.1)
// ---------------------------------------------------------------------------

/** Whether the GM configured XP thresholds (otherwise XP is a plain counter). */
export function hasXpThresholds(rules: RulesConfig): boolean {
  const { mode, perLevel, table } = rules.xp
  return (mode === 'linear' && perLevel > 0) || (mode === 'table' && table.length > 0)
}

/**
 * Total XP needed to reach `level` (level 1 = 0), or null when unknown
 * (no thresholds, or beyond the end of the GM's table).
 */
export function xpForLevel(level: number, rules: RulesConfig): number | null {
  const l = Math.max(1, Math.floor(level))
  if (l === 1) return 0
  if (rules.xp.mode === 'linear' && rules.xp.perLevel > 0)
    return (rules.xp.perLevel * (l - 1) * l) / 2
  if (rules.xp.mode === 'table') return rules.xp.table[l - 2] ?? null
  return null
}

/** Highest level reachable with `xp` (1 when there are no thresholds). */
export function levelForXp(xp: number, rules: RulesConfig): number {
  if (!hasXpThresholds(rules)) return 1
  let level = 1
  for (;;) {
    const next = xpForLevel(level + 1, rules)
    if (next === null || next > xp || level >= 1000) return level
    level++
  }
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

/** Progress towards the next level, or null when there is no next threshold. */
export function xpProgress(level: number, xp: number, rules: RulesConfig): XpProgress | null {
  const start = xpForLevel(level, rules)
  const end = xpForLevel(level + 1, rules)
  if (start === null || end === null) return null
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
  return DISPOSITIONS[clamp(index, 0, DISPOSITIONS.length - 1)]!
}

// ---------------------------------------------------------------------------
// Rests & fatigue (SPEC §4.4)
// ---------------------------------------------------------------------------

/** Whether the GM enabled each rest (otherwise its button is hidden). */
export function restsAvailable(rules: RulesConfig): { short: boolean; long: boolean } {
  return {
    short: rules.rests.shortRestHeal.trim() !== '',
    long: Object.values(rules.rests.longRest).some(Boolean),
  }
}

export function setExhaustion<E extends Entity>(entity: E, level: number, rules: RulesConfig): E {
  return {
    ...entity,
    exhaustion: clamp(Math.round(level), 0, rules.fatigue.maxExhaustion),
  }
}

/** Short rest: heals the configured dice. Returns the healed amount too. */
export function shortRest<E extends Entity>(
  entity: E,
  rules: RulesConfig,
  rng?: Rng,
): { entity: E; healed: number; breakdown: string } {
  const r = roll(rules.rests.shortRestHeal, { rng, rounding: rules.stats.rounding })
  const max = hpMaxAt(entity.hp, entity.level, rules)
  const current = clampHp(entity.hp.current + Math.max(0, r.total), max)
  return {
    entity: { ...entity, hp: { ...entity.hp, current } },
    healed: current - entity.hp.current,
    breakdown: r.breakdown,
  }
}

/** Long rest: does exactly what the GM ticked in the rules. */
export function longRest<E extends Entity>(entity: E, rules: RulesConfig): E {
  const r = rules.rests.longRest
  return {
    ...entity,
    hp: {
      ...entity.hp,
      current: r.fullHp ? hpMaxAt(entity.hp, entity.level, rules) : entity.hp.current,
      temp: r.clearTempHp ? 0 : entity.hp.temp,
    },
    exhaustion: r.reduceExhaustion ? Math.max(0, entity.exhaustion - 1) : entity.exhaustion,
    luckSpent: r.restoreLuck ? 0 : entity.luckSpent,
    skills: r.restoreSkills
      ? entity.skills.map((s) => ({ ...s, usesLeft: s.usesMax, cooldownLeft: 0 }))
      : entity.skills,
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
