import { Plus, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button, IconButton } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { CheckboxField, SelectField } from '@/components/ui/fields'
import { TextAreaField, TextField } from '@/components/ui/TextField'
import { newId } from '@/domain/entity'
import { allConditionTemplates } from '@/domain/conditions'
import {
  STAT_KEYS,
  type Skill,
  type SkillEffectKind,
  type SkillKind,
  type StatKey,
} from '@/domain/types'
import { useCampaign } from '@/features/shell/campaignContext'
import { useT } from '@/i18n'
import { parseNumber } from '@/lib/numbers'

/** Create or edit a skill. Passives and class passives can carry permanent stat modifiers. */
export function SkillDialog({
  skill,
  onClose,
  onSave,
  perCharacter = true,
  notice,
}: {
  skill: Skill | null
  onClose: () => void
  onSave: (skill: Skill) => void
  /** False when editing the library definition: hides per-character state (enabled). */
  perCharacter?: boolean
  /** Shown above the form (e.g. "shared by 3 characters"). */
  notice?: string
}) {
  const t = useT()
  return (
    <Dialog
      open={skill !== null}
      onOpenChange={(open) => !open && onClose()}
      title={skill?.name ? t.skills.edit : t.skills.add}
      className="max-w-lg"
    >
      {notice && (
        <p className="mb-4 rounded-md border border-line bg-accent-soft px-3 py-2 text-sm text-ink">
          {notice}
        </p>
      )}
      {skill && (
        <SkillForm initial={skill} onCancel={onClose} onSave={onSave} perCharacter={perCharacter} />
      )}
    </Dialog>
  )
}

function SkillForm({
  initial,
  onCancel,
  onSave,
  perCharacter,
}: {
  initial: Skill
  onCancel: () => void
  onSave: (skill: Skill) => void
  perCharacter: boolean
}) {
  const t = useT()
  const [skill, setSkill] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<Skill>) => setSkill((s) => ({ ...s, ...patch }))
  const statOptions = STAT_KEYS.map((key) => ({ value: key, label: t.stats.names[key] }))

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!skill.name.trim()) return setError(t.wizard.needName)
    onSave({ ...skill, name: skill.name.trim(), description: skill.description.trim() })
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <TextField
        label={t.skills.name}
        value={skill.name}
        onChange={(e) => {
          set({ name: e.target.value })
          setError(null)
        }}
        error={error}
        autoFocus
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField<SkillKind>
          label={t.skills.kind}
          value={skill.kind}
          onChange={(kind) => set({ kind })}
          options={(['active', 'passive', 'class'] as const).map((k) => ({
            value: k,
            label: t.skills.kinds[k],
          }))}
        />
        <SelectField<StatKey | 'none'>
          label={t.skills.linkedStat}
          value={skill.stat ?? 'none'}
          onChange={(v) => set({ stat: v === 'none' ? null : v })}
          options={[{ value: 'none', label: t.common.none }, ...statOptions]}
        />
      </div>
      <TextAreaField
        label={t.common.description}
        value={skill.description}
        onChange={(e) => set({ description: e.target.value })}
      />

      {skill.kind === 'active' && <ActiveFields skill={skill} set={set} />}

      {skill.kind !== 'active' && (
        <fieldset className="space-y-3 rounded-md border border-line p-3">
          <legend className="px-1 text-sm font-medium text-ink">{t.sheet.modifiers}</legend>
          <p className="text-xs text-ink-muted">{t.skills.modifiersHint}</p>
          {skill.modifiers.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-2 text-sm">
              <span>
                {t.stats.names[m.stat]}{' '}
                <span className="tabular font-semibold">
                  {m.value >= 0 ? '+' : ''}
                  {m.value}
                </span>
              </span>
              <IconButton
                size="sm"
                label={`${t.common.remove} ${t.stats.names[m.stat]} ${m.value}`}
                icon={<X />}
                onClick={() => set({ modifiers: skill.modifiers.filter((x) => x.id !== m.id) })}
              />
            </div>
          ))}
          <ModifierRow
            statOptions={statOptions}
            onAdd={(stat, value) =>
              set({ modifiers: [...skill.modifiers, { id: newId(), stat, value, label: '' }] })
            }
          />
          {perCharacter && (
            <CheckboxField
              label={t.skills.enabled}
              hint={t.skills.enabledHint}
              checked={skill.enabled}
              onChange={(enabled) => set({ enabled })}
            />
          )}
        </fieldset>
      )}

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

/** Stat + signed value + "Ajouter". Shared by skills and the sheet's manual modifiers. */
export function ModifierRow({
  statOptions,
  onAdd,
  withLabel = false,
}: {
  statOptions: { value: StatKey; label: string }[]
  onAdd: (stat: StatKey, value: number, label: string) => void
  withLabel?: boolean
}) {
  const t = useT()
  const [stat, setStat] = useState<StatKey>('strength')
  const [value, setValue] = useState('')
  const [label, setLabel] = useState('')
  const parsed = parseNumber(value)
  const add = () => {
    if (parsed === null || parsed === 0) return
    onAdd(stat, Math.round(parsed), label.trim())
    setValue('')
    setLabel('')
  }
  return (
    <div className="flex flex-wrap items-end gap-2">
      <SelectField<StatKey>
        label={t.sheet.modifierStat}
        value={stat}
        onChange={setStat}
        options={statOptions}
        className="min-w-36 flex-1"
      />
      <TextField
        label={t.sheet.modifierValue}
        value={value}
        inputMode="numeric"
        placeholder="+2"
        className="w-20"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            add()
          }
        }}
      />
      {withLabel && (
        <TextField
          label={t.sheet.modifierLabel}
          value={label}
          placeholder={t.sheet.modifierLabelPlaceholder}
          className="min-w-36 flex-1"
          onChange={(e) => setLabel(e.target.value)}
        />
      )}
      <Button icon={<Plus />} onClick={add} disabled={parsed === null || parsed === 0}>
        {t.common.add}
      </Button>
    </div>
  )
}

/** Uses, cooldown and effect of an active skill (SPEC §4.12). */
function ActiveFields({ skill, set }: { skill: Skill; set: (patch: Partial<Skill>) => void }) {
  const t = useT()
  const campaign = useCampaign()
  const conditions = allConditionTemplates(campaign.library.conditions)
  const [uses, setUses] = useState(skill.usesMax === null ? '' : String(skill.usesMax))
  const [cooldown, setCooldown] = useState(String(skill.cooldown))
  return (
    <fieldset className="space-y-4 rounded-md border border-line p-3">
      <legend className="px-1 text-sm font-medium text-ink">{t.skills.effect}</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t.skills.uses}
          hint={t.skills.usesHint}
          value={uses}
          inputMode="numeric"
          onChange={(e) => {
            setUses(e.target.value)
            const n = parseNumber(e.target.value)
            const usesMax = n !== null && n > 0 ? Math.round(n) : null
            set({
              usesMax,
              usesLeft: usesMax === null ? null : Math.min(skill.usesLeft ?? usesMax, usesMax),
            })
          }}
        />
        <TextField
          label={t.skills.cooldown}
          value={cooldown}
          inputMode="numeric"
          onChange={(e) => {
            setCooldown(e.target.value)
            const n = parseNumber(e.target.value)
            set({ cooldown: n !== null && n > 0 ? Math.round(n) : 0 })
          }}
        />
        <SelectField<SkillEffectKind>
          label={t.skills.effect}
          value={skill.effect.kind}
          onChange={(kind) => set({ effect: { ...skill.effect, kind } })}
          options={(['none', 'damage', 'heal', 'condition'] as const).map((k) => ({
            value: k,
            label: t.skills.effectKinds[k],
          }))}
        />
        {(skill.effect.kind === 'damage' || skill.effect.kind === 'heal') && (
          <TextField
            label={t.skills.effectExpression}
            value={skill.effect.expression}
            placeholder="2d6+1"
            inputClassName="font-mono"
            onChange={(e) => set({ effect: { ...skill.effect, expression: e.target.value } })}
          />
        )}
        {skill.effect.kind === 'condition' && (
          <SelectField<string>
            label={t.skills.effectCondition}
            value={skill.effect.conditionId ?? ''}
            onChange={(conditionId) =>
              set({ effect: { ...skill.effect, conditionId: conditionId || null } })
            }
            options={[
              { value: '', label: t.common.none },
              ...conditions.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        )}
      </div>
    </fieldset>
  )
}
