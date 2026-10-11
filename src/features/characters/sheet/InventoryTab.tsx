import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CircleDot,
  Coins,
  Gift,
  Package,
  Pencil,
  Plus,
  Search,
  Shield,
  Shirt,
  Sword,
  Trash,
  Weight,
  type LucideIcon,
} from 'lucide-react'
import { useMemo, useState, type DragEvent, type FormEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/Button'
import { SelectField } from '@/components/ui/fields'
import { TextField } from '@/components/ui/TextField'
import { itemLibrary } from '@/db/itemLibrary'
import { effectiveStats, entityName } from '@/domain/entity'
import {
  carriedWeight,
  carryCapacity,
  defenseValue,
  formatPurse,
  hasCarryCapacity,
  isOverloaded,
  newItem,
  parseMoney,
  slotsFor,
} from '@/domain/items'
import {
  ITEM_TYPES,
  RARITIES,
  type EquipSlot,
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
import { BodyImage } from '../BodyPicker'
import { ItemDialog } from '../ItemDialog'
import { RARITY_FRAME } from '../itemIcons'
import { ItemArt } from '../ItemTile'
import { IdentifyDialog } from '../play/PlayDialogs'
import { Portrait } from '../Portrait'
import type { SheetEditor } from '../useSheetEditor'

const DRAG_TYPE = 'application/x-codex-item'
const BAG_COLUMNS = 6
const MIN_BAG_SLOTS = 24

const SLOT_ICONS: Record<EquipSlot, LucideIcon> = {
  mainHand: Sword,
  offHand: Shield,
  armor: Shirt,
  accessory1: CircleDot,
  accessory2: CircleDot,
}

const fmtKg = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',')

/**
 * Inventory laid out like a video game (SPEC §4.11): the character's body with
 * its equipment slots, a bag of framed item tiles, and the description of the
 * selected item with its actions. Drag & drop works, and every action also has
 * a button for keyboard use.
 */
export function InventoryTab({ entity, editor }: { entity: Entity; editor: SheetEditor }) {
  const t = useT()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [type, setType] = useState<ItemType | 'all'>('all')
  const [rarity, setRarity] = useState<Rarity | 'all'>('all')
  const [editing, setEditing] = useState<Item | null>(null)
  const [identifying, setIdentifying] = useState<string | null>(null)
  const inCampaign = useCampaignStore((s) => Boolean(s.entities[entity.id]))
  const others = useCampaignStore(
    useShallow((s) =>
      Object.values(s.entities)
        .filter((e) => e.id !== entity.id)
        .sort((a, b) => entityName(a).localeCompare(entityName(b), 'fr')),
    ),
  )

  const bag = useMemo(() => {
    const q = query.trim().toLowerCase()
    return entity.inventory.filter(
      (i) =>
        !i.slot &&
        (type === 'all' || i.type === type) &&
        (rarity === 'all' || i.rarity === rarity) &&
        (!q || i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q)),
    )
  }, [entity.inventory, query, type, rarity])
  const unequipped = entity.inventory.filter((i) => !i.slot).length
  const filtering = bag.length !== unequipped
  const emptySlots = filtering
    ? 0
    : Math.max(MIN_BAG_SLOTS, Math.ceil((bag.length + 1) / BAG_COLUMNS) * BAG_COLUMNS) - bag.length
  const selected = entity.inventory.find((i) => i.id === selectedId) ?? null

  const save = (item: Item) => {
    if (entity.inventory.some((i) => i.id === item.id)) editor.updateItem(item)
    else editor.addItem(item)
    setSelectedId(item.id)
    setEditing(null)
  }
  const equipDropped = (slot: EquipSlot) => (itemId: string) => {
    const item = entity.inventory.find((i) => i.id === itemId)
    if (item && slotsFor(item.type).includes(slot)) editor.equip(itemId, slot)
  }

  return (
    <div className="space-y-6">
      <ResourceBar entity={entity} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <EquipmentDoll
          entity={entity}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onDropOn={equipDropped}
        />

        <div className="space-y-4">
          <section
            aria-labelledby="bag-heading"
            className="rounded-lg border border-line bg-surface p-4"
            onDragOver={(e) => e.dataTransfer.types.includes(DRAG_TYPE) && e.preventDefault()}
            onDrop={(e) => {
              // Dropping an equipped item on the bag unequips it.
              const id = e.dataTransfer.getData(DRAG_TYPE)
              if (entity.inventory.find((i) => i.id === id)?.slot) editor.unequip(id)
            }}
          >
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <h3
                id="bag-heading"
                className="flex items-center gap-2 font-sans text-sm font-semibold tracking-normal text-ink"
              >
                <Package className="size-4 text-accent-text" aria-hidden />
                {t.inventory.bag}{' '}
                <span className="tabular font-normal text-ink-muted">({unequipped})</span>
              </h3>
              <div className="flex flex-wrap items-end gap-2">
                <div className="relative w-40">
                  <TextField
                    label={t.inventory.search}
                    hideLabel
                    placeholder={t.inventory.search}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    inputClassName="h-8 pl-7 text-xs"
                  />
                  <Search
                    className="pointer-events-none absolute top-2 left-2 size-4 text-ink-muted"
                    aria-hidden
                  />
                </div>
                <SelectField<ItemType | 'all'>
                  label={t.inventory.type}
                  hideLabel
                  value={type}
                  onChange={setType}
                  selectClassName="h-8 text-xs"
                  options={[
                    { value: 'all', label: t.inventory.allTypes },
                    ...ITEM_TYPES.map((k) => ({ value: k, label: t.inventory.types[k] })),
                  ]}
                />
                <SelectField<Rarity | 'all'>
                  label={t.inventory.rarity}
                  hideLabel
                  value={rarity}
                  onChange={setRarity}
                  selectClassName="h-8 text-xs"
                  options={[
                    { value: 'all', label: t.inventory.allRarities },
                    ...RARITIES.map((k) => ({ value: k, label: t.inventory.rarities[k] })),
                  ]}
                />
              </div>
            </div>
            {entity.inventory.length === 0 && (
              <p className="mb-3 text-sm text-ink-muted">{t.inventory.empty}</p>
            )}
            {filtering && bag.length === 0 && (
              <p className="mb-3 text-sm text-ink-muted">{t.inventory.noMatch}</p>
            )}
            <ul aria-label={t.inventory.bag} className="grid grid-cols-5 gap-2 sm:grid-cols-6">
              {bag.map((item) => (
                <li key={item.id}>
                  <BagTile
                    item={item}
                    selected={item.id === selectedId}
                    onSelect={() => setSelectedId(item.id === selectedId ? null : item.id)}
                  />
                </li>
              ))}
              {Array.from({ length: emptySlots }, (_, i) => (
                <li
                  key={`empty-${i}`}
                  aria-hidden
                  className="aspect-square rounded-md border border-dashed border-line bg-surface-2/50"
                />
              ))}
            </ul>
          </section>

          <ItemDetails
            item={selected}
            entity={entity}
            editor={editor}
            others={inCampaign ? others : []}
            inCampaign={inCampaign}
            onEdit={() => selected && setEditing(selected)}
            onIdentify={() => selected && setIdentifying(selected.id)}
            onRemoved={() => setSelectedId(null)}
          />
        </div>
      </div>

      {inCampaign && others.length > 0 && entity.inventory.length > 0 && (
        <section aria-labelledby="give-heading">
          <h3 id="give-heading" className="mb-2 text-xs text-ink-muted">
            {t.inventory.dropTargets}
          </h3>
          <ul className="flex flex-wrap gap-2">
            {others.map((other) => (
              <GiveTarget key={other.id} entity={other} fromId={entity.id} />
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

function ResourceBar({ entity }: { entity: Entity }) {
  const t = useT()
  const campaign = useCampaign()
  const rules = campaign.rules
  const actions = useGameActions()
  const inCampaign = useCampaignStore((s) => Boolean(s.entities[entity.id]))
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const weight = carriedWeight(entity)
  const capacity = hasCarryCapacity(rules) ? carryCapacity(entity, rules) : null
  const over = isOverloaded(entity, rules)
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <section
        aria-labelledby="purse-heading"
        className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface px-4 py-3"
      >
        <div className="min-w-32">
          <h3
            id="purse-heading"
            className="flex items-center gap-1.5 font-sans text-xs font-semibold tracking-normal text-ink-muted"
          >
            <Coins className="size-3.5 text-gold" aria-hidden />
            {t.inventory.purse}
          </h3>
          <p className="tabular text-lg font-semibold text-ink" aria-live="polite">
            {formatPurse(entity.purse, rules.currency)}
          </p>
        </div>
        {inCampaign && (
          <form
            className="flex flex-1 items-end gap-2"
            onSubmit={(e: FormEvent) => {
              e.preventDefault()
              const delta = parseMoney(value, rules.currency)
              if (delta === null) return setError(t.inventory.purseInvalid)
              actions.changeMoney(entity.id, delta)
              setValue('')
              setError(null)
            }}
          >
            <TextField
              label={t.inventory.purseChange}
              hint={rules.currency.length ? t.inventory.purseHint : t.inventory.purseHintPlain}
              value={value}
              error={error}
              onChange={(e) => {
                setValue(e.target.value)
                setError(null)
              }}
              className="min-w-40 flex-1"
            />
            <Button type="submit" icon={<Plus />} aria-label={t.common.add} />
          </form>
        )}
      </section>
      <section className="rounded-lg border border-line bg-surface px-4 py-3">
        <h3 className="flex items-center gap-1.5 font-sans text-xs font-semibold tracking-normal text-ink-muted">
          <Weight className="size-3.5" aria-hidden />
          {t.derived.carry}
        </h3>
        <p className={cn('tabular text-lg font-semibold', over ? 'text-hp-text' : 'text-ink')}>
          {capacity === null
            ? t.inventory.weightOnly(fmtKg(weight))
            : t.derived.carryValue(fmtKg(weight), fmtKg(capacity))}
          {over && <span className="ml-2 text-sm">{t.status.overloaded}</span>}
        </p>
        {capacity !== null && (
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className={cn('h-full rounded-full', over ? 'bg-hp' : 'bg-accent')}
              style={{ width: `${Math.min(100, capacity ? (weight / capacity) * 100 : 100)}%` }}
            />
          </div>
        )}
      </section>
    </div>
  )
}

/** The body with its equipment slots around it, like a character screen. */
function EquipmentDoll({
  entity,
  selectedId,
  onSelect,
  onDropOn,
}: {
  entity: Entity
  selectedId: string | null
  onSelect: (id: string) => void
  onDropOn: (slot: EquipSlot) => (itemId: string) => void
}) {
  const t = useT()
  const campaign = useCampaign()
  const defense = defenseValue(
    entity,
    campaign.rules,
    effectiveStats(entity, campaign.rules).dexterity.total,
  )
  const slot = (s: EquipSlot) => (
    <EquipSlotTile
      slot={s}
      item={entity.inventory.find((i) => i.slot === s) ?? null}
      selectedId={selectedId}
      onSelect={onSelect}
      onDropItem={onDropOn(s)}
    />
  )
  return (
    <section
      aria-labelledby="equipment-heading"
      className="rounded-lg border border-line bg-surface p-4"
    >
      <h3
        id="equipment-heading"
        className="mb-3 font-sans text-sm font-semibold tracking-normal text-ink"
      >
        {t.inventory.equipment}
      </h3>
      <div className="grid grid-cols-[5.5rem_minmax(0,1fr)_5.5rem] items-start gap-3">
        <div className="flex flex-col gap-4">
          {slot('mainHand')}
          {slot('armor')}
          {slot('accessory1')}
        </div>
        <BodyImage src={entity.identity.body} className="h-80 w-full" />
        <div className="flex flex-col gap-4">
          {slot('offHand')}
          {slot('accessory2')}
          {defense !== null && (
            <div className="rounded-md border border-line bg-surface-2 px-2 py-1.5 text-center">
              <p className="text-[10px] font-medium tracking-wide text-ink-muted uppercase">
                {t.derived.defense}
              </p>
              <p className="tabular font-display text-xl font-semibold text-ink">{defense}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function EquipSlotTile({
  slot,
  item,
  selectedId,
  onSelect,
  onDropItem,
}: {
  slot: EquipSlot
  item: Item | null
  selectedId: string | null
  onSelect: (id: string) => void
  onDropItem: (itemId: string) => void
}) {
  const t = useT()
  const [over, setOver] = useState(false)
  const Empty = SLOT_ICONS[slot]
  const label = t.inventory.slots[slot]
  return (
    <div
      className="flex flex-col items-center gap-1"
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(DRAG_TYPE)) return
        e.preventDefault()
        e.stopPropagation()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setOver(false)
        const id = e.dataTransfer.getData(DRAG_TYPE)
        if (id) onDropItem(id)
      }}
    >
      {item ? (
        <button
          type="button"
          draggable
          onDragStart={(e: DragEvent) => e.dataTransfer.setData(DRAG_TYPE, item.id)}
          onClick={() => onSelect(item.id)}
          aria-label={`${label} : ${item.name}`}
          aria-pressed={item.id === selectedId}
          className={cn(
            'size-16 rounded-md border-2 transition-transform hover:-translate-y-0.5',
            RARITY_FRAME[item.rarity].frame,
            item.id === selectedId && 'ring-2 ring-accent ring-offset-2 ring-offset-surface',
            over && 'scale-105',
          )}
        >
          <ItemArt item={item} />
        </button>
      ) : (
        <span
          aria-label={`${label} : ${t.inventory.emptySlot}`}
          role="img"
          className={cn(
            'flex size-16 items-center justify-center rounded-md border-2 border-dashed border-line bg-surface-2/60 transition-colors',
            over && 'border-accent bg-accent-soft',
          )}
        >
          <Empty className="size-6 text-ink-muted/40" aria-hidden />
        </span>
      )}
      <span className="w-full text-center text-[11px] leading-tight text-ink-muted">{label}</span>
    </div>
  )
}

function BagTile({
  item,
  selected,
  onSelect,
}: {
  item: Item
  selected: boolean
  onSelect: () => void
}) {
  const t = useT()
  const hidden = item.hidden && !item.hidden.identified
  return (
    <button
      type="button"
      draggable
      onDragStart={(e: DragEvent) => {
        e.dataTransfer.setData(DRAG_TYPE, item.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={t.inventory.tileLabel(
        item.name,
        item.quantity,
        t.inventory.rarities[item.rarity],
      )}
      title={item.name}
      className={cn(
        'relative block aspect-square w-full rounded-md border-2 transition-transform hover:-translate-y-0.5',
        RARITY_FRAME[item.rarity].frame,
        selected && 'ring-2 ring-accent ring-offset-2 ring-offset-surface',
      )}
    >
      <ItemArt item={item} />
      {item.quantity > 1 && (
        <span className="tabular absolute right-0.5 bottom-0.5 rounded-sm bg-ink/80 px-1 text-[10px] leading-4 font-semibold text-bg">
          {item.quantity}
        </span>
      )}
      {hidden && (
        <span className="absolute top-0.5 left-0.5 flex size-4 items-center justify-center rounded-full bg-ink/80 text-[10px] font-bold text-bg">
          ?
        </span>
      )}
    </button>
  )
}

/** Description of the selected item, like a game tooltip, with its actions. */
function ItemDetails({
  item,
  entity,
  editor,
  others,
  inCampaign,
  onEdit,
  onIdentify,
  onRemoved,
}: {
  item: Item | null
  entity: Entity
  editor: SheetEditor
  others: Entity[]
  inCampaign: boolean
  onEdit: () => void
  onIdentify: () => void
  onRemoved: () => void
}) {
  const t = useT()
  const campaign = useCampaign()
  const actions = useGameActions()
  const [giveTo, setGiveTo] = useState('')
  if (!item)
    return (
      <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-ink-muted">
        {t.inventory.selectHint}
      </p>
    )
  const frame = RARITY_FRAME[item.rarity]
  const hidden = item.hidden && !item.hidden.identified
  const rows: [string, string][] = [
    [t.inventory.quantity, String(item.quantity)],
    ...(item.damage ? [[t.inventory.damage, item.damage] as [string, string]] : []),
    ...(item.defense ? [[t.derived.defense, `+${item.defense}`] as [string, string]] : []),
    ...item.modifiers.map(
      (m) => [t.stats.names[m.stat], `${m.value >= 0 ? '+' : ''}${m.value}`] as [string, string],
    ),
    ...(item.use
      ? [
          [t.inventory.use, `${t.inventory.useKinds[item.use.kind]} ${item.use.expression}`] as [
            string,
            string,
          ],
        ]
      : []),
    ...(item.weight
      ? [[t.inventory.weightShort, `${fmtKg(item.weight)} kg`] as [string, string]]
      : []),
    ...(item.value
      ? [
          [t.inventory.valueShort, formatPurse(item.value, campaign.rules.currency)] as [
            string,
            string,
          ],
        ]
      : []),
  ]
  const target = others.find((o) => o.id === giveTo) ?? others[0]
  return (
    <AnimatePresence mode="wait">
      <motion.article
        key={item.id}
        aria-label={t.inventory.detailsOf(item.name)}
        className={cn('rounded-lg border-2 bg-surface p-4', frame.frame)}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
      >
        <div className="flex gap-4">
          <span className={cn('size-20 shrink-0 rounded-md border-2', frame.frame)}>
            <ItemArt item={item} />
          </span>
          <div className="min-w-0 flex-1">
            <p className={cn('font-display text-lg font-semibold', frame.text)}>{item.name}</p>
            <p className="text-xs text-ink-muted">
              {t.inventory.types[item.type]} · {t.inventory.rarities[item.rarity]}
              {item.slot && ` · ${t.inventory.slots[item.slot]}`}
            </p>
            {item.description && (
              <p className="mt-2 text-sm whitespace-pre-line text-ink">{item.description}</p>
            )}
          </div>
        </div>
        {rows.length > 0 && (
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-line pt-3 text-sm sm:grid-cols-3">
            {rows.map(([k, v], i) => (
              <div key={`${k}-${i}`} className="flex justify-between gap-2">
                <dt className="text-ink-muted">{k}</dt>
                <dd className="tabular font-medium text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        )}
        {item.hidden && (
          <p
            className={cn(
              'mt-3 rounded-sm px-2 py-1 text-sm',
              hidden ? 'bg-surface-2 text-ink-muted italic' : 'bg-gold-soft text-ink',
            )}
          >
            {hidden ? t.inventory.unidentifiedHint : item.hidden.text}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {item.use && inCampaign && (
            <Button size="sm" variant="primary" onClick={() => actions.useItem(entity.id, item.id)}>
              {t.inventory.useItem}
            </Button>
          )}
          {slotsFor(item.type)
            .filter((s) => s !== item.slot)
            .map((s) => (
              <Button key={s} size="sm" onClick={() => editor.equip(item.id, s)}>
                {t.inventory.equip(t.inventory.slots[s])}
              </Button>
            ))}
          {item.slot && (
            <Button size="sm" onClick={() => editor.unequip(item.id)}>
              {t.inventory.unequip}
            </Button>
          )}
          {hidden && inCampaign && (
            <Button size="sm" onClick={onIdentify}>
              {t.inventory.identify}
            </Button>
          )}
          <Button size="sm" variant="ghost" icon={<Pencil />} onClick={onEdit}>
            {t.common.edit}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={<Trash />}
            onClick={() => {
              editor.removeItem(item)
              onRemoved()
            }}
          >
            {t.common.delete}
          </Button>
        </div>
        {target && (
          <form
            className="mt-3 flex items-end gap-2 border-t border-line pt-3"
            onSubmit={(e) => {
              e.preventDefault()
              actions.giveItem(entity.id, target.id, item.id)
              onRemoved()
            }}
          >
            <SelectField<string>
              label={t.inventory.giveTo}
              value={target.id}
              onChange={setGiveTo}
              options={others.map((o) => ({ value: o.id, label: entityName(o) }))}
              className="min-w-40 flex-1"
            />
            <Button type="submit" size="md" icon={<Gift />}>
              {t.inventory.give(entityName(target))}
            </Button>
          </form>
        )}
      </motion.article>
    </AnimatePresence>
  )
}

/** A character to drop items on (gives one unit… or the whole stack, see giveItem). */
function GiveTarget({ entity, fromId }: { entity: Entity; fromId: string }) {
  const t = useT()
  const actions = useGameActions()
  const [over, setOver] = useState(false)
  const name = entityName(entity)
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
        if (id) actions.giveItem(fromId, entity.id, id)
      }}
      className={cn(
        'flex items-center gap-2 rounded-full border border-dashed py-1 pr-3 pl-1 text-sm transition-colors',
        over ? 'border-accent bg-accent-soft text-accent-text' : 'border-line-strong text-ink',
      )}
    >
      <Portrait src={entity.identity.portrait} name={name} size="sm" className="size-7 text-xs" />
      {name}
    </li>
  )
}

function AddItems({ onNew, editor }: { onNew: () => void; editor: SheetEditor }) {
  const t = useT()
  const library = useLiveQuery(() => itemLibrary.list(), []) ?? []
  const [fromLibrary, setFromLibrary] = useState('')
  return (
    <div className="flex flex-wrap items-end gap-4 border-t border-line pt-4">
      <Button variant="primary" icon={<Plus />} onClick={onNew}>
        {t.inventory.newItem}
      </Button>
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
            className="min-w-48"
          />
          <Button type="submit" icon={<Plus />}>
            {t.common.add}
          </Button>
        </form>
      )}
    </div>
  )
}
