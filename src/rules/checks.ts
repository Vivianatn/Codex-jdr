import type { CriticalFaces, RulesConfig } from './config'
import { statModifier } from './stats'

export type CriticalTier = 'major' | 'minor'

export interface CheckInput {
  /** The natural d20 result. */
  natural: number
  /** Effective characteristic value. */
  value: number
  /** Circumstance bonus/malus. */
  bonus?: number
  /** Difficulty, only used by the rollOver method. */
  difficulty?: number
  /** Effective Luck of the roller, for the optional widened critical. */
  luck?: number
}

export interface CheckOutcome {
  success: boolean
  critical: { kind: 'success' | 'failure'; tier: CriticalTier } | null
  /** rollUnder: target − natural. rollOver: total − difficulty. Positive = success margin. */
  margin: number
}

function tierOf(face: number, faces: CriticalFaces): CriticalTier | null {
  if (faces.major.includes(face)) return 'major'
  if (faces.minor.includes(face)) return 'minor'
  return null
}

/** Critical success faces, widened by one face for very lucky characters if enabled. */
export function criticalSuccessFaces(rules: RulesConfig, luck?: number): CriticalFaces {
  const faces = rules.checks.criticalSuccess
  const widening = rules.checks.luckWidening
  if (!widening.enabled || luck === undefined || luck < widening.threshold) return faces
  const highest = Math.max(0, ...faces.major, ...faces.minor)
  return { major: faces.major, minor: [...faces.minor, highest + 1] }
}

/**
 * Resolves a characteristic check. Natural critical faces always win over the
 * comparison: with the default rules a natural 2 succeeds even under a 1, and a
 * natural 19 fails even under a 20.
 */
export function resolveCheck(input: CheckInput, rules: RulesConfig): CheckOutcome {
  const bonus = input.bonus ?? 0
  let success: boolean
  let margin: number
  if (rules.checks.resolution === 'rollUnder') {
    const target = input.value + bonus
    margin = target - input.natural
    success = input.natural <= target
  } else {
    const total = input.natural + statModifier(input.value) + bonus
    margin = total - (input.difficulty ?? 10)
    success = margin >= 0
  }

  const successTier = tierOf(input.natural, criticalSuccessFaces(rules, input.luck))
  if (successTier)
    return { success: true, critical: { kind: 'success', tier: successTier }, margin }
  const failureTier = tierOf(input.natural, rules.checks.criticalFailure)
  if (failureTier)
    return { success: false, critical: { kind: 'failure', tier: failureTier }, margin }
  return { success, critical: null, margin }
}
