import type { RulesConfig } from './config'

/** `2d20 / 2` with the campaign's rounding rule. */
export function statFromDice(a: number, b: number, rules: RulesConfig): number {
  const half = (a + b) / 2
  switch (rules.stats.rounding) {
    case 'ceil':
      return Math.ceil(half)
    case 'floor':
      return Math.floor(half)
    case 'half':
      return half
  }
}

export function isValidStat(value: number, rules: RulesConfig): boolean {
  return Number.isFinite(value) && value >= rules.stats.min && value <= rules.stats.max
}

export function isValidDie(value: number, faces = 20): boolean {
  return Number.isInteger(value) && value >= 1 && value <= faces
}

/** Base value plus every active modifier, never below 0. */
export function effectiveStat(base: number, modifiers: readonly number[]): number {
  return Math.max(0, base + modifiers.reduce((sum, m) => sum + m, 0))
}

/** Modifier used by the "d20 + modifier" resolution method. */
export function statModifier(value: number): number {
  return Math.floor((value - 10) / 2)
}
