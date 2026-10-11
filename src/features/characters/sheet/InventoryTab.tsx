import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion } from 'framer-motion'
import { Coins, Ellipsis, GripVertical, LayoutGrid, List, Plus, Search } from 'lucide-react'
import { useMemo, useState, type DragEvent, type FormEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Button, IconButton } from '@/components/ui/Button'
import { SelectField } from '@/components/ui/fields'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { TextField } from '@/components/ui/TextField'
import { itemLibrary } from '@/db/itemLibrary'
import { entityName } from '@/domain/entity'
import {
  carriedWeight,
  carryCapacity,
  formatPurse,
  isOverloaded,
  newItem,
  parseMoney,
  slotsFor,
} from '@/domain/items'
import {
  EQUIP_SLOTS,
  ITEM_TYPES,
  RARITIES,
  type Entity,
  type Item,
  type ItemType,
  type Rarity,
} from '@/domain/types'
import { useGameActions } from '@/features/game/useGameActions'
import { useCampaign } from '@/features/shell/campaignContext'
import { useT } from '@/i18n'
import { cn } from '@/lib/cn'
import { useCampaignStore } from '@/stores/campaignStore'
import { RARITY_CLASSES } from '../conditionStyles'
import { ItemDialog } from '../ItemDialog'
import { IdentifyDialog } from '../play/PlayDialogs'
import type { SheetEditor } from '../useSheetEditor'

const DRAG_TYPE = 'application/x-codex-item'
const MENU_ITEM =
  'flex min-h-9 cursor-pointer items-center rounded-sm px-2.5 py-1.5 text-sm text-ink outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-2'
const MENU = 'z-50 min-w-52 rounded-md border border-line bg-surface p-1 shadow-overlay'

/** Inventory (SPEC §4.11): equipment, weight, purse, filters, use, identify, give. */
export function InventoryTab({ entity, editor }: { entity: Entity; editor: SheetEditor }) {
  const t = useT()
  const actions = useGameActions()
  const [query, setQuery] = useState('')
  const [type, setType] = useState<ItemType | 'all'>('all')
  const [rarity, setRarity] = useState<Rarity | 'all'>('all')
  const [view, setView] = useState<'list' | 'grid'>('list')
  const [editing, setEditing] = useState<Item | null>(null)
  const [identifying, setIdentifying] = useState<string | null>(null)
  const inCampaign = Boolean(useCampaignStore((s) => s.entities[entity.id]))
  const others = useCampaignStore(
    useShallow((s) =>
      Object.values(s.entities)
        .filter((e) => e.id !== entity.id)
        .sort((a, b) => entityName(a).localeCompare(entityName(b), 'fr')),
    ),
  )

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return entity.inventory.filter(
      (i) =>
        (type === 'all' || i.type === type) &&
        (rarity === 'all' || i.rarity === rarity) &&
        (!q || i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q)),
    )
  }, [entity.inventory, query, type, rarity])

  const save = (item: Item) => {
    if (entity.inventory.some((i) => i.id === item.id)) editor.updateItem(item)
    else editor.addItem(item)
    setEditing(null)
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Purse entity={entity} />
        <WeightBar entity={entity} />
      </div>

      <section aria-labelledby="equipment-heading">
        <h3
          id="equipment-heading"
          className="mb-2 font-sans text-sm font-semibold tracking-normal text-ink"
        >
          {t.inventory.equipment}
        </h3>
        <ul className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {EQUIP_SLOTS.map((slot) => {
            const item = entity.inventory.find((i) => i.slot === slot)
            return (
              <li
                key={slot}
                className={cn(
                  'rounded-md border border-l-4 border-line bg-surface px-3 py-2',
                  item ? RARITY_CLASSES[item.rarity].edge : 'border-dashed border-line',
                )}
              >
                <p className="text-xs text-ink-muted">{t.inventory.slots[slot]}</p>
                <p
                  className={cn(
                    'truncate text-sm',
                    item ? 'font-medium text-ink' : 'text-ink-muted',
                  )}
                >
                  {item?.name ?? t.inventory.emptySlot}
                </p>
              </li>
            )
          })}
        </ul>
      </section>

      <div className="flex flex-wrap items-end gap-2">
        <div className="relative min-w-48 flex-1">
          <TextField
            label={t.inventory.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            inputClassName="pl-8"
          />
          <Search
            className="pointer-events-none absolute bottom-3 left-2.5 size-4 text-ink-muted"
            aria-hidden
          />
        </div>
        <SelectField<ItemType | 'all'>
          label={t.inventory.type}
          value={type}
          onChange={setType}
          options={[
            { value: 'all', label: t.inventory.allTypes },
            ...ITEM_TYPES.map((k) => ({ value: k, label: t.inventory.types[k] })),
          ]}
        />
        <SelectField<Rarity | 'all'>
          label={t.inventory.rarity}
          value={rarity}
          onChange={setRarity}
          options={[
            { value: 'all', label: t.inventory.allRarities },
            ...RARITIES.map((k) => ({ value: k, label: t.inventory.rarities[k] })),
          ]}
        />
        <SegmentedControl<'list' | 'grid'>
          label={t.inventory.view}
          value={view}
          onValueChange={setView}
          options={[
            { value: 'list', label: t.inventory.list, icon: <List /> },
            { value: 'grid', label: t.inventory.grid, icon: <LayoutGrid /> },
          ]}
          className="mb-0.5"
        />
      </div>

      {entity.inventory.length === 0 ? (
        <p className="text-sm text-ink-muted">{t.inventory.empty}</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-ink-muted">{t.inventory.noMatch}</p>
      ) : (
        <ul
          className={cn(view === 'grid' ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3' : 'space-y-2')}
          aria-label={t.sheet.tabs.inventory}
        >
          <AnimatePresence initial={false}>
            {shown.map((item) => (
              <motion.li
                key={item.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <ItemRow
                  item={item}
                  entity={entity}
                  others={inCampaign ? others : []}
                  inCampaign={inCampaign}
                  onEdit={() => setEditing(item)}
                  onIdentify={() => setIdentifying(item.id)}
                  editor={editor}
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {inCampaign && others.length > 0 && entity.inventory.length > 0 && (
        <section aria-labelledby="give-heading">
          <h3 id="give-heading" className="mb-2 text-xs text-ink-muted">
            {t.inventory.dropTargets}
          </h3>
          <ul className="flex flex-wrap gap-2">
            {others.map((other) => (
              <DropTarget
                key={other.id}
                name={entityName(other)}
                onDropItem={(itemId) => actions.giveItem(entity.id, other.id, itemId)}
              />
            ))}
          </ul>
        </section>
      )}

      <AddItems onNew={() => setEditing(newItem({ name: '' }))} editor={editor} />

      <ItemDialog item={editing} onClose={() => setEditing(null)} onSave={save} />
      {identifying && (
        <IdentifyDialog entity={entity} itemId={identifying} onClose={() => setIdentifying(null)} />
      )}
    </div>
  )
}

function Purse({ entity }: { entity: Entity }) {
  const t = useT()
  const campaign = useCampaign()
  const actions = useGameActions()
  const editor = useCampaignStore((s) => Boolean(s.entities[entity.id]))
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  return (
    <section
      className="rounded-lg border border-line bg-surface p-4"
      aria-labelledby="purse-heading"
    >
      <h3
        id="purse-heading"
        className="mb-2 flex items-center gap-2 font-sans text-sm font-semibold tracking-normal text-ink"
      >
        <Coins className="size-4 text-gold" aria-hidden />
        {t.inventory.purse}
      </h3>
      <p className="tabular text-lg font-semibold text-ink" aria-live="polite">
        {formatPurse(entity.purse, campaign.rules.currency)}
      </p>
      {editor && (
        <form
          className="mt-2 flex items-end gap-2"
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            const delta = parseMoney(value, campaign.rules.currency)
            if (delta === null) return setError(t.inventory.purseInvalid)
            actions.changeMoney(entity.id, delta)
            setValue('')
            setError(null)
          }}
        >
          <TextField
            label={t.inventory.purseChange}
            hint={
              campaign.rules.currency.length ? t.inventory.purseHint : t.inventory.purseHintPlain
            }
            value={value}
            error={error}
            onChange={(e) => {
              setValue(e.target.value)
              setError(null)
            }}
            className="flex-1"
          />
          <Button type="submit" icon={<Plus />} aria-label={t.common.add} />
        </form>
      )}
    </section>
  )
}

function WeightBar({ entity }: { entity: Entity }) {
  const t = useT()
  const campaign = useCampaign()
  const weight = carriedWeight(entity)
  const capacity = carryCapacity(entity, campaign.rules)
  const over = isOverloaded(entity, campaign.rules)
  const fmt = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',')
  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <h3 className="mb-2 font-sans text-sm font-semibold tracking-normal text-ink">
        {t.derived.carry}
      </h3>
      <p className={cn('tabular text-lg font-semibold', over ? 'text-hp-text' : 'text-ink')}>
        {t.derived.carryValue(fmt(weight), fmt(capacity))}
        {over && <span className="ml-2 text-sm">{t.status.overloaded}</span>}
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className={cn('h-full rounded-full', over ? 'bg-hp' : 'bg-accent')}
          style={{ width: `${Math.min(100, capacity ? (weight / capacity) * 100 : 100)}%` }}
        />
      </div>
    </section>
  )
}

function ItemRow({
  item,
  entity,
  others,
  onEdit,
  onIdentify,
  editor,
  inCampaign,
}: {
  item: Item
  entity: Entity
  others: Entity[]
  inCampaign: boolean
  onEdit: () => void
  onIdentify: () => void
  editor: SheetEditor
}) {
  const t = useT()
  const campaign = useCampaign()
  const actions = useGameActions()
  const slots = slotsFor(item.type)
  const hidden = item.hidden && !item.hidden.identified
  return (
    <div
      draggable={inCampaign}
      onDragStart={(e: DragEvent) => {
        e.dataTransfer.setData(DRAG_TYPE, item.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      className={cn(
        'flex h-full items-start gap-2 rounded-md border border-l-4 border-line bg-surface p-3',
        RARITY_CLASSES[item.rarity].edge,
      )}
    >
      {inCampaign && (
        <GripVertical className="mt-0.5 size-4 shrink-0 cursor-grab text-ink-muted" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink">
          {item.name}
          {item.quantity !== 1 && (
            <span className="tabular ml-1.5 text-ink-muted">×{item.quantity}</span>
          )}
        </p>
        <p className="text-xs text-ink-muted">
          {[
            t.inventory.types[item.type],
            t.inventory.rarities[item.rarity],
            item.weight ? `${String(item.weight).replace('.', ',')} kg` : '',
            item.value ? formatPurse(item.value, campaign.rules.currency) : '',
            item.damage,
            item.defense ? `${t.derived.defense} +${item.defense}` : '',
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          {item.slot && (
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-text">
              {t.inventory.slots[item.slot]}
            </span>
          )}
          {item.hidden && (
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-medium',
                hidden ? 'bg-surface-2 text-ink' : 'bg-gold-soft text-ink',
              )}
            >
              {hidden ? t.inventory.unidentified : t.inventory.identified}
            </span>
          )}
        </div>
        {item.description && (
          <p className="mt-1 text-sm whitespace-pre-line text-ink-muted">{item.description}</p>
        )}
        <AnimatePresence>
          {item.hidden?.identified && item.hidden.text && (
            <motion.p
              key="revealed"
              className="mt-1 rounded-sm bg-gold-soft px-2 py-1 text-sm text-ink"
              initial={{ rotateX: 90, opacity: 0 }}
              animate={{ rotateX: 0, opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              {item.hidden.text}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {item.use && inCampaign && (
          <Button size="sm" onClick={() => actions.useItem(entity.id, item.id)}>
            {t.inventory.useItem}
          </Button>
        )}
        {hidden && inCampaign && (
          <Button size="sm" onClick={onIdentify}>
            {t.inventory.identify}
          </Button>
        )}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <IconButton size="sm" label={t.inventory.actionsFor(item.name)} icon={<Ellipsis />} />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" sideOffset={4} className={MENU}>
              {slots.map((slot) => (
                <DropdownMenu.Item
                  key={slot}
                  className={MENU_ITEM}
                  onSelect={() => editor.equip(item.id, slot)}
                >
                  {t.inventory.equip(t.inventory.slots[slot])}
                </DropdownMenu.Item>
              ))}
              {item.slot && (
                <DropdownMenu.Item className={MENU_ITEM} onSelect={() => editor.unequip(item.id)}>
                  {t.inventory.unequip}
                </DropdownMenu.Item>
              )}
              {others.length > 0 && (
                <DropdownMenu.Sub>
                  <DropdownMenu.SubTrigger className={MENU_ITEM}>
                    {t.inventory.giveTo}
                  </DropdownMenu.SubTrigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.SubContent className={MENU}>
                      {others.map((o) => (
                        <DropdownMenu.Item
                          key={o.id}
                          className={MENU_ITEM}
                          onSelect={() => actions.giveItem(entity.id, o.id, item.id)}
                        >
                          {entityName(o)}
                        </DropdownMenu.Item>
                      ))}
                    </DropdownMenu.SubContent>
                  </DropdownMenu.Portal>
                </DropdownMenu.Sub>
              )}
              <DropdownMenu.Separator className="my-1 h-px bg-line" />
              <DropdownMenu.Item className={MENU_ITEM} onSelect={onEdit}>
                {t.common.edit}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className={cn(MENU_ITEM, 'text-hp-text')}
                onSelect={() => editor.removeItem(item)}
              >
                {t.common.delete}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </div>
  )
}

function DropTarget({ name, onDropItem }: { name: string; onDropItem: (itemId: string) => void }) {
  const t = useT()
  const [over, setOver] = useState(false)
  return (
    <li
      aria-label={t.inventory.dropOn(name)}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(DRAG_TYPE)) return
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const id = e.dataTransfer.getData(DRAG_TYPE)
        if (id) onDropItem(id)
      }}
      className={cn(
        'rounded-full border border-dashed px-3 py-1.5 text-sm transition-colors',
        over ? 'border-accent bg-accent-soft text-accent-text' : 'border-line-strong text-ink',
      )}
    >
      {name}
    </li>
  )
}

function AddItems({ onNew, editor }: { onNew: () => void; editor: SheetEditor }) {
  const t = useT()
  const library = useLiveQuery(() => itemLibrary.list(), []) ?? []
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [fromLibrary, setFromLibrary] = useState('')
  return (
    <div className="grid gap-4 border-t border-line pt-4 md:grid-cols-2">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim()) return
          editor.addItem(
            newItem({ name: name.trim(), quantity: Math.max(1, Number(quantity) || 1) }),
          )
          setName('')
          setQuantity('1')
        }}
      >
        <TextField
          label={t.inventory.add}
          value={name}
          placeholder={t.inventory.placeholder}
          onChange={(e) => setName(e.target.value)}
          className="min-w-40 flex-1"
        />
        <TextField
          label={t.inventory.quantity}
          value={quantity}
          inputMode="numeric"
          onChange={(e) => setQuantity(e.target.value)}
          className="w-20"
        />
        <Button type="submit" icon={<Plus />} disabled={!name.trim()}>
          {t.common.add}
        </Button>
        <Button variant="ghost" onClick={onNew}>
          {t.inventory.newItem}…
        </Button>
      </form>
      {library.length > 0 && (
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const template = library.find((i) => i.id === fromLibrary) ?? library[0]
            if (template) editor.addItem({ ...template, slot: null })
          }}
        >
          <SelectField<string>
            label={t.inventory.fromLibrary}
            value={fromLibrary || library[0]!.id}
            onChange={setFromLibrary}
            options={library.map((i) => ({ value: i.id, label: i.name }))}
            className="flex-1"
          />
          <Button type="submit" icon={<Plus />}>
            {t.common.add}
          </Button>
        </form>
      )}
    </div>
  )
}
