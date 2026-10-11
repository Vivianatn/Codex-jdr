import { AnimatePresence, motion } from 'framer-motion'
import { Hourglass, Plus, SkipForward, Trash } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button, IconButton } from '@/components/ui/Button'
import { CommitInput, SelectField } from '@/components/ui/fields'
import { TextField } from '@/components/ui/TextField'
import { allConditionTemplates, plainCondition } from '@/domain/conditions'
import type { Condition, Entity } from '@/domain/types'
import { useGameActions } from '@/features/game/useGameActions'
import { useCampaign } from '@/features/shell/campaignContext'
import { useT } from '@/i18n'
import { cn } from '@/lib/cn'
import { CONDITION_COLOR_CLASSES, CONDITION_ICON_COMPONENTS } from '../conditionStyles'
import type { SheetEditor } from '../useSheetEditor'

/** Applied conditions with durations, effects and saves (SPEC §4.10). */
export function ConditionsTab({ entity, editor }: { entity: Entity; editor: SheetEditor }) {
  const t = useT()
  const campaign = useCampaign()
  const actions = useGameActions()
  const library = allConditionTemplates(campaign.library.conditions)
  const [templateId, setTemplateId] = useState(library[0]?.id ?? '')
  const [freeName, setFreeName] = useState('')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-surface-2 px-4 py-3">
        <p className="text-sm text-ink-muted">{t.turn.passHint}</p>
        <Button icon={<SkipForward />} onClick={() => actions.passTurn(entity.id)}>
          {t.turn.pass}
        </Button>
      </div>

      {entity.conditions.length === 0 ? (
        <p className="text-sm text-ink-muted">{t.conditions.empty}</p>
      ) : (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {entity.conditions.map((c) => (
              <motion.li
                key={c.id}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.25 } }}
              >
                <ConditionRow condition={c} entity={entity} editor={editor} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <form
          className="flex items-end gap-2"
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            if (templateId) actions.addConditionFromTemplate([entity.id], templateId)
          }}
        >
          <SelectField<string>
            label={t.conditions.fromLibrary}
            value={templateId}
            onChange={setTemplateId}
            options={library.map((c) => ({
              value: c.id,
              label: c.duration ? `${c.name} (${t.conditions.remaining(c.duration)})` : c.name,
            }))}
            className="flex-1"
          />
          <Button type="submit" variant="primary" icon={<Plus />}>
            {t.common.add}
          </Button>
        </form>
        <form
          className="flex items-end gap-2"
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            if (!freeName.trim()) return
            editor.addCondition(plainCondition(freeName.trim()))
            setFreeName('')
          }}
        >
          <TextField
            label={t.conditions.custom}
            value={freeName}
            placeholder={t.conditions.placeholder}
            onChange={(e) => setFreeName(e.target.value)}
            className="flex-1"
          />
          <Button
            type="submit"
            icon={<Plus />}
            disabled={!freeName.trim()}
            aria-label={t.conditions.add}
          />
        </form>
      </div>
    </div>
  )
}

function ConditionRow({
  condition: c,
  entity,
  editor,
}: {
  condition: Condition
  entity: Entity
  editor: SheetEditor
}) {
  const t = useT()
  const actions = useGameActions()
  const Icon = CONDITION_ICON_COMPONENTS[c.icon]
  const colors = CONDITION_COLOR_CLASSES[c.color]
  const effects = [
    ...c.modifiers.map((m) => `${t.stats.abbr[m.stat]} ${m.value >= 0 ? '+' : ''}${m.value}`),
    c.perTurn
      ? t.conditions.perTurnSummary(t.conditions.perTurnKinds[c.perTurn.kind], c.perTurn.expression)
      : '',
    c.concentration ? t.checks.concentration : '',
  ].filter(Boolean)
  return (
    <div className={cn('rounded-md border border-l-4 border-line bg-surface p-3', colors.edge)}>
      <div className="flex flex-wrap items-start gap-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface"
          aria-hidden
        >
          <Icon className={cn('size-4', colors.icon)} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink">{c.name}</p>
          <p className="text-xs text-ink-muted">
            {effects.length ? effects.join(' · ') : t.conditions.noEffect}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-1 text-xs text-ink">
            <Hourglass className="size-3" aria-hidden />
            {c.remaining === null ? t.conditions.untilRemoved : t.conditions.remaining(c.remaining)}
          </span>
          {c.save && (
            <Button size="sm" onClick={() => actions.trySave(entity.id, c.id)}>
              {t.conditions.trySave(t.stats.names[c.save])}
            </Button>
          )}
          <IconButton
            label={`${t.common.remove} : ${c.name}`}
            icon={<Trash />}
            size="sm"
            onClick={() => editor.removeCondition(c)}
          />
        </div>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-[8rem_1fr]">
        <CommitInput
          label={t.conditions.duration}
          hint={t.conditions.durationHint}
          value={c.remaining === null ? '' : String(c.remaining)}
          inputMode="numeric"
          onCommit={(v) => {
            const n = Number(v)
            editor.updateCondition({ ...c, remaining: v && n > 0 ? Math.round(n) : null })
          }}
        />
        <CommitInput
          label={t.conditions.note}
          value={c.note}
          onCommit={(note) => editor.updateCondition({ ...c, note })}
        />
      </div>
    </div>
  )
}
