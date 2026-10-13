import { motion } from 'framer-motion'
import { Star, Trash, X } from 'lucide-react'
import { GameIcon } from '@/components/GameIcon'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button, IconButton } from '@/components/ui/Button'
import { CheckboxField, SelectField } from '@/components/ui/fields'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { TextField } from '@/components/ui/TextField'
import { campaignRepository } from '@/db/campaigns'
import { DiceSyntaxError, validateDice } from '@/dice'
import type { RollMode } from '@/domain/checks'
import { entityName } from '@/domain/entity'
import { diceErrorMessage } from '@/features/game/diceErrors'
import { useGameActions } from '@/features/game/useGameActions'
import { useCampaign } from '@/features/shell/campaignContext'
import { useT } from '@/i18n'
import { useCampaignStore } from '@/stores/campaignStore'
import { useRollStore } from '@/stores/rollStore'
import { useUiStore } from '@/stores/uiStore'
import { useRollerName } from './useRollerName'
import { RollCard } from './RollCard'
import { recordActivity } from '@/stores/activityLog'
import { compareText } from '@/lib/text'

const QUICK_DICE = [4, 6, 8, 10, 12, 20, 100]
const GM = '__gm__'

/** Header button that opens the dice tray. */
export function DiceButton() {
  const t = useT()
  const open = useUiStore((s) => s.diceOpen)
  const setOpen = useUiStore((s) => s.setDiceOpen)
  return (
    <IconButton
      label={t.dice.open}
      icon={<GameIcon name="rolling-dices" />}
      variant={open ? 'secondary' : 'ghost'}
      aria-pressed={open}
      onClick={() => setOpen(!open)}
    />
  )
}

/**
 * Dice tray (SPEC §7): free notation, quick dice, advantage, secret rolls,
 * favourites and the history. A side panel over the page — never a modal.
 */
export function DicePanel() {
  const t = useT()
  const open = useUiStore((s) => s.diceOpen)
  const setOpen = useUiStore((s) => s.setDiceOpen)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    input.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  if (!open) return null
  return (
    <motion.aside
      aria-label={t.dice.title}
      className="glass fixed top-14 right-0 bottom-0 z-30 flex w-full max-w-sm flex-col border-l border-line shadow-overlay"
      initial={{ x: 32, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
          <GameIcon name="rolling-dices" className="size-5 text-accent-text" aria-hidden />
          {t.dice.title}
        </h2>
        <IconButton label={t.dice.close} icon={<X />} size="sm" onClick={() => setOpen(false)} />
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        <Tray inputRef={input} />
        <Macros />
        <History />
      </div>
    </motion.aside>
  )
}

function Tray({ inputRef }: { inputRef: React.RefObject<HTMLInputElement> }) {
  const t = useT()
  const actions = useGameActions()
  const entities = useCampaignStore((s) => s.entities)
  const [expression, setExpression] = useState('1d20')
  const [mode, setMode] = useState<RollMode>('normal')
  const [secret, setSecret] = useState(false)
  const [who, setWho] = useState(GM)
  const [error, setError] = useState<string | null>(null)
  const roller = who === GM ? null : who

  function rollIt(expr: string) {
    try {
      actions.freeRoll(expr, { entityId: roller, secret, mode })
      setError(null)
    } catch (e) {
      setError(diceErrorMessage(t, e))
      if (!(e instanceof DiceSyntaxError)) throw e
    }
  }

  const people = useMemo(
    () => Object.values(entities).sort((a, b) => compareText(entityName(a), entityName(b))),
    [entities],
  )

  return (
    <form
      className="space-y-3"
      onSubmit={(e: FormEvent) => {
        e.preventDefault()
        rollIt(expression)
      }}
    >
      <div className="flex items-end gap-2">
        <TextField
          ref={inputRef}
          label={t.dice.expression}
          value={expression}
          placeholder={t.dice.placeholder}
          onChange={(e) => {
            setExpression(e.target.value)
            setError(null)
          }}
          error={error}
          className="flex-1"
          inputClassName="font-mono"
          autoComplete="off"
          spellCheck={false}
        />
        <Button type="submit" variant="primary" icon={<GameIcon name="rolling-dices" />}>
          {t.dice.roll}
        </Button>
      </div>
      <div role="group" aria-label={t.dice.quick} className="flex flex-wrap gap-1.5">
        {QUICK_DICE.map((sides) => (
          <Button
            key={sides}
            size="sm"
            onClick={() => rollIt(`1d${sides}`)}
            aria-label={t.dice.quickDie(sides)}
          >
            d{sides}
          </Button>
        ))}
      </div>
      <SegmentedControl<RollMode>
        label={t.dice.mode}
        size="sm"
        value={mode}
        onValueChange={setMode}
        options={[
          { value: 'normal', label: t.dice.normal },
          { value: 'advantage', label: t.dice.advantage },
          { value: 'disadvantage', label: t.dice.disadvantage },
        ]}
      />
      <div className="grid grid-cols-2 items-end gap-3">
        <SelectField<string>
          label={t.dice.for}
          value={who}
          onChange={setWho}
          options={[
            { value: GM, label: t.dice.gm },
            ...people.map((e) => ({ value: e.id, label: entityName(e) })),
          ]}
        />
        <CheckboxField
          label={t.dice.secret}
          checked={secret}
          onChange={setSecret}
          className="pb-2.5"
        />
      </div>
    </form>
  )
}

function Macros() {
  const t = useT()
  const campaign = useCampaign()
  const actions = useGameActions()
  const [name, setName] = useState('')
  const [expression, setExpression] = useState('')
  const [error, setError] = useState<string | null>(null)
  const macros = campaign.library.macros
  const save = (next: typeof macros) => {
    void campaignRepository.updateLibrary(campaign.id, { ...campaign.library, macros: next })
    recordActivity(campaign.id, t.activity.macros)
  }

  return (
    <section aria-labelledby="macros-heading" className="space-y-2">
      <h3
        id="macros-heading"
        className="flex items-center gap-2 font-sans text-sm font-semibold tracking-normal text-ink"
      >
        <Star className="size-4 text-gold" aria-hidden />
        {t.dice.macros}
      </h3>
      {macros.length === 0 ? (
        <p className="text-xs text-ink-muted">{t.dice.macrosEmpty}</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {macros.map((m) => (
            <li key={m.id} className="flex items-center rounded-md border border-line bg-surface">
              <button
                type="button"
                className="px-2.5 py-1.5 text-sm text-ink hover:text-accent-text"
                aria-label={t.dice.rollMacro(m.name, m.expression)}
                onClick={() => actions.freeRoll(m.expression, { label: m.name })}
              >
                {m.name} <span className="font-mono text-xs text-ink-muted">{m.expression}</span>
              </button>
              <IconButton
                size="sm"
                label={t.dice.removeMacro(m.name)}
                icon={<X />}
                onClick={() => save(macros.filter((x) => x.id !== m.id))}
              />
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          try {
            validateDice(expression)
            save([
              ...macros,
              {
                id: crypto.randomUUID(),
                name: name.trim() || expression.trim(),
                expression: expression.trim(),
              },
            ])
            setName('')
            setExpression('')
            setError(null)
          } catch (err) {
            setError(diceErrorMessage(t, err))
          }
        }}
      >
        <TextField
          label={t.dice.macroName}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-28"
        />
        <TextField
          label={t.dice.macroExpression}
          value={expression}
          onChange={(e) => setExpression(e.target.value)}
          error={error}
          className="flex-1"
          inputClassName="font-mono"
        />
        <Button type="submit" size="md" icon={<Star />} aria-label={t.dice.saveMacro} />
      </form>
    </section>
  )
}

function History() {
  const t = useT()
  const rolls = useRollStore((s) => s.rolls)
  const clear = useRollStore((s) => s.clear)
  const entities = useCampaignStore((s) => s.entities)
  const nameOf = useRollerName()
  const [filter, setFilter] = useState('all')
  const shown = [...rolls]
    .reverse()
    .filter(
      (r) => filter === 'all' || (filter === GM ? r.entityId === null : r.entityId === filter),
    )
    .slice(0, 100)
  const rollers = [
    ...new Set(
      rolls.map((r) => r.entityId).filter((id): id is string => Boolean(id && entities[id])),
    ),
  ]

  return (
    <section aria-labelledby="history-heading" className="space-y-2">
      <div className="flex items-end justify-between gap-2">
        <h3
          id="history-heading"
          className="font-sans text-sm font-semibold tracking-normal text-ink"
        >
          {t.dice.history}
        </h3>
        {rolls.length > 0 && (
          <IconButton
            size="sm"
            label={t.dice.clearHistory}
            icon={<Trash />}
            onClick={async () => {
              await clear()
              toast(t.dice.historyCleared)
            }}
          />
        )}
      </div>
      {rolls.length > 0 && (
        <SelectField<string>
          label={t.dice.filter}
          hideLabel
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: t.dice.all },
            { value: GM, label: t.dice.gm },
            ...rollers.map((id) => ({ value: id, label: entityName(entities[id]!) })),
          ]}
        />
      )}
      {shown.length === 0 ? (
        <p className="text-xs text-ink-muted">{t.dice.historyEmpty}</p>
      ) : (
        <ol className="space-y-2" aria-label={t.dice.history}>
          {shown.map((r) => (
            <li key={r.id}>
              <RollCard record={r} who={nameOf(r)} compact />
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
