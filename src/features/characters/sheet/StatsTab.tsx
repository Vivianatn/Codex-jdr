import { Bed, Clover, Coffee, Minus, Plus, Shield, Sparkles, Weight, X } from 'lucide-react'
import { useState } from 'react'
import { Button, IconButton } from '@/components/ui/Button'
import { NumberInput } from '@/components/ui/fields'
import { TextField } from '@/components/ui/TextField'
import { effectiveStats, entityHpMax, entityName } from '@/domain/entity'
import {
  carriedWeight,
  carryCapacity,
  defenseValue,
  hasCarryCapacity,
  isOverloaded,
} from '@/domain/items'
import { luckPointsLeft, luckPointsMax, restsAvailable, xpProgress } from '@/domain/progress'
import { STAT_KEYS, type Entity, type StatKey } from '@/domain/types'
import { useGameActions } from '@/features/game/useGameActions'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useT } from '@/i18n'
import { cn } from '@/lib/cn'
import { parseNumber } from '@/lib/numbers'
import { hpFormulaParts, type RulesConfig } from '@/rules'
import { HpBar } from '../HpBar'
import { HpQuickInput } from '../HpQuickInput'
import {
  AttackDialog,
  CheckBonusDialog,
  IdentifyDialog,
  LevelUpDialog,
  OpposedDialog,
  SocialDialog,
} from '../play/PlayDialogs'
import { ModifierRow } from '../SkillDialog'
import { STAT_STYLES } from '../statStyles'
import type { SheetEditor } from '../useSheetEditor'
import { StatContextMenu, StatMenuButton } from './StatActions'
import { statMenu, type StatDialog } from './statMenu'

function Panel({
  title,
  icon,
  children,
  className,
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('rounded-lg border border-line bg-surface p-4', className)}>
      <h3 className="mb-3 flex items-center gap-2 font-sans text-sm font-semibold tracking-normal text-ink [&>svg]:size-4 [&>svg]:text-ink-muted">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  )
}

export function StatsTab({
  entity,
  rules,
  editor,
}: {
  entity: Entity
  rules: RulesConfig
  editor: SheetEditor
}) {
  const t = useT()
  const actions = useGameActions()
  const [dialog, setDialog] = useState<StatDialog | null>(null)
  const stats = effectiveStats(entity, rules)
  const max = entityHpMax(entity, rules)
  const formula = hpFormulaParts(entity.hp.roll, entity.level, rules).join(' + ')
  const statOptions = STAT_KEYS.map((key) => ({ value: key, label: t.stats.names[key] }))
  const name = entityName(entity)
  const close = () => setDialog(null)

  return (
    <div className="space-y-8">
      <section
        aria-labelledby="hp-heading"
        className="rounded-lg border border-line bg-surface p-5"
      >
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <h3 id="hp-heading" className="text-base font-semibold text-ink">
            {t.sheet.hp}
          </h3>
          <HpQuickInput entityId={entity.id} name={name} className="w-full sm:w-72" />
        </div>
        <HpBar
          current={entity.hp.current}
          max={max}
          temp={entity.hp.temp}
          thresholds={rules.hp}
          entityId={entity.id}
          className="mb-5"
        />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <NumberInput
            label={t.sheet.level}
            value={entity.level}
            min={1}
            max={999}
            onCommit={editor.level}
          />
          {entity.hp.fixedMax === null ? (
            <NumberInput
              label={t.sheet.hpRoll}
              value={entity.hp.roll}
              min={-50}
              max={200}
              onCommit={editor.hpRoll}
            />
          ) : (
            <NumberInput
              label={t.sheet.hpGiven}
              value={max}
              min={1}
              max={99_999}
              onCommit={editor.hpFixedMax}
            />
          )}
          <NumberInput
            label={t.sheet.hpCurrent}
            value={entity.hp.current}
            min={0}
            max={max}
            onCommit={editor.hpCurrent}
          />
          <NumberInput
            label={t.sheet.hpTemp}
            value={entity.hp.temp}
            min={0}
            max={999}
            onCommit={editor.hpTemp}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="tabular text-sm text-ink-muted">
            {t.sheet.hpMax} :{' '}
            {entity.hp.fixedMax === null
              ? t.sheet.hpFormula(formula, max)
              : t.sheet.hpFixedFormula(entity.hp.fixedMax, entity.hp.fixedLevel, rules.hp.perLevel)}
          </p>
          <SegmentedControl<'roll' | 'fixed'>
            label={t.sheet.hpSource}
            size="sm"
            value={entity.hp.fixedMax === null ? 'roll' : 'fixed'}
            onValueChange={(mode) =>
              mode === 'roll' ? editor.hpRoll(entity.hp.roll) : editor.hpFixedMax(max)
            }
            options={[
              { value: 'roll', label: t.sheet.hpSourceRoll },
              { value: 'fixed', label: t.sheet.hpSourceFixed },
            ]}
          />
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <DerivedPanels entity={entity} rules={rules} />
      </div>

      {entity.kind === 'player' && <XpPanel entity={entity} rules={rules} editor={editor} />}

      <section aria-label={t.sheet.tabs.stats}>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STAT_KEYS.map((key) => {
            const s = stats[key]
            const groups = statMenu(
              t,
              entity,
              key,
              actions,
              setDialog,
              luckPointsMax(entity, rules) > 0,
            )
            return (
              <StatContextMenu key={key} groups={groups}>
                <li
                  className={cn(
                    'rounded-lg border border-t-4 border-line bg-surface p-4',
                    STAT_STYLES[key].border,
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="pt-1 font-sans text-sm font-semibold tracking-normal text-ink">
                      {t.stats.names[key]}
                    </h3>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => actions.check(entity.id, key)}
                        className="tabular rounded-md px-2 font-display text-2xl font-semibold text-ink transition-colors hover:bg-accent-soft hover:text-accent-text"
                        aria-label={t.checks.test(t.stats.names[key], s.total)}
                        title={t.checks.test(t.stats.names[key], s.total)}
                      >
                        {s.total}
                      </button>
                      <StatMenuButton
                        label={t.checks.actions(t.stats.names[key])}
                        groups={groups}
                      />
                    </div>
                  </div>
                  <NumberInput
                    label={`${t.sheet.base} — ${t.stats.names[key]}`}
                    hideLabel
                    value={s.base}
                    min={rules.stats.min}
                    max={rules.stats.max}
                    integer={rules.stats.rounding !== 'half'}
                    onCommit={(v) => editor.stat(key, v)}
                    className="mt-2"
                    inputClassName="h-8"
                  />
                  {s.modifiers.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-xs text-ink-muted">
                      {s.modifiers.map((m) => (
                        <li key={m.id} className="flex justify-between gap-2">
                          <span className="truncate">{m.label}</span>
                          <span className="tabular font-medium text-ink">
                            {m.value >= 0 ? '+' : ''}
                            {m.value}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              </StatContextMenu>
            )
          })}
        </ul>
      </section>

      <section aria-labelledby="mods-heading" className="space-y-3">
        <h3 id="mods-heading" className="text-base font-semibold text-ink">
          {t.sheet.modifiers}
        </h3>
        {entity.modifiers.length === 0 ? (
          <p className="text-sm text-ink-muted">{t.sheet.noModifiers}</p>
        ) : (
          <ul className="divide-y divide-line rounded-md border border-line bg-surface">
            {entity.modifiers.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span>
                  <span className="font-medium">{t.stats.names[m.stat]}</span>{' '}
                  <span className="tabular">
                    {m.value >= 0 ? '+' : ''}
                    {m.value}
                  </span>
                  {m.label && <span className="text-ink-muted"> · {m.label}</span>}
                </span>
                <IconButton
                  size="sm"
                  label={`${t.common.remove} : ${m.label || t.stats.names[m.stat]}`}
                  icon={<X />}
                  onClick={() => editor.removeModifier(m.id)}
                />
              </li>
            ))}
          </ul>
        )}
        <ModifierRow
          withLabel
          statOptions={statOptions}
          onAdd={(stat, value, label) => editor.addModifier({ stat, value, label })}
        />
      </section>

      {dialog?.kind === 'bonus' && (
        <CheckBonusDialog entity={entity} stat={dialog.stat} onClose={close} />
      )}
      {(dialog?.kind === 'melee' || dialog?.kind === 'ranged') && (
        <AttackDialog entity={entity} kind={dialog.kind} onClose={close} />
      )}
      {dialog?.kind === 'opposed' && (
        <OpposedDialog entity={entity} stat={dialog.stat as StatKey} onClose={close} />
      )}
      {(dialog?.kind === 'persuasion' ||
        dialog?.kind === 'intimidation' ||
        dialog?.kind === 'deception') && (
        <SocialDialog entity={entity} action={dialog.kind} onClose={close} />
      )}
      {dialog?.kind === 'identify' && <IdentifyDialog entity={entity} onClose={close} />}
    </div>
  )
}

/** Optional panels: each one appears only if the GM enabled its rule (D-217). */
function DerivedPanels({ entity, rules }: { entity: Entity; rules: RulesConfig }) {
  const t = useT()
  const actions = useGameActions()
  const stats = effectiveStats(entity, rules)
  const defense = defenseValue(entity, rules, stats.dexterity.total)
  const capacity = hasCarryCapacity(rules) ? carryCapacity(entity, rules) : null
  const weight = carriedWeight(entity)
  const overloaded = isOverloaded(entity, rules)
  const luckMax = luckPointsMax(entity, rules)
  const luckLeft = luckPointsLeft(entity, rules)
  const rests = restsAvailable(rules)
  const fatigue = rules.fatigue.maxExhaustion > 0
  const fmt = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',')

  return (
    <>
      {defense !== null && (
        <Panel title={t.derived.defense} icon={<Shield />}>
          <p className="tabular font-display text-3xl font-semibold text-ink">{defense}</p>
        </Panel>
      )}
      {capacity !== null && (
        <Panel title={t.derived.carry} icon={<Weight />}>
          <p
            className={cn(
              'tabular text-lg font-semibold',
              overloaded ? 'text-hp-text' : 'text-ink',
            )}
          >
            {t.derived.carryValue(fmt(weight), fmt(capacity))}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className={cn('h-full rounded-full', overloaded ? 'bg-hp' : 'bg-accent')}
              style={{ width: `${Math.min(100, capacity > 0 ? (weight / capacity) * 100 : 100)}%` }}
            />
          </div>
          {overloaded && (
            <p className="mt-1 text-xs font-medium text-hp-text">{t.status.overloaded}</p>
          )}
        </Panel>
      )}
      {luckMax > 0 && (
        <Panel title={t.derived.luck} icon={<Clover />}>
          <p className="tabular text-lg font-semibold text-ink">
            {t.derived.luckValue(luckLeft, luckMax)}
          </p>
          <Button
            size="sm"
            className="mt-2"
            icon={<Clover />}
            disabled={luckLeft === 0}
            onClick={() => actions.luckReroll(entity.id)}
          >
            {t.dice.reroll}
          </Button>
        </Panel>
      )}
      {(fatigue || rests.short || rests.long) && (
        <Panel title={t.rest.title} icon={<Bed />} className="md:col-span-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {fatigue && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-ink">{t.rest.exhaustion}</span>
                <IconButton
                  size="sm"
                  variant="secondary"
                  label={t.rest.less}
                  icon={<Minus />}
                  disabled={entity.exhaustion === 0}
                  onClick={() => actions.setExhaustion(entity.id, entity.exhaustion - 1)}
                />
                <span className="tabular w-6 text-center font-semibold text-ink" aria-live="polite">
                  {entity.exhaustion}
                </span>
                <IconButton
                  size="sm"
                  variant="secondary"
                  label={t.rest.more}
                  icon={<Plus />}
                  disabled={entity.exhaustion >= rules.fatigue.maxExhaustion}
                  onClick={() => actions.setExhaustion(entity.id, entity.exhaustion + 1)}
                />
                {rules.fatigue.checkPenaltyPerLevel > 0 && (
                  <span className="text-xs text-ink-muted">
                    {t.rest.exhaustionHint(rules.fatigue.checkPenaltyPerLevel)}
                  </span>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {rests.short && (
                <Button
                  size="sm"
                  icon={<Coffee />}
                  title={t.rest.shortHint(rules.rests.shortRestHeal)}
                  onClick={() => actions.shortRest(entity.id)}
                >
                  {t.rest.short}
                </Button>
              )}
              {rests.long && (
                <Button size="sm" icon={<Bed />} onClick={() => actions.longRest(entity.id)}>
                  {t.rest.long}
                </Button>
              )}
            </div>
          </div>
        </Panel>
      )}
    </>
  )
}

function XpPanel({
  entity,
  rules,
  editor,
}: {
  entity: Entity & { kind: 'player' }
  rules: RulesConfig
  editor: SheetEditor
}) {
  const t = useT()
  const actions = useGameActions()
  const [amount, setAmount] = useState('')
  const [levelUp, setLevelUp] = useState(false)
  const progress = xpProgress(entity.level, entity.details.xp, rules)
  const target = entity.level + (progress?.pendingLevels ?? 0)
  return (
    <section aria-labelledby="xp-heading" className="rounded-lg border border-line bg-surface p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-56 flex-1">
          <h3 id="xp-heading" className="text-base font-semibold text-ink">
            {t.levelUp.xp}{' '}
            <span className="tabular font-normal text-ink-muted">({entity.details.xp} XP)</span>
          </h3>
          {progress ? (
            <>
              <div
                className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2 ring-1 ring-line"
                role="meter"
                aria-label={t.levelUp.xp}
                aria-valuemin={0}
                aria-valuemax={progress.span}
                aria-valuenow={Math.min(progress.into, progress.span)}
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-accent to-gold"
                  style={{ width: `${progress.ratio * 100}%` }}
                />
              </div>
              <p className="tabular mt-1 text-xs text-ink-muted">
                {t.levelUp.progress(progress.into, progress.span)}
              </p>
            </>
          ) : (
            <p className="mt-1 text-xs text-ink-muted">{t.levelUp.noThresholds}</p>
          )}
        </div>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const n = parseNumber(amount)
            if (n) actions.addXp(entity.id, Math.round(n))
            setAmount('')
          }}
        >
          <TextField
            label={t.levelUp.addXp}
            value={amount}
            inputMode="numeric"
            placeholder="150"
            onChange={(e) => setAmount(e.target.value)}
            className="w-32"
          />
          <Button type="submit" icon={<Plus />} aria-label={t.common.add} />
        </form>
        {progress && progress.pendingLevels > 0 && (
          <Button
            variant="primary"
            icon={<Sparkles />}
            className="bg-gold text-[#1f1d2b] hover:bg-gold/90"
            onClick={() => setLevelUp(true)}
          >
            {t.levelUp.ready}
          </Button>
        )}
      </div>
      {levelUp && (
        <LevelUpDialog
          entity={entity}
          targetLevel={target}
          onConfirm={() => editor.level(target)}
          onClose={() => setLevelUp(false)}
        />
      )}
    </section>
  )
}
