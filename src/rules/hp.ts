import type { RulesConfig } from './config'

/**
 * Max HP = `base + roll + 1` at level 1 (the sheet's `10 + 1d20 + Nv`),
 * then `perLevel` for each level gained.
 */
export function hpMax(roll: number, level: number, rules: RulesConfig): number {
  const levels = Math.max(1, Math.floor(level))
  return rules.hp.base + roll + 1 + (levels - 1) * rules.hp.perLevel
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

/** Green above 50 %, amber below, red below 25 %, "à terre" at 0. */
export function hpBand(current: number, max: number): HpBand {
  if (current <= 0) return 'down'
  const ratio = max > 0 ? current / max : 0
  if (ratio < 0.25) return 'critical'
  if (ratio < 0.5) return 'wounded'
  return 'healthy'
}
