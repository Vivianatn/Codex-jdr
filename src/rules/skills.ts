import type { EntityKind, SkillKind } from '@/domain/types'
import type { RulesConfig } from './config'

/**
 * Skills are free: the GM adds as many as they like, whenever they like.
 * Every N levels (`extraSkillEveryLevels`) the app only *reminds* the GM that a
 * new skill is due.
 */

/** Next level that triggers a "new skill" reminder, or null if reminders are off. */
export function nextExtraSkillLevel(level: number, rules: RulesConfig): number | null {
  const every = rules.skills.extraSkillEveryLevels
  if (every <= 0) return null
  return (Math.floor(Math.max(0, level) / every) + 1) * every
}

export interface SkillCounts {
  active: number
  passive: number
  class: number
}

export function countSkills(skills: readonly { kind: SkillKind }[]): SkillCounts {
  const counts: SkillCounts = { active: 0, passive: 0, class: 0 }
  for (const skill of skills) counts[skill.kind]++
  return counts
}

export interface CreationSkillCheck {
  counts: SkillCounts
  required: SkillCounts
  ok: boolean
  /** Whether the rule applies to this kind at all. */
  enforced: boolean
}

/** At creation: exactly 2 actives, 1 passive and 1 class passive (by default). */
export function checkCreationSkills(
  skills: readonly { kind: SkillKind }[],
  kind: EntityKind,
  rules: RulesConfig,
): CreationSkillCheck {
  const counts = countSkills(skills)
  const required: SkillCounts = {
    active: rules.skills.initialActive,
    passive: rules.skills.initialPassive,
    class: 1,
  }
  const enforced = rules.skills.enforceOnCreation.includes(kind)
  const exact =
    counts.active === required.active &&
    counts.passive === required.passive &&
    counts.class === required.class
  return { counts, required, enforced, ok: !enforced || exact }
}

/** Reminder levels crossed when going from `from` to `to` (e.g. 9 → 21 gives [10, 20]). */
export function skillMilestonesReached(from: number, to: number, rules: RulesConfig): number[] {
  const every = rules.skills.extraSkillEveryLevels
  if (every <= 0 || to <= from) return []
  const first = (Math.floor(Math.max(0, from) / every) + 1) * every
  const levels: number[] = []
  for (let level = first; level <= to; level += every) levels.push(level)
  return levels
}
