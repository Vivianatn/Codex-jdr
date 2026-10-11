import type { EntityKind, SkillKind } from '@/domain/types'
import type { RulesConfig } from './config'

export interface SkillAllowance {
  active: number
  passive: number
  /** Extra skills earned by level, each either active or passive. */
  extra: number
  /** active + passive + extra (the class passive is not counted). */
  total: number
}

export function skillAllowance(level: number, rules: RulesConfig): SkillAllowance {
  const every = rules.skills.extraSkillEveryLevels
  const extra = every > 0 ? Math.floor(Math.max(0, level) / every) : 0
  const { initialActive: active, initialPassive: passive } = rules.skills
  return { active, passive, extra, total: active + passive + extra }
}

/** Level at which the next extra skill is earned, or null if the rule is off. */
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

/** On an existing sheet: more active/passive skills than the level allows (warning only). */
export function isOverSkillAllowance(
  skills: readonly { kind: SkillKind }[],
  level: number,
  rules: RulesConfig,
): boolean {
  const counts = countSkills(skills)
  return counts.active + counts.passive > skillAllowance(level, rules).total
}
