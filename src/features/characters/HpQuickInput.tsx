import { useId, useState } from 'react'
import { useGameActions } from '@/features/game/useGameActions'
import { useT } from '@/i18n'
import { cn } from '@/lib/cn'

/**
 * One field for every HP change (SPEC §4.2): "-7", "+5", "t+4", "-2d6".
 * Enter applies it; the field clears so the next hit can be typed at once.
 */
export function HpQuickInput({
  entityId,
  name,
  compact = false,
  className,
}: {
  entityId: string
  name: string
  compact?: boolean
  className?: string
}) {
  const t = useT()
  const actions = useGameActions()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const id = useId()
  const hintId = `${id}-hint`

  function apply() {
    if (!value.trim()) return
    const problem = actions.applyHpText(entityId, value)
    setError(problem)
    if (!problem) setValue('')
  }

  return (
    <div className={cn('min-w-0', className)}>
      <label htmlFor={id} className="sr-only">
        {t.hp.quick(name)}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          setError(null)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            apply()
          }
          if (e.key === 'Escape') setValue('')
        }}
        onBlur={() => setError(null)}
        placeholder={t.hp.quickPlaceholder}
        aria-describedby={hintId}
        aria-invalid={error ? true : undefined}
        autoComplete="off"
        className={cn(
          'tabular w-full rounded-md border border-line bg-surface px-2.5 text-sm text-ink placeholder:text-ink-muted/70 focus-visible:border-accent aria-invalid:border-hp',
          compact ? 'h-8' : 'h-10',
        )}
      />
      <p
        id={hintId}
        className={cn(
          'mt-1 text-xs',
          error ? 'text-hp-text' : 'text-ink-muted',
          compact && !error && 'sr-only',
        )}
        role={error ? 'alert' : undefined}
      >
        {error ?? t.hp.quickHint}
      </p>
    </div>
  )
}
