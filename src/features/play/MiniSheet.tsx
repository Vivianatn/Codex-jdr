import { FileText, Minus, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { IconButton } from '@/components/ui/Button'
import { parseStatInput } from '@/domain/checks'
import { allConditionTemplates } from '@/domain/conditions'
import { effectiveStats, entityHpMax, entityName } from '@/domain/entity'
import { STAT_KEYS, type Entity, type StatKey } from '@/domain/types'
import { HpBar } from '@/features/characters/HpBar'
import { HpQuickInput } from '@/features/characters/HpQuickInput'
import { STAT_STYLES } from '@/features/characters/statStyles'
import { ConditionPill } from '@/features/characters/StatusPills'
import { useGameActions } from '@/features/game/useGameActions'
import { useCampaign } from '@/features/shell/campaignContext'
import { useT } from '@/i18n'
import { cn } from '@/lib/cn'
import { useCampaignStore } from '@/stores/campaignStore'
import { BoardMenu } from './BoardMenu'

/**
 * Mini sheet above a token (D-234): HP, the seven characteristics and the
 * conditions, editable in one gesture ("-2" in the HP field, a click on a
 * characteristic then "-2"). Compact = read-only reminder, click to expand.
 */
export function MiniSheet({
  entity,
  expanded,
  onExpand,
  onClose,
  onFull,
}: {
  entity: Entity
  expanded: boolean
  onExpand: () => void
  onClose: () => void
  onFull: () => void
}) {
  const t = useT()
  const campaign = useCampaign()
  const rules = campaign.rules
  const name = entityName(entity)
  const stats = effectiveStats(entity, rules)
  const max = entityHpMax(entity, rules)

  if (!expanded)
    return (
      <button
        type="button"
        onClick={onExpand}
        aria-label={t.mini.expand(name)}
        className="codex-glass block w-[220px] !rounded-xl p-2.5 text-left hover:border-accent"
      >
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-semibold text-ink">{name}</span>
          <span className="tabular shrink-0 text-xs text-ink-muted">
            {entity.hp.current}/{max}
          </span>
        </span>
        <HpBar
          current={entity.hp.current}
          max={max}
          temp={entity.hp.temp}
          size="sm"
          showLabel={false}
          thresholds={rules.hp}
          entityId={entity.id}
        />
        <span className="mt-1 grid grid-cols-7 gap-0.5 text-center">
          {STAT_KEYS.map((key) => (
            <span key={key} className="leading-tight">
              <span
                className={cn(
                  'block text-[0.5625rem] font-bold tracking-[0.08em]',
                  STAT_STYLES[key].text,
                )}
              >
                {t.stats.abbr[key]}
              </span>
              <span className="tabular block text-xs font-semibold text-ink">
                {stats[key].total}
              </span>
            </span>
          ))}
        </span>
        {entity.conditions.length > 0 && (
          <span className="mt-1 flex flex-wrap gap-0.5">
            {entity.conditions.map((c) => (
              <ConditionPill
                key={c.id}
                condition={c}
                interactive={false}
                className="px-1.5 text-[0.65rem]"
              />
            ))}
          </span>
        )}
      </button>
    )

  return (
    <section aria-label={t.mini.title(name)} className="codex-glass w-[300px] space-y-2.5 p-4">
      <header className="flex items-center gap-1">
        <h2 className="min-w-0 flex-1 truncate font-title text-base font-semibold text-ink">
          {name}
        </h2>
        <BoardMenu entity={entity} />
        <IconButton size="sm" label={t.mini.full} icon={<FileText />} onClick={onFull} />
        <IconButton size="sm" label={t.mini.close} icon={<X />} onClick={onClose} />
      </header>

      <HpBar
        current={entity.hp.current}
        max={max}
        temp={entity.hp.temp}
        size="sm"
        thresholds={rules.hp}
        entityId={entity.id}
      />
      <HpQuickInput entityId={entity.id} name={name} compact />

      <ul className="grid grid-cols-2 gap-1">
        {STAT_KEYS.map((key) => (
          <StatRow key={key} entity={entity} stat={key} />
        ))}
      </ul>

      <ConditionsRow entity={entity} />
    </section>
  )
}

function StatRow({ entity, stat }: { entity: Entity; stat: StatKey }) {
  const t = useT()
  const { rules } = useCampaign()
  const actions = useGameActions()
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState(false)
  const label = t.stats.names[stat]
  const { base, total } = effectiveStats(entity, rules)[stat]

  function commit() {
    const next = parseStatInput(text, base)
    if (next === null) return setError(true)
    actions.nudgeStat(entity.id, stat, next - base)
    setEditing(false)
  }

  return (
    <li className={cn('flex items-center gap-0.5 rounded-lg px-1 py-0.5', STAT_STYLES[stat].soft)}>
      <abbr
        title={label}
        className={cn(
          'w-7 shrink-0 pl-0.5 text-[0.625rem] font-bold tracking-[0.08em] no-underline',
          STAT_STYLES[stat].text,
        )}
      >
        {t.stats.abbr[stat]}
      </abbr>
      {editing ? (
        <input
          // eslint-disable-next-line jsx-a11y/no-autofocus -- opened on purpose by a click
          autoFocus
          aria-label={t.mini.statInput(label)}
          aria-invalid={error || undefined}
          title={error ? t.mini.statInvalid : undefined}
          value={text}
          placeholder={String(base)}
          onChange={(e) => {
            setText(e.target.value)
            setError(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') setEditing(false)
          }}
          onBlur={() => setEditing(false)}
          className="tabular h-6 min-w-0 flex-1 rounded-sm border border-accent bg-surface px-1 text-center text-sm text-ink aria-invalid:border-hp"
        />
      ) : (
        <>
          <IconButton
            size="sm"
            className="size-6"
            label={t.quick.less(label)}
            icon={<Minus />}
            disabled={base <= rules.stats.min}
            onClick={() => actions.nudgeStat(entity.id, stat, -1)}
          />
          <button
            type="button"
            aria-label={t.mini.statEdit(label, total)}
            title={total !== base ? `${t.sheet.base} ${base}` : undefined}
            onClick={() => {
              setText('')
              setError(false)
              setEditing(true)
            }}
            className="tabular min-w-0 flex-1 rounded-md text-center font-display text-base font-bold text-ink hover:bg-surface/70"
          >
            {total}
          </button>
          <IconButton
            size="sm"
            className="size-6"
            label={t.quick.more(label)}
            icon={<Plus />}
            disabled={base >= rules.stats.max}
            onClick={() => actions.nudgeStat(entity.id, stat, 1)}
          />
        </>
      )}
    </li>
  )
}

function ConditionsRow({ entity }: { entity: Entity }) {
  const t = useT()
  const campaign = useCampaign()
  const actions = useGameActions()
  const update = useCampaignStore((s) => s.updateEntity)
  const library = allConditionTemplates(campaign.library.conditions)
  const name = entityName(entity)
  return (
    <div className="space-y-1">
      {entity.conditions.length === 0 ? (
        <p className="text-xs text-ink-muted">{t.mini.noConditions}</p>
      ) : (
        <ul className="flex flex-wrap gap-1">
          {entity.conditions.map((c) => (
            <li key={c.id} className="flex items-center">
              <ConditionPill condition={c} />
              <IconButton
                size="sm"
                className="size-6"
                label={t.mini.removeCondition(c.name)}
                icon={<X />}
                onClick={() =>
                  update(
                    entity.id,
                    (e) => ({ ...e, conditions: e.conditions.filter((x) => x.id !== c.id) }),
                    t.journal.conditionRemoved(c.name),
                  )
                }
              />
            </li>
          ))}
        </ul>
      )}
      {library.length > 0 && (
        <select
          aria-label={t.mini.addConditionLabel(name)}
          value=""
          onChange={(e) => {
            if (e.target.value) actions.addConditionFromTemplate([entity.id], e.target.value)
          }}
          className="h-8 w-full rounded-lg border border-line-strong bg-surface px-2 text-xs text-ink"
        >
          <option value="">{t.mini.addCondition}</option>
          {library.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
