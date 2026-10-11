import { naturalD20, roll, type RollResult, type Rng } from '@/dice'
import { resolveCheck, type CheckOutcome, type RulesConfig } from '@/rules'
import { effectiveStats } from './entity'
import type { Entity, StatKey } from './types'

export type RollMode = 'normal' | 'advantage' | 'disadvantage'

export interface CheckOptions {
  mode?: RollMode
  /** Circumstance bonus / malus. */
  bonus?: number
  /** Difficulty for the "d20 + modifier" method (and item identification). */
  difficulty?: number
  rng?: Rng
}

export interface CheckRoll {
  stat: StatKey
  /** Effective characteristic value. */
  value: number
  /** Total bonus applied (circumstance − exhaustion). */
  bonus: number
  mode: RollMode
  natural: number
  dice: RollResult
  outcome: CheckOutcome
}

/** d20 expression for a roll mode: 1d20, 2d20kh1 (advantage), 2d20kl1 (disadvantage). */
export function d20For(mode: RollMode): string {
  return mode === 'advantage' ? '2d20kh1' : mode === 'disadvantage' ? '2d20kl1' : '1d20'
}

/**
 * A characteristic check (SPEC §4): d20 under the effective value by default,
 * with advantage/disadvantage, circumstance bonus and the exhaustion malus.
 */
export function performCheck(
  entity: Entity,
  stat: StatKey,
  rules: RulesConfig,
  options: CheckOptions = {},
): CheckRoll {
  const mode = options.mode ?? 'normal'
  const stats = effectiveStats(entity, rules)
  const bonus = (options.bonus ?? 0) - entity.exhaustion * rules.fatigue.checkPenaltyPerLevel
  const dice = roll(d20For(mode), { rng: options.rng })
  const natural = naturalD20(dice) ?? dice.total
  const outcome = resolveCheck(
    {
      natural,
      value: stats[stat].total,
      bonus,
      difficulty: options.difficulty,
      luck: stats.luck.total,
    },
    rules,
  )
  return { stat, value: stats[stat].total, bonus, mode, natural, dice, outcome }
}

export type OpposedWinner = 'first' | 'second' | 'tie'

/**
 * Opposed check (arm wrestling, grapple…): a success beats a failure, a
 * critical success beats a plain one, then the larger margin wins.
 */
export function opposedWinner(a: CheckOutcome, b: CheckOutcome): OpposedWinner {
  const score = (o: CheckOutcome) =>
    (o.success ? 2 : 0) +
    (o.critical?.kind === 'success' ? (o.critical.tier === 'major' ? 2 : 1) : 0) -
    (o.critical?.kind === 'failure' ? (o.critical.tier === 'major' ? 2 : 1) : 0)
  const diff = score(a) - score(b) || a.margin - b.margin
  return diff > 0 ? 'first' : diff < 0 ? 'second' : 'tie'
}

// ---------------------------------------------------------------------------
// Quick HP input (SPEC §4.2): "-7", "+5", "t+4", "-2d6"
// ---------------------------------------------------------------------------

export interface HpInput {
  kind: 'damage' | 'heal' | 'temp'
  /** Number or dice expression, without sign. */
  expression: string
}

/** A bare number counts as damage (the most common action in play). */
export function parseHpInput(text: string): HpInput | null {
  const t = text.trim().toLowerCase().replace(/\s+/g, '')
  if (!t) return null
  const temp = t.match(/^t\+?(.+)$/)
  if (temp) return { kind: 'temp', expression: temp[1]! }
  if (t.startsWith('+')) return t.length > 1 ? { kind: 'heal', expression: t.slice(1) } : null
  if (t.startsWith('-')) return t.length > 1 ? { kind: 'damage', expression: t.slice(1) } : null
  return { kind: 'damage', expression: t }
}

/**
 * Quick characteristic edit (D-234): "-2" / "+1" change the base value,
 * a bare number sets it. Returns the new base value, or null if unreadable.
 */
export function parseStatInput(text: string, base: number): number | null {
  const m = text.trim().replace(/\s+/g, '').match(/^([+-]?)(\d{1,3})$/)
  if (!m) return null
  const n = Number(m[2])
  return m[1] === '+' ? base + n : m[1] === '-' ? base - n : n
}
