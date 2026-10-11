import { motion } from 'framer-motion'
import { useT } from '@/i18n'
import { cn } from '@/lib/cn'
import { hpBand, type HpBand } from '@/rules'

const BAND_COLORS: Record<HpBand, string> = {
  healthy: 'bg-heal',
  wounded: 'bg-warning',
  critical: 'bg-hp',
  down: 'bg-hp',
}

/** HP bar coloured by band, with the numbers and band name as text (not colour alone). */
export function HpBar({
  current,
  max,
  temp = 0,
  size = 'md',
  showLabel = true,
  className,
}: {
  current: number
  max: number
  temp?: number
  size?: 'sm' | 'md'
  showLabel?: boolean
  className?: string
}) {
  const t = useT()
  const band = hpBand(current, max)
  const ratio = max > 0 ? Math.min(1, Math.max(0, current / max)) : 0
  const label = t.sheet.hpLabel(current, max)
  return (
    <div className={cn('w-full', className)}>
      {showLabel && (
        <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
          <span className="tabular font-semibold text-ink">
            {current}
            <span className="font-normal text-ink-muted"> / {max}</span>
            {temp > 0 && <span className="ml-1 text-info">+{temp}</span>}
          </span>
          <span className={cn('text-ink-muted', band !== 'healthy' && 'font-medium text-hp-text')}>
            {t.sheet.hpBands[band]}
          </span>
        </div>
      )}
      <div
        role="meter"
        aria-label={t.sheet.hp}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={current}
        aria-valuetext={`${label} — ${t.sheet.hpBands[band]}`}
        className={cn(
          'overflow-hidden rounded-full bg-surface-2 ring-1 ring-line',
          size === 'sm' ? 'h-1.5' : 'h-2',
        )}
      >
        <motion.div
          className={cn('h-full rounded-full', BAND_COLORS[band])}
          initial={false}
          animate={{ width: `${ratio * 100}%` }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  )
}
