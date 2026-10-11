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
}

/** Rules confirmed by the GM on 2026-10-11 (see docs/DECISIONS.md D-101). */
export const DEFAULT_RULES: RulesConfig = {
  version: 1,
  stats: { rounding: 'ceil', min: 1, max: 20 },
  hp: { base: 10, perLevel: 1 },
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
