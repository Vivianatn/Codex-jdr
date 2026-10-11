import type { RollRecord } from '@/domain/rolls'
import { useT } from '@/i18n'

/** Outcome text of a check, or null for plain rolls. */
export function useOutcomeText(
  record: RollRecord,
): { text: string; tone: 'gold' | 'red' | 'success' | 'failure' } | null {
  const t = useT()
  const outcome = record.check?.outcome
  if (!outcome) return null
  if (outcome.critical?.kind === 'success')
    return { text: t.dice.critSuccess[outcome.critical.tier], tone: 'gold' }
  if (outcome.critical?.kind === 'failure')
    return { text: t.dice.critFailure[outcome.critical.tier], tone: 'red' }
  return outcome.success
    ? { text: t.dice.success, tone: 'success' }
    : { text: t.dice.failure, tone: 'failure' }
}
