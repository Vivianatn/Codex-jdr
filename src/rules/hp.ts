import type { RulesConfig } from './config'

/**
 * Max HP = `base + roll + 1` at level 1 (the sheet's `10 + 1d20 + Nv`),
 * then `perLevel` for each level gained.
 */
export function hpMax(roll: number, level: number, rules: RulesConfig): number {
  const levels = Math.max(1, Math.floor(level))
  return rules.hp.base + roll + 1 + (levels - 1) * rules.hp.perLevel
}

/** What max HP depends on: the d20, or a max given directly at some level. */
export interface HpSource {
  roll: number
  /** Max HP given directly (character created before Codex); null = use the d20. */
  fixedMax: number | null
  /** Level at which `fixedMax` was given. */
  fixedLevel: number
}

/**
 * Max HP at `level`: from the d20 (`hpMax`), or from a given max plus
 * `perLevel` for each level gained (or lost) since it was given.
 */
export function hpMaxAt(hp: HpSource, level: number, rules: RulesConfig): number {
  if (hp.fixedMax === null) return hpMax(hp.roll, level, rules)
  const levels = Math.max(1, Math.floor(level)) - Math.max(1, hp.fixedLevel)
  return Math.max(1, hp.fixedMax + levels * rules.hp.perLevel)
}

/** Inverse of hpMax: recovers the d20 roll from a known max (Discord import). */
export function hpRollFromMax(max: number, level: number, rules: RulesConfig): number {
  return max - hpMax(0, level, rules)
}

/** Shown under the HP field: "10 + 14 + 1" (+ "+ 4" for levels gained). */
export function hpFormulaParts(roll: number, level: number, rules: RulesConfig): number[] {
  const parts = [rules.hp.base, roll, 1]
  const gained = (Math.max(1, Math.floor(level)) - 1) * rules.hp.perLevel
  if (gained !== 0) parts.push(gained)
  return parts
}

export function clampHp(current: number, max: number): number {
  return Math.min(Math.max(0, Math.round(current)), Math.max(0, max))
}

/**
 * When max HP changes (level up/down), current HP moves by the same amount,
 * so a level-up heals the HP it adds.
 */
export function adjustCurrentForNewMax(current: number, oldMax: number, newMax: number): number {
  return clampHp(current + (newMax - oldMax), newMax)
}

/** Damage eats temporary HP first; healing never exceeds max. */
export function applyHpDelta(
  hp: { current: number; temp: number },
  delta: number,
  max: number,
): { current: number; temp: number } {
  if (delta >= 0) return { current: clampHp(hp.current + delta, max), temp: hp.temp }
  const damage = -delta
  const absorbed = Math.min(hp.temp, damage)
  return { current: clampHp(hp.current - (damage - absorbed), max), temp: hp.temp - absorbed }
}

export type HpBand = 'healthy' | 'wounded' | 'critical' | 'down'

/** Green above 50 %, amber below, red below 25 %, "à terre" at 0 (thresholds from the rules). */
export function hpBand(
  current: number,
  max: number,
  thresholds: Pick<RulesConfig['hp'], 'woundedBelow' | 'criticalBelow'> = {
    woundedBelow: 0.5,
    criticalBelow: 0.25,
  },
): HpBand {
  if (current <= 0) return 'down'
  const ratio = max > 0 ? current / max : 0
  if (ratio < thresholds.criticalBelow) return 'critical'
  if (ratio < thresholds.woundedBelow) return 'wounded'
  return 'healthy'
}
