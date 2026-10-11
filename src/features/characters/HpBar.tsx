import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { useT } from '@/i18n'
import { cn } from '@/lib/cn'
import { hpBand, type HpBand, type RulesConfig } from '@/rules'
import { useShallow } from 'zustand/react/shallow'
import { useFxStore, type HpFx } from '@/stores/fxStore'

const BAND_COLORS: Record<HpBand, string> = {
  healthy: 'bg-heal',
  wounded: 'bg-warning',
  critical: 'bg-hp',
  down: 'bg-hp',
}

/**
 * HP bar coloured by band (SPEC §4.2): after damage a pale "ghost" trail stays
 * behind and catches up with the real value; with `entityId`, damage and
 * healing numbers float above the bar and heavy hits shake it.
 */
export function HpBar({
  current,
  max,
  temp = 0,
  size = 'md',
  showLabel = true,
  thresholds,
  entityId,
  className,
}: {
  current: number
  max: number
  temp?: number
  size?: 'sm' | 'md'
  showLabel?: boolean
  thresholds?: Pick<RulesConfig['hp'], 'woundedBelow' | 'criticalBelow'>
  entityId?: string
  className?: string
}) {
  const t = useT()
  const band = hpBand(current, max, thresholds)
  const ratio = max > 0 ? Math.min(1, Math.max(0, current / max)) : 0
  const label = t.sheet.hpLabel(current, max)

  // Ghost trail: lags behind on damage, follows immediately on healing.
  const [ghost, setGhost] = useState(ratio)
  const previous = useRef(ratio)
  useEffect(() => {
    if (ratio >= previous.current) setGhost(ratio)
    else {
      const timer = setTimeout(() => setGhost(ratio), 450)
      previous.current = ratio
      return () => clearTimeout(timer)
    }
    previous.current = ratio
  }, [ratio])

  const fx = useFxStore(
    useShallow((s) => (entityId ? s.hp.filter((f) => f.entityId === entityId) : NO_FX)),
  )
  const shaking = fx.some((f) => f.severe)

  return (
    <motion.div
      className={cn('relative w-full', className)}
      animate={shaking ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
      transition={{ duration: 0.4 }}
    >
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
          'relative overflow-hidden rounded-full bg-surface-2 ring-1 ring-line',
          size === 'sm' ? 'h-1.5' : 'h-2',
        )}
      >
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-hp/35"
          initial={false}
          animate={{ width: `${ghost * 100}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
        <motion.div
          className={cn('absolute inset-y-0 left-0 rounded-full', BAND_COLORS[band])}
          initial={false}
          animate={{ width: `${ratio * 100}%` }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        />
        {shaking && (
          <motion.div
            className="absolute inset-0 bg-hp"
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          />
        )}
      </div>
      <div
        className="pointer-events-none absolute inset-x-0 -top-1 flex justify-center"
        aria-hidden
      >
        <AnimatePresence>
          {fx.map((f) => (
            <FloatingNumber key={f.id} fx={f} />
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

const NO_FX: HpFx[] = []

/** "−7" / "+5" rising above the bar; removes itself even when animations are off. */
function FloatingNumber({ fx }: { fx: HpFx }) {
  const drop = useFxStore((s) => s.dropHp)
  useEffect(() => {
    const timer = setTimeout(() => drop(fx.id), 1200)
    return () => clearTimeout(timer)
  }, [drop, fx.id])
  return (
    <motion.span
      className={cn(
        'tabular absolute font-display text-lg font-bold drop-shadow',
        fx.kind === 'damage' ? 'text-hp-text' : fx.kind === 'heal' ? 'text-heal-text' : 'text-info',
      )}
      initial={{ y: 0, opacity: 1, scale: 0.8 }}
      animate={{ y: -28, opacity: 0, scale: 1.1 }}
      transition={{ duration: 1.1, ease: 'easeOut' }}
    >
      {fx.kind === 'damage' ? '−' : '+'}
      {fx.amount}
    </motion.span>
  )
}
