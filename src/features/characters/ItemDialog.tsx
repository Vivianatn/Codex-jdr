import { ImagePlus } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { CheckboxField, SelectField } from '@/components/ui/fields'
import { TextAreaField, TextField } from '@/components/ui/TextField'
import { validateDice } from '@/dice'
import {
  ITEM_ICONS,
  ITEM_TYPES,
  RARITIES,
  STAT_KEYS,
  type Item,
  type ItemType,
  type Rarity,
} from '@/domain/types'
import { diceErrorMessage } from '@/features/game/diceErrors'
import { useT } from '@/i18n'
import { cn } from '@/lib/cn'
import { fitImage, imageFromFile } from '@/lib/images'
import { parseNumber } from '@/lib/numbers'
import { ITEM_ICON_COMPONENTS, RARITY_FRAME } from './itemIcons'
import { ItemArt } from './ItemTile'
import { ModifierRow } from './SkillDialog'

/** Full item editor (SPEC §4.11), used by inventories and the item library. */
export function ItemDialog({
  item,
  onClose,
  onSave,
}: {
  item: Item | null
  onClose: () => void
  onSave: (item: Item) => void
}) {
  const t = useT()
  return (
    <Dialog
      open={item !== null}
      onOpenChange={(o) => !o && onClose()}
      title={item?.name ? t.inventory.editItem : t.inventory.newItem}
      className="max-h-[calc(100vh-2rem)] max-w-xl overflow-y-auto"
    >
      {item && <ItemForm initial={item} onCancel={onClose} onSave={onSave} />}
    </Dialog>
  )
}

function ItemForm({
  initial,
  onCancel,
  onSave,
}: {
  initial: Item
  onCancel: () => void
  onSave: (item: Item) => void
}) {
  const t = useT()
  const [item, setItem] = useState(initial)
  const [numbers, setNumbers] = useState({
    quantity: String(initial.quantity),
    weight: String(initial.weight).replace('.', ','),
    value: String(initial.value),
    defense: String(initial.defense),
    difficulty: String(initial.hidden?.difficulty ?? 0),
  })
  const [errors, setErrors] = useState<{ name?: string; damage?: string; use?: string }>({})
  const set = (patch: Partial<Item>) => setItem((i) => ({ ...i, ...patch }))
  const num = (key: keyof typeof numbers) => ({
    value: numbers[key],
    inputMode: 'decimal' as const,
    onChange: (e: { target: { value: string } }) =>
      setNumbers((n) => ({ ...n, [key]: e.target.value })),
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    const next: { name?: string; damage?: string; use?: string } = {}
    if (!item.name.trim()) next.name = t.wizard.needName
    for (const [field, expression] of [
      ['damage', item.damage],
      ['use', item.use?.expression ?? ''],
    ] as const) {
      if (!expression.trim()) continue
      try {
        validateDice(expression)
      } catch (err) {
        next[field] = diceErrorMessage(t, err)
      }
    }
    setErrors(next)
    if (Object.keys(next).length) return
    const n = (key: keyof typeof numbers, fallback = 0) => parseNumber(numbers[key]) ?? fallback
    onSave({
      ...item,
      name: item.name.trim(),
      quantity: Math.max(1, Math.round(n('quantity', 1))),
      weight: Math.max(0, n('weight')),
      value: Math.max(0, Math.round(n('value'))),
      defense: Math.round(n('defense')),
      use: item.use?.expression.trim() ? item.use : null,
      hidden: item.hidden
        ? { ...item.hidden, difficulty: Math.max(0, Math.round(n('difficulty'))) }
        : null,
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <TextField
        label={t.inventory.name}
        value={item.name}
        onChange={(e) => set({ name: e.target.value })}
        error={errors.name}
        autoFocus
      />
      <ItemArtPicker item={item} onChange={set} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField<ItemType>
          label={t.inventory.type}
          value={item.type}
          onChange={(type) => set({ type })}
          options={ITEM_TYPES.map((k) => ({ value: k, label: t.inventory.types[k] }))}
        />
        <SelectField<Rarity>
          label={t.inventory.rarity}
          value={item.rarity}
          onChange={(rarity) => set({ rarity })}
          options={RARITIES.map((k) => ({ value: k, label: t.inventory.rarities[k] }))}
        />
        <TextField label={t.inventory.quantity} {...num('quantity')} />
        <TextField label={t.inventory.weight} {...num('weight')} />
        <TextField label={t.inventory.value} {...num('value')} />
        {(item.type === 'armor' || item.type === 'accessory') && (
          <TextField label={t.inventory.defense} {...num('defense')} />
        )}
        {item.type === 'weapon' && (
          <TextField
            label={t.inventory.damage}
            hint={t.inventory.damageHint}
            value={item.damage}
            error={errors.damage}
            inputClassName="font-mono"
            onChange={(e) => set({ damage: e.target.value })}
          />
        )}
      </div>
      <TextAreaField
        label={t.inventory.description}
        value={item.description}
        onChange={(e) => set({ description: e.target.value })}
      />

      {item.type !== 'consumable' && item.type !== 'misc' && (
        <fieldset className="space-y-2 rounded-md border border-line p-3">
          <legend className="px-1 text-sm font-medium text-ink">{t.inventory.modifiers}</legend>
          {item.modifiers.map((m) => (
            <p key={m.id} className="flex items-center justify-between text-sm">
              {t.stats.names[m.stat]} {m.value >= 0 ? '+' : ''}
              {m.value}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => set({ modifiers: item.modifiers.filter((x) => x.id !== m.id) })}
              >
                {t.common.remove}
              </Button>
            </p>
          ))}
          <ModifierRow
            statOptions={STAT_KEYS.map((k) => ({ value: k, label: t.stats.names[k] }))}
            onAdd={(stat, value) =>
              set({
                modifiers: [...item.modifiers, { id: crypto.randomUUID(), stat, value, label: '' }],
              })
            }
          />
        </fieldset>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField<'none' | 'heal' | 'damage'>
          label={t.inventory.use}
          value={item.use?.kind ?? 'none'}
          onChange={(kind) =>
            set({
              use: kind === 'none' ? null : { kind, expression: item.use?.expression || '2d4' },
            })
          }
          options={(['none', 'heal', 'damage'] as const).map((k) => ({
            value: k,
            label: t.inventory.useKinds[k],
          }))}
        />
        {item.use && (
          <TextField
            label={t.inventory.useExpression}
            value={item.use.expression}
            error={errors.use}
            inputClassName="font-mono"
            onChange={(e) => set({ use: { ...item.use!, expression: e.target.value } })}
          />
        )}
      </div>

      <fieldset className="space-y-3 rounded-md border border-line p-3">
        <legend className="px-1 text-sm font-medium text-ink">{t.inventory.hidden}</legend>
        <CheckboxField
          label={t.inventory.hidden}
          checked={item.hidden !== null}
          onChange={(on) =>
            set({ hidden: on ? { text: '', difficulty: 0, identified: false } : null })
          }
        />
        {item.hidden && (
          <>
            <TextAreaField
              label={t.inventory.hiddenText}
              value={item.hidden.text}
              onChange={(e) => set({ hidden: { ...item.hidden!, text: e.target.value } })}
            />
            <div className="grid items-end gap-4 sm:grid-cols-2">
              <TextField label={t.inventory.hiddenDifficulty} {...num('difficulty')} />
              <CheckboxField
                label={t.inventory.identified}
                checked={item.hidden.identified}
                onChange={(identified) => set({ hidden: { ...item.hidden!, identified } })}
                className="pb-2.5"
              />
            </div>
          </>
        )}
      </fieldset>

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

/** Icon from the set, or a picture imported by the GM. */
function ItemArtPicker({
  item,
  onChange,
}: {
  item: Item
  onChange: (patch: Partial<Item>) => void
}) {
  const t = useT()
  const input = useRef<HTMLInputElement>(null)
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-sm font-medium text-ink">{t.inventory.art}</legend>
      <div className="flex items-start gap-3">
        <span
          className={cn('size-16 shrink-0 rounded-md border-2', RARITY_FRAME[item.rarity].frame)}
        >
          <ItemArt item={item} />
        </span>
        <div className="flex flex-wrap gap-1">
          {ITEM_ICONS.map((key) => {
            const Icon = ITEM_ICON_COMPONENTS[key]
            const active = !item.image && item.icon === key
            return (
              <button
                key={key}
                type="button"
                aria-label={t.inventory.icons[key]}
                aria-pressed={active}
                title={t.inventory.icons[key]}
                onClick={() => onChange({ icon: key, image: null })}
                className={cn(
                  'flex size-8 items-center justify-center rounded-sm border transition-colors',
                  active
                    ? 'border-accent bg-accent-soft text-accent-text'
                    : 'border-line text-ink-muted hover:text-ink',
                )}
              >
                <Icon className="size-4" aria-hidden />
              </button>
            )
          })}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" icon={<ImagePlus />} onClick={() => input.current?.click()}>
          {t.inventory.image}
        </Button>
        {(item.image || item.icon) && (
          <Button size="sm" variant="ghost" onClick={() => onChange({ image: null, icon: null })}>
            {t.inventory.defaultArt}
          </Button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          try {
            onChange({ image: fitImage(await imageFromFile(file), 256, 256) })
          } catch {
            toast.error(t.identity.invalidImage)
          }
        }}
      />
    </fieldset>
  )
}
