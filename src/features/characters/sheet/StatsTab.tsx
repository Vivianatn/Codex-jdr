import { X } from 'lucide-react'
import { IconButton } from '@/components/ui/Button'
import { NumberInput } from '@/components/ui/fields'
import { effectiveStats, entityHpMax } from '@/domain/entity'
import { STAT_KEYS, type Entity } from '@/domain/types'
import { useT } from '@/i18n'
import { cn } from '@/lib/cn'
import { hpFormulaParts, type RulesConfig } from '@/rules'
import { HpBar } from '../HpBar'
import { ModifierRow } from '../SkillDialog'
import { STAT_STYLES } from '../statStyles'
import type { SheetEditor } from '../useSheetEditor'

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
  const stats = effectiveStats(entity)
  const max = entityHpMax(entity, rules)
  const formula = hpFormulaParts(entity.hp.roll, entity.level, rules).join(' + ')
  const statOptions = STAT_KEYS.map((key) => ({ value: key, label: t.stats.names[key] }))

  return (
    <div className="space-y-8">
      <section
        aria-labelledby="hp-heading"
        className="rounded-lg border border-line bg-surface p-5"
      >
        <h3 id="hp-heading" className="mb-4 text-base font-semibold text-ink">
          {t.sheet.hp}
        </h3>
        <HpBar current={entity.hp.current} max={max} temp={entity.hp.temp} className="mb-5" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <NumberInput
            label={t.sheet.level}
            value={entity.level}
            min={1}
            max={999}
            onCommit={editor.level}
          />
          <NumberInput
            label={t.sheet.hpRoll}
            value={entity.hp.roll}
            min={-50}
            max={200}
            onCommit={editor.hpRoll}
          />
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
        <p className="tabular mt-3 text-sm text-ink-muted">
          {t.sheet.hpMax} : {t.sheet.hpFormula(formula, max)}
        </p>
      </section>

      <section aria-label={t.sheet.tabs.stats}>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STAT_KEYS.map((key) => {
            const s = stats[key]
            return (
              <li
                key={key}
                className={cn(
                  'rounded-lg border border-t-4 border-line bg-surface p-4',
                  STAT_STYLES[key].border,
                )}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-sans text-sm font-semibold tracking-normal text-ink">
                    {t.stats.names[key]}
                  </h3>
                  <span
                    className="tabular font-display text-2xl font-semibold text-ink"
                    aria-label={`${t.sheet.effective} ${s.total}`}
                  >
                    {s.total}
                  </span>
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
    </div>
  )
}
