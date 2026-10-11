import type { StatKey } from '@/domain/types'
import { useT } from '@/i18n'
import { cn } from '@/lib/cn'
import { STAT_STYLES } from './statStyles'

/** Compact characteristic: colour dot + abbreviation + value (never colour alone). */
export function StatPill({
  stat,
  value,
  base,
  className,
}: {
  stat: StatKey
  value: number
  /** When different from `value`, the pill shows that a modifier applies. */
  base?: number
  className?: string
}) {
  const t = useT()
  const modified = base !== undefined && base !== value
  return (
    <span
      title={`${t.stats.names[stat]} : ${value}${modified ? ` (${t.sheet.base} ${base})` : ''}`}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-line bg-surface px-1.5 py-0.5 text-[11px] leading-none',
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', STAT_STYLES[stat].dot)} aria-hidden />
      <span className="font-medium text-ink-muted">{t.stats.abbr[stat]}</span>
      <span
        className={cn('tabular font-semibold text-ink', modified && 'underline decoration-dotted')}
      >
        {value}
      </span>
    </span>
  )
}
