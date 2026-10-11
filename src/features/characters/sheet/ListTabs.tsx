import { Plus, Trash } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button, IconButton } from '@/components/ui/Button'
import { CommitInput, NumberInput } from '@/components/ui/fields'
import { TextField } from '@/components/ui/TextField'
import type { Entity, Item } from '@/domain/types'
import { formatRelativeTime, useIntlLocale, useT } from '@/i18n'
import type { SheetEditor } from '../useSheetEditor'

export function ConditionsTab({ entity, editor }: { entity: Entity; editor: SheetEditor }) {
  const t = useT()
  const [name, setName] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    editor.addCondition({ name: name.trim(), note: '' })
    setName('')
  }
  return (
    <div className="space-y-4">
      {entity.conditions.length === 0 ? (
        <p className="text-sm text-ink-muted">{t.conditions.empty}</p>
      ) : (
        <ul className="space-y-2">
          {entity.conditions.map((c) => (
            <li
              key={c.id}
              className="flex items-end gap-2 rounded-md border border-line bg-surface p-3"
            >
              <CommitInput
                label={t.conditions.name}
                value={c.name}
                onCommit={(v) => v && editor.updateCondition({ ...c, name: v })}
                className="w-48"
              />
              <CommitInput
                label={t.conditions.note}
                value={c.note}
                onCommit={(note) => editor.updateCondition({ ...c, note })}
                className="flex-1"
              />
              <IconButton
                label={`${t.common.remove} : ${c.name}`}
                icon={<Trash />}
                onClick={() => editor.removeCondition(c)}
              />
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="flex items-end gap-2">
        <TextField
          label={t.conditions.add}
          value={name}
          placeholder={t.conditions.placeholder}
          onChange={(e) => setName(e.target.value)}
          className="w-64"
        />
        <Button type="submit" icon={<Plus />} disabled={!name.trim()}>
          {t.common.add}
        </Button>
      </form>
    </div>
  )
}

/** Inventory editor, used by the sheet and (with local state) by the wizard. */
export function InventoryEditor({
  items,
  onAdd,
  onUpdate,
  onRemove,
}: {
  items: Item[]
  onAdd: (item: Omit<Item, 'id'>) => void
  onUpdate: (item: Item) => void
  onRemove: (item: Item) => void
}) {
  const t = useT()
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState(1)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onAdd({ name: name.trim(), quantity, description: '' })
    setName('')
    setQuantity(1)
  }
  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <p className="text-sm text-ink-muted">{t.inventory.empty}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-end gap-2 rounded-md border border-line bg-surface p-3"
            >
              <CommitInput
                label={t.inventory.name}
                value={item.name}
                onCommit={(v) => v && onUpdate({ ...item, name: v })}
                className="min-w-40 flex-1"
              />
              <NumberInput
                label={t.inventory.quantity}
                value={item.quantity}
                min={0}
                max={9999}
                onCommit={(q) => onUpdate({ ...item, quantity: q })}
                className="w-24"
              />
              <CommitInput
                label={t.inventory.description}
                value={item.description}
                onCommit={(description) => onUpdate({ ...item, description })}
                className="min-w-40 flex-[2]"
              />
              <IconButton
                label={`${t.common.remove} : ${item.name}`}
                icon={<Trash />}
                onClick={() => onRemove(item)}
              />
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
        <TextField
          label={t.inventory.add}
          value={name}
          placeholder={t.inventory.placeholder}
          onChange={(e) => setName(e.target.value)}
          className="w-64"
        />
        <TextField
          label={t.inventory.quantity}
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
          className="w-24"
        />
        <Button type="submit" icon={<Plus />} disabled={!name.trim()}>
          {t.common.add}
        </Button>
      </form>
    </div>
  )
}

export function JournalTab({ entity }: { entity: Entity }) {
  const t = useT()
  const intl = useIntlLocale()
  const entries = [...entity.journal].reverse()
  if (entries.length === 0) return <p className="text-sm text-ink-muted">{t.journal.empty}</p>
  return (
    <ol className="space-y-2">
      {entries.map((entry) => (
        <li key={entry.id} className="flex gap-3 text-sm">
          <span className="mt-1.5 size-1.5 shrink-0 rotate-45 bg-gold" aria-hidden />
          <span className="flex-1 text-ink">{entry.text}</span>
          <time
            dateTime={new Date(entry.at).toISOString()}
            className="shrink-0 text-xs text-ink-muted"
          >
            {formatRelativeTime(entry.at, intl, t.time.justNow)}
          </time>
        </li>
      ))}
    </ol>
  )
}
