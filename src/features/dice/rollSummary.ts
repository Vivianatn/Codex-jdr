import type { RollRecord } from '@/domain/rolls'
import type { Messages } from '@/i18n/locales/fr'

/** One-line summary of a roll for journals ("Discrétion : 14, réussite"). */
export function rollSummary(t: Messages, roll: RollRecord): string {
  if (!roll.check) return `${roll.label} : ${roll.total}`
  const { outcome, natural } = roll.check
  const result = outcome.critical
    ? outcome.critical.kind === 'success'
      ? t.dice.critSuccess[outcome.critical.tier]
      : t.dice.critFailure[outcome.critical.tier]
    : outcome.success
      ? t.dice.success
      : t.dice.failure
  return t.journal.check(roll.label, natural, result)
}
