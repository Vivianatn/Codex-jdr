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
        className="glass block w-52 rounded-md border border-line px-2 py-1.5 text-left shadow-lifted hover:border-accent"
      >
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-xs font-semibold text-ink">{name}</span>
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
              <span className="block text-[0.6rem] font-semibold text-ink-muted">
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
    <section
      aria-label={t.mini.title(name)}
      className="glass w-64 space-y-2 rounded-lg border border-line p-2.5 shadow-overlay"
    >
      <header className="flex items-center gap-1">
        <h2 className="min-w-0 flex-1 truncate font-sans text-sm font-semibold tracking-normal text-ink">
          {name}
        </h2>
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
    <li className="flex items-center gap-0.5 rounded-md border border-line bg-surface px-1 py-0.5">
      <span className={cn('size-1.5 shrink-0 rounded-full', STAT_STYLES[stat].dot)} aria-hidden />
      <abbr
        title={label}
        className="w-7 shrink-0 text-[0.65rem] font-semibold text-ink-muted no-underline"
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
            className="tabular min-w-0 flex-1 rounded-sm text-center text-sm font-semibold text-ink hover:bg-surface-2"
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
          className="h-7 w-full rounded-md border border-line bg-surface px-1.5 text-xs text-ink"
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
