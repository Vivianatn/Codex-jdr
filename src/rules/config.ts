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
    /** How the ruler counts diagonals on square grids (D-228). */
    diagonal: 'euclidean' | 'chebyshev' | 'alternate'
  }
  movement: {
    /** Movement range shown when dragging a token: base + Dexterity × perDexterity cells; both 0 = off. */
    baseCells: number
    perDexterity: number
  }
  /*
   * Everything below is OFF by default: Codex imposes no mechanic the GM has
   * not chosen (D-217). 0, '' or false = feature disabled / hidden.
   */
  combat: {
    /** Add floor((FOR − 10) / 2) to melee damage. */
    strengthDamageBonus: boolean
    /** Damage dice when no weapon is equipped; '' = the GM types the damage. */
    unarmedDamage: string
  }
  defense: {
    /** Defense = (effective Dexterity if enabled) + (equipment bonuses if enabled). Both off = hidden. */
    fromDexterity: boolean
    fromEquipment: boolean
  }
  carry: {
    /** Capacity in kg per point of Strength; 0 = no capacity, no "Surchargé". */
    kgPerStrength: number
    /** Dexterity malus while "Surchargé"; 0 = none. */
    overloadedDexPenalty: number
  }
  fatigue: {
    /** 0 = no exhaustion tracker. */
    maxExhaustion: number
    /** Malus to every check per exhaustion level. */
    checkPenaltyPerLevel: number
  }
  rests: {
    /** HP healed by a short rest (dice); '' = no short rest button. */
    shortRestHeal: string
    /** What a long rest does; all false = no long rest button. */
    longRest: {
      fullHp: boolean
      clearTempHp: boolean
      reduceExhaustion: boolean
      restoreLuck: boolean
      restoreSkills: boolean
    }
  }
  luck: {
    /** One luck point per N points of effective Luck; 0 = no luck points. */
    pointsPerLuck: number
  }
  xp: {
    /** none: XP is only a counter, levels change by hand. */
    mode: 'none' | 'linear' | 'table'
    /** linear: going from level N to N+1 costs perLevel × N XP. */
    perLevel: number
    /** table: total XP needed for level 2, 3, 4… */
    table: number[]
  }
  disposition: {
    /** Gauge steps moved by a social check (success / major critical); 0 = the GM moves it by hand. */
    step: number
    criticalStep: number
  }
  /** Coins, any order; `value` in the smallest unit. Empty = the purse is a plain number. */
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
  grid: { cellMeters: 1, diagonal: 'euclidean' },
  movement: { baseCells: 0, perDexterity: 0 },
  combat: { strengthDamageBonus: false, unarmedDamage: '' },
  defense: { fromDexterity: false, fromEquipment: false },
  carry: { kgPerStrength: 0, overloadedDexPenalty: 0 },
  fatigue: { maxExhaustion: 0, checkPenaltyPerLevel: 0 },
  rests: {
    shortRestHeal: '',
    longRest: {
      fullHp: false,
      clearTempHp: false,
      reduceExhaustion: false,
      restoreLuck: false,
      restoreSkills: false,
    },
  },
  luck: { pointsPerLuck: 0 },
  xp: { mode: 'none', perLevel: 0, table: [] },
  disposition: { step: 0, criticalStep: 0 },
  currency: [],
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
  const merged = merge(defaultRules(), input) as RulesConfig
  if (!['none', 'linear', 'table'].includes(merged.xp.mode)) merged.xp.mode = 'none'
  if (!['euclidean', 'chebyshev', 'alternate'].includes(merged.grid.diagonal))
    merged.grid.diagonal = 'euclidean'
  return merged
}

/**
 * Phase-2 builds wrote invented defaults into every campaign. The GM rejected
 * them all (D-217): any rule group still equal to those values is reset to
 * "off". Used once — by the v4 migration and when importing a v3 file —
 * never at runtime, so a GM who later picks the same numbers keeps them.
 */
export function dropLegacyPhase2Defaults(input: unknown): RulesConfig {
  if (!isRecord(input)) return withDefaultRules(input)
  const legacy: Record<string, unknown> = {
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
  const cleaned = { ...input }
  for (const [key, value] of Object.entries(legacy))
    if (JSON.stringify(cleaned[key]) === JSON.stringify(value)) delete cleaned[key]
  // An old "linear" XP curve with a custom value keeps working.
  const xp = cleaned.xp
  if (isRecord(xp) && typeof xp.perLevel === 'number' && xp.perLevel > 0 && !('mode' in xp))
    cleaned.xp = { ...xp, mode: 'linear' }
  // An old custom short rest moves to the new place.
  const fatigue = cleaned.fatigue
  if (isRecord(fatigue) && typeof fatigue.shortRestHeal === 'string' && !isRecord(cleaned.rests))
    cleaned.rests = { shortRestHeal: fatigue.shortRestHeal }
  return withDefaultRules(cleaned)
}
