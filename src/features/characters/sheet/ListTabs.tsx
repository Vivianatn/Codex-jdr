import { GameIcon } from '@/components/GameIcon'
import { useShallow } from 'zustand/react/shallow'
import type { Entity } from '@/domain/types'
import { formatRelativeTime, useIntlLocale, useT } from '@/i18n'
import { useRollStore } from '@/stores/rollStore'
import { rollSummary } from '@/features/dice/rollSummary'

/** Journal (SPEC §2.2): sheet events and this character's rolls, newest first. */
export function JournalTab({ entity }: { entity: Entity }) {
  const t = useT()
  const intl = useIntlLocale()
  const rolls = useRollStore(useShallow((s) => s.rolls.filter((r) => r.entityId === entity.id)))
  const entries = [
    ...entity.journal.map((e) => ({ id: e.id, at: e.at, text: e.text, roll: false })),
    ...rolls.map((r) => ({
      id: r.id,
      at: r.at,
      roll: true,
      text: rollSummary(t, r),
    })),
  ].sort((a, b) => b.at - a.at)
  if (entries.length === 0) return <p className="text-sm text-ink-muted">{t.journal.empty}</p>
  return (
    <ol className="space-y-2">
      {entries.map((entry) => (
        <li key={entry.id} className="flex gap-3 text-sm">
          {entry.roll ? (
            <GameIcon
              name="rolling-dices"
              className="mt-0.5 size-3.5 shrink-0 text-accent-text"
              aria-hidden
            />
          ) : (
            <span className="mt-1.5 size-1.5 shrink-0 rotate-45 bg-gold" aria-hidden />
          )}
          <span className="flex-1 text-ink">{entry.text}</span>
          <time
            dateTime={new Date(entry.at).toISOString()}
            className="shrink-0 text-xs text-ink-muted"
          >
            {formatRelativeTime(entry.at, intl, t.time.justNow)}
          </time>
        </li>
      ))}
    </ol>
  )
}
