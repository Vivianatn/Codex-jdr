import * as Tooltip from '@radix-ui/react-tooltip'
import { Weight } from 'lucide-react'
import { entityHpMax } from '@/domain/entity'
import { isOverloaded } from '@/domain/items'
import type { Condition, Entity } from '@/domain/types'
import { useT } from '@/i18n'
import { cn } from '@/lib/cn'
import { hpBand, type RulesConfig } from '@/rules'
import { CONDITION_COLOR_CLASSES, CONDITION_ICON_COMPONENTS } from './conditionStyles'

/** Small pill for an applied condition, with a tooltip describing it. */
export function ConditionPill({
  condition,
  className,
  interactive = true,
}: {
  condition: Condition
  className?: string
  /** False inside links/buttons: no focus stop, no tooltip. */
  interactive?: boolean
}) {
  const t = useT()
  const Icon = CONDITION_ICON_COMPONENTS[condition.icon]
  const colors = CONDITION_COLOR_CLASSES[condition.color]
  const details = [
    condition.remaining !== null
      ? t.conditions.remaining(condition.remaining)
      : t.conditions.untilRemoved,
    condition.note,
  ].filter(Boolean)
  const classes = cn(
    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium text-ink',
    colors.pill,
    className,
  )
  const content = (
    <>
      <Icon className={cn('size-3', colors.icon)} aria-hidden />
      {condition.name}
      {condition.remaining !== null && (
        <span className="tabular text-ink-muted">{condition.remaining}</span>
      )}
    </>
  )
  if (!interactive) return <span className={classes}>{content}</span>
  const pill = (
    <button type="button" className={classes}>
      {content}
    </button>
  )
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{pill}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          sideOffset={6}
          className="z-50 max-w-60 rounded-sm bg-ink px-2 py-1 text-xs text-bg shadow-overlay"
        >
          {details.join(' · ')}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

/**
 * Automatic statuses (Blessé, Critique, À terre, Surchargé, Épuisement) followed
 * by the applied conditions. Always text + icon, never colour alone.
 */
export function StatusPills({
  entity,
  rules,
  limit,
  className,
  interactive = true,
}: {
  entity: Entity
  rules: RulesConfig
  limit?: number
  className?: string
  interactive?: boolean
}) {
  const t = useT()
  const band = hpBand(entity.hp.current, entityHpMax(entity, rules), rules.hp)
  const auto: { key: string; label: string; tone: string }[] = []
  if (band !== 'healthy')
    auto.push({
      key: band,
      label: t.status[band],
      tone: band === 'wounded' ? 'bg-warning/20 border-warning/50' : 'bg-hp/15 border-hp/50',
    })
  if (isOverloaded(entity, rules))
    auto.push({
      key: 'overloaded',
      label: t.status.overloaded,
      tone: 'bg-surface-2 border-line-strong',
    })
  if (entity.exhaustion > 0)
    auto.push({
      key: 'exhausted',
      label: t.status.exhausted(entity.exhaustion),
      tone: 'bg-surface-2 border-line-strong',
    })

  const conditions = limit ? entity.conditions.slice(0, limit) : entity.conditions
  const extra = entity.conditions.length - conditions.length
  if (!auto.length && !conditions.length) return null
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {auto.map((s) => (
        <span
          key={s.key}
          title={t.status.auto}
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold text-ink',
            s.tone,
          )}
        >
          {s.key === 'overloaded' && <Weight className="size-3" aria-hidden />}
          {s.label}
        </span>
      ))}
      {conditions.map((c) => (
        <ConditionPill key={c.id} condition={c} interactive={interactive} />
      ))}
      {extra > 0 && <span className="px-1 text-xs text-ink-muted">+{extra}</span>}
    </div>
  )
}
