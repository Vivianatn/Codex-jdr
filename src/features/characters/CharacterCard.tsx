import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { effectiveStats, entityHpMax, entityName } from '@/domain/entity'
import { STAT_KEYS, type Entity } from '@/domain/types'
import { useT } from '@/i18n'
import type { RulesConfig } from '@/rules'
import { HpBar } from './HpBar'
import { Portrait } from './Portrait'
import { StatPill } from './StatPill'

const listItemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const } },
}

/** Character summary (SPEC §9.3): medallion, name, class, HP, the seven stats, conditions. */
export function CharacterCard({
  entity,
  rules,
  to,
  badge,
  footer,
}: {
  entity: Entity
  rules: RulesConfig
  to: string
  badge?: ReactNode
  /** Extra controls under the card (kept outside the link). */
  footer?: ReactNode
}) {
  const t = useT()
  const name = entityName(entity)
  const stats = effectiveStats(entity)
  const shownConditions = entity.conditions.slice(0, 3)
  const extra = entity.conditions.length - shownConditions.length
  return (
    <motion.li
      variants={listItemVariants}
      className="group flex flex-col rounded-lg border border-line bg-surface shadow-soft transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lifted"
    >
      <Link
        to={to}
        aria-label={t.sheet.open(name)}
        className="flex flex-1 flex-col gap-3 rounded-lg p-4"
      >
        <div className="flex items-center gap-3">
          <Portrait src={entity.identity.portrait} name={name} />
          <div className="min-w-0">
            <p className="truncate font-display text-base font-semibold text-ink">{name}</p>
            <p className="truncate text-sm text-ink-muted">
              {[entity.identity.className, `${t.sheet.level} ${entity.level}`]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {badge}
          </div>
        </div>
        <HpBar current={entity.hp.current} max={entityHpMax(entity, rules)} temp={entity.hp.temp} />
        <div className="flex flex-wrap gap-1">
          {STAT_KEYS.map((key) => (
            <StatPill key={key} stat={key} value={stats[key].total} base={stats[key].base} />
          ))}
        </div>
        {shownConditions.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {shownConditions.map((c) => (
              <span
                key={c.id}
                className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-ink"
              >
                {c.name}
              </span>
            ))}
            {extra > 0 && <span className="px-1 text-xs text-ink-muted">+{extra}</span>}
          </div>
        )}
      </Link>
      {footer && <div className="border-t border-line px-4 py-3">{footer}</div>}
    </motion.li>
  )
}
