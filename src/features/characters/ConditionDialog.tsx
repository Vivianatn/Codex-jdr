import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { CheckboxField, SelectField } from '@/components/ui/fields'
import { TextAreaField, TextField } from '@/components/ui/TextField'
import { validateDice } from '@/dice'
import {
  CONDITION_COLORS,
  CONDITION_ICONS,
  STAT_KEYS,
  type ConditionColor,
  type ConditionIcon,
  type ConditionTemplate,
  type StatKey,
} from '@/domain/types'
import { diceErrorMessage } from '@/features/game/diceErrors'
import { useT } from '@/i18n'
import { cn } from '@/lib/cn'
import { CONDITION_COLOR_CLASSES, CONDITION_ICON_COMPONENTS } from './conditionStyles'
import { ModifierRow } from './SkillDialog'

/** Create / edit a condition of the campaign library (SPEC §4.10). */
export function ConditionDialog({
  template,
  onClose,
  onSave,
}: {
  template: ConditionTemplate | null
  onClose: () => void
  onSave: (template: ConditionTemplate) => void
}) {
  const t = useT()
  return (
    <Dialog
      open={template !== null}
      onOpenChange={(o) => !o && onClose()}
      title={template?.name ? t.conditions.edit : t.conditions.new}
      className="max-w-lg"
    >
      {template && <ConditionForm initial={template} onCancel={onClose} onSave={onSave} />}
    </Dialog>
  )
}

function ConditionForm({
  initial,
  onCancel,
  onSave,
}: {
  initial: ConditionTemplate
  onCancel: () => void
  onSave: (template: ConditionTemplate) => void
}) {
  const t = useT()
  const [c, setC] = useState(initial)
  const [duration, setDuration] = useState(
    initial.duration === null ? '' : String(initial.duration),
  )
  const [error, setError] = useState<{ name?: string; dice?: string }>({})
  const set = (patch: Partial<ConditionTemplate>) => setC((x) => ({ ...x, ...patch }))
  const statOptions = STAT_KEYS.map((k) => ({ value: k, label: t.stats.names[k] }))

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!c.name.trim()) return setError({ name: t.wizard.needName })
    if (c.perTurn) {
      try {
        validateDice(c.perTurn.expression)
      } catch (err) {
        return setError({ dice: diceErrorMessage(t, err) })
      }
    }
    const turns = Number(duration)
    onSave({
      ...c,
      name: c.name.trim(),
      duration: duration.trim() && turns > 0 ? Math.round(turns) : null,
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <TextField
        label={t.conditions.name}
        value={c.name}
        onChange={(e) => set({ name: e.target.value })}
        error={error.name}
        autoFocus
      />
      <TextAreaField
        label={t.common.description}
        value={c.description}
        onChange={(e) => set({ description: e.target.value })}
      />
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">{t.conditions.icon}</legend>
        <div className="flex flex-wrap gap-1.5">
          {CONDITION_ICONS.map((icon: ConditionIcon) => {
            const Icon = CONDITION_ICON_COMPONENTS[icon]
            return (
              <button
                key={icon}
                type="button"
                aria-label={t.conditions.icons[icon]}
                aria-pressed={c.icon === icon}
                onClick={() => set({ icon })}
                className={cn(
                  'flex size-9 items-center justify-center rounded-md border transition-colors',
                  c.icon === icon
                    ? 'border-accent bg-accent-soft text-accent-text'
                    : 'border-line text-ink-muted hover:text-ink',
                )}
              >
                <Icon className="size-4" aria-hidden />
              </button>
            )
          })}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">{t.conditions.color}</legend>
        <div className="flex flex-wrap gap-1.5">
          {CONDITION_COLORS.map((color: ConditionColor) => (
            <button
              key={color}
              type="button"
              aria-label={t.conditions.colors[color]}
              aria-pressed={c.color === color}
              onClick={() => set({ color })}
              className={cn(
                'size-8 rounded-full ring-offset-2 ring-offset-surface',
                CONDITION_COLOR_CLASSES[color].swatch,
                c.color === color && 'ring-2 ring-ink',
              )}
            />
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t.conditions.duration}
          hint={t.conditions.durationHint}
          value={duration}
          inputMode="numeric"
          onChange={(e) => setDuration(e.target.value)}
        />
        <SelectField<StatKey | 'none'>
          label={t.conditions.save}
          value={c.save ?? 'none'}
          onChange={(v) => set({ save: v === 'none' ? null : v })}
          options={[{ value: 'none', label: t.common.none }, ...statOptions]}
        />
        <SelectField<'none' | 'damage' | 'heal'>
          label={t.conditions.perTurn}
          value={c.perTurn?.kind ?? 'none'}
          onChange={(kind) =>
            set({
              perTurn:
                kind === 'none' ? null : { kind, expression: c.perTurn?.expression || '1d4' },
            })
          }
          options={(['none', 'damage', 'heal'] as const).map((k) => ({
            value: k,
            label: t.conditions.perTurnKinds[k],
          }))}
        />
        {c.perTurn && (
          <TextField
            label={t.conditions.perTurnExpression}
            value={c.perTurn.expression}
            error={error.dice}
            inputClassName="font-mono"
            onChange={(e) => set({ perTurn: { ...c.perTurn!, expression: e.target.value } })}
          />
        )}
      </div>
      <fieldset className="space-y-2 rounded-md border border-line p-3">
        <legend className="px-1 text-sm font-medium text-ink">{t.sheet.modifiers}</legend>
        {c.modifiers.map((m) => (
          <p key={m.id} className="flex items-center justify-between text-sm">
            {t.stats.names[m.stat]} {m.value >= 0 ? '+' : ''}
            {m.value}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => set({ modifiers: c.modifiers.filter((x) => x.id !== m.id) })}
            >
              {t.common.remove}
            </Button>
          </p>
        ))}
        <ModifierRow
          statOptions={statOptions}
          onAdd={(stat, value) =>
            set({
              modifiers: [...c.modifiers, { id: crypto.randomUUID(), stat, value, label: '' }],
            })
          }
        />
      </fieldset>
      <CheckboxField
        label={t.conditions.concentration}
        checked={c.concentration}
        onChange={(concentration) => set({ concentration })}
      />
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onCancel}>
          {t.common.cancel}
        </Button>
        <Button type="submit" variant="primary">
          {t.common.save}
        </Button>
      </div>
    </form>
  )
}
