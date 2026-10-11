import { motion } from 'framer-motion'
import { EyeOff, Clover } from 'lucide-react'
import { useState } from 'react'
import type { RollRecord } from '@/domain/rolls'
import { useT } from '@/i18n'
import { cn } from '@/lib/cn'
import { AnimatedDie, GoldBurst } from './AnimatedDie'
import { useDiceAnimation } from './useDiceAnimation'
import { useOutcomeText } from './useOutcomeText'

const MAX_DICE = 12

/** A roll result: dice, total, check outcome, and critical effects (SPEC §7). */
export function RollCard({
  record,
  who,
  animate = false,
  compact = false,
}: {
  record: RollRecord
  /** Name of the character who rolled, or "MJ". */
  who: string
  animate?: boolean
  compact?: boolean
}) {
  const t = useT()
  const animationsOn = useDiceAnimation()
  const rolling = animate && animationsOn
  const dice = record.groups.flatMap((g) => g.dice.map((d) => ({ ...d, sides: g.sides })))
  const [landed, setLanded] = useState(!rolling || dice.length === 0 || compact)
  const outcome = useOutcomeText(record)
  const critical = record.check?.outcome.critical
  const shown = compact ? [] : dice.slice(0, MAX_DICE)
  const tone =
    critical?.kind === 'success' ? 'gold' : critical?.kind === 'failure' ? 'red' : 'default'
  const shake = landed && rolling && critical?.kind === 'failure'

  return (
    <motion.div
      className={cn(
        'relative rounded-md border bg-surface',
        compact ? 'px-3 py-2' : 'p-4',
        tone === 'gold' ? 'border-gold' : tone === 'red' ? 'border-hp/60' : 'border-line',
        landed && tone === 'red' && !compact && 'bg-hp/5',
      )}
      animate={shake ? { x: [0, -8, 8, -6, 6, -3, 0] } : { x: 0 }}
      transition={{ duration: 0.45 }}
    >
      {landed && rolling && critical?.kind === 'success' && <GoldBurst />}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn('truncate font-medium text-ink', compact ? 'text-sm' : 'text-base')}>
            {record.label}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-ink-muted">
            {who}
            {record.secret && (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-1.5 font-medium text-ink">
                <EyeOff className="size-3" aria-hidden />
                {t.dice.secretBadge}
              </span>
            )}
            {record.rerollOf && (
              <Clover className="size-3.5 text-heal-text" aria-label={t.dice.rerolled} />
            )}
          </p>
        </div>
        <motion.span
          key={landed ? 'landed' : 'rolling'}
          className={cn(
            'tabular font-display font-semibold text-ink',
            compact ? 'text-xl' : 'text-3xl',
          )}
          initial={landed && rolling ? { scale: 1.4 } : false}
          animate={{ scale: 1 }}
          aria-label={`${t.dice.total} ${record.total}`}
        >
          {record.total}
        </motion.span>
      </div>

      {shown.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {shown.map((d, i) => (
            <AnimatedDie
              key={`${record.id}-${i}`}
              value={d.value}
              sides={d.sides}
              kept={d.kept}
              rolling={rolling}
              tone={d.sides === 20 && d.kept && tone !== 'default' ? tone : 'default'}
              onLanded={i === 0 ? () => setLanded(true) : undefined}
            />
          ))}
          {dice.length > MAX_DICE && (
            <span className="text-xs text-ink-muted">+{dice.length - MAX_DICE}</span>
          )}
        </div>
      )}

      {outcome && (
        <p
          className={cn(
            'mt-2 text-sm font-semibold',
            outcome.tone === 'gold' && 'text-gold-text',
            outcome.tone === 'red' && 'text-hp-text',
            outcome.tone === 'success' && 'text-heal-text',
            outcome.tone === 'failure' && 'text-ink-muted',
          )}
        >
          {outcome.text}
          {record.check && (
            <span className="ml-2 font-normal text-ink-muted">
              {t.dice.natural(record.check.natural)} ·{' '}
              {t.dice.target(record.check.value + record.check.bonus)} ·{' '}
              {t.checks.marginHint(record.check.outcome.margin)}
            </span>
          )}
        </p>
      )}
      {!compact && (
        <p className="mt-1 text-xs break-words text-ink-muted">
          {record.breakdown.replace(/~~(\d+)~~/g, '($1)')}
        </p>
      )}
      {record.note && (
        <p className="mt-2 rounded-sm bg-surface-2 px-2 py-1 text-xs text-ink">{record.note}</p>
      )}
    </motion.div>
  )
}
