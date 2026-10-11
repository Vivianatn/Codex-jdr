import type { EntityKind } from '@/domain/types'

/**
 * Every house rule lives here and is configurable per campaign
 * (Préparation › Règles). Components never hard-code a rule.
 */

export type StatRounding = 'ceil' | 'floor' | 'half'
export type Resolution = 'rollUnder' | 'rollOver'

/** Natural d20 faces; `major` is "more critical" than `minor`. */
export interface CriticalFaces {
  major: number[]
  minor: number[]
}

export interface RulesConfig {
  version: 1
  stats: {
    /** How `2d20 / 2` is rounded when the two dice are entered. */
    rounding: StatRounding
    min: number
    max: number
  }
  hp: {
    /** Level 1: `base + 1d20 + 1`. */
    base: number
    /** Max HP gained per level after the first. */
    perLevel: number
    /** HP ratio under which a character is "Blessé" / "Critique" (0 HP = "À terre"). */
    woundedBelow: number
    criticalBelow: number
  }
  checks: {
    /** rollUnder: success if d20 ≤ value. rollOver: d20 + modifier ≥ difficulty. */
    resolution: Resolution
    criticalSuccess: CriticalFaces
    criticalFailure: CriticalFaces
    /** Optional: high Luck adds the next face as a minor critical success. */
    luckWidening: { enabled: boolean; threshold: number }
  }
  skills: {
    initialActive: number
    initialPassive: number
    /** Remind the GM to add a skill every N levels (no limit is enforced); 0 disables it. */
    extraSkillEveryLevels: number
    /** Kinds for which the creation wizard requires the exact starting skills. */
    enforceOnCreation: EntityKind[]
  }
  grid: {
    cellMeters: number
  }
  combat: {
    /** Melee damage gets the Strength modifier, floor((FOR − 10) / 2). */
    strengthDamageBonus: boolean
    /** Damage dice when no weapon is equipped. */
    unarmedDamage: string
  }
  carry: {
    /** Carrying capacity in kg per point of effective Strength. */
    kgPerStrength: number
    /** Dexterity malus while "Surchargé". */
    overloadedDexPenalty: number
  }
  fatigue: {
    maxExhaustion: number
    /** Malus applied to every check per exhaustion level. */
    checkPenaltyPerLevel: number
    /** HP recovered by a short rest (dice expression). A long rest restores everything. */
    shortRestHeal: string
  }
  luck: {
    /** One luck point per N points of effective Luck. */
    pointsPerLuck: number
  }
  xp: {
    /** XP needed to go from level L to L + 1 = perLevel × L. */
    perLevel: number
  }
  disposition: {
    /** Gauge steps moved by a social check (success / major critical). */
    step: number
    criticalStep: number
  }
  /** Coins, largest first; `value` in the smallest unit. */
  currency: { id: string; name: string; short: string; value: number }[]
}

/** Rules confirmed by the GM on 2026-10-11 (see docs/DECISIONS.md D-101). */
export const DEFAULT_RULES: RulesConfig = {
  version: 1,
  stats: { rounding: 'ceil', min: 1, max: 20 },
  hp: { base: 10, perLevel: 1, woundedBelow: 0.5, criticalBelow: 0.25 },
  checks: {
    resolution: 'rollUnder',
    criticalSuccess: { major: [1], minor: [2] },
    criticalFailure: { major: [20], minor: [19] },
    luckWidening: { enabled: false, threshold: 18 },
  },
  skills: {
    initialActive: 2,
    initialPassive: 1,
    extraSkillEveryLevels: 10,
    enforceOnCreation: ['player'],
  },
  grid: { cellMeters: 1 },
  // Phase 2 defaults (not decided by the GM yet, see DECISIONS D-201).
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

export function defaultRules(): RulesConfig {
  return structuredClone(DEFAULT_RULES)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Fills missing keys with defaults (older saves, hand-edited exports).
 * Keys whose type does not match the default are replaced by the default.
 */
export function withDefaultRules(input: unknown): RulesConfig {
  const merge = (base: unknown, value: unknown): unknown => {
    if (Array.isArray(base)) return Array.isArray(value) ? value : base
    if (isRecord(base)) {
      const source = isRecord(value) ? value : {}
      return Object.fromEntries(Object.entries(base).map(([k, v]) => [k, merge(v, source[k])]))
    }
    return typeof value === typeof base ? value : base
  }
  return merge(defaultRules(), input) as RulesConfig
}
