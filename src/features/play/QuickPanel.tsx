import { MapTokenBlock } from '@/features/maps/MapTokenBlock'
import { motion } from 'framer-motion'
import { FileText, Minus, Plus, Shield, Sword, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Button, IconButton } from '@/components/ui/Button'
import { CheckboxField, SelectField } from '@/components/ui/fields'
import { TextField } from '@/components/ui/TextField'
import { validateDice } from '@/dice'
import { allConditionTemplates } from '@/domain/conditions'
import { effectiveStats, entityHpMax, entityName } from '@/domain/entity'
import { newItem, slotsFor } from '@/domain/items'
import { STAT_KEYS, type Entity } from '@/domain/types'
import { BodyImage } from '@/features/characters/BodyPicker'
import { HpBar } from '@/features/characters/HpBar'
import { HpQuickInput } from '@/features/characters/HpQuickInput'
import { ItemArt } from '@/features/characters/ItemTile'
import { RARITY_FRAME } from '@/features/characters/itemIcons'
import { Portrait } from '@/features/characters/Portrait'
import { STAT_STYLES } from '@/features/characters/statStyles'
import { ConditionPill } from '@/features/characters/StatusPills'
import { diceErrorMessage } from '@/features/game/diceErrors'
import { useGameActions } from '@/features/game/useGameActions'
import { useCampaign } from '@/features/shell/campaignContext'
import { useT } from '@/i18n'
import { cn } from '@/lib/cn'
import { useCampaignStore } from '@/stores/campaignStore'
import { useUiStore } from '@/stores/uiStore'

/**
 * Quick manipulation of any character during play (D-227): HP, the seven
 * characteristics in ±1 steps, items and weapons, conditions. Every click is
 * one undoable step; the full sheet is one click away.
 */
export function QuickPanel() {
  const t = useT()
  const id = useUiStore((s) => s.quickId)
  const close = useUiStore((s) => s.openQuick)
  const openSheet = useUiStore((s) => s.openPlaySheet)
  const entity = useCampaignStore((s) => (id ? s.entities[id] : undefined))

  useEffect(() => {
    if (!id) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[role="dialog"], [role="menu"]'))
        close(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [id, close])

  if (!entity) return null
  const name = entityName(entity)
  return (
    <motion.aside
      key={entity.id}
      aria-label={t.quick.title(name)}
      className="glass fixed top-14 right-0 bottom-0 z-20 w-full max-w-md overflow-y-auto border-l border-line p-4 shadow-overlay"
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
    >
      <Header
        entity={entity}
        onClose={() => close(null)}
        onFull={() => {
          close(null)
          openSheet(entity.id)
        }}
      />
      <div className="mt-4 space-y-5">
        <MapTokenBlock entity={entity} />
        <StatsBlock entity={entity} />
        <ItemsBlock entity={entity} />
        <ConditionsBlock entity={entity} />
      </div>
    </motion.aside>
  )
}

function Header({
  entity,
  onClose,
  onFull,
}: {
  entity: Entity
  onClose: () => void
  onFull: () => void
}) {
  const t = useT()
  const campaign = useCampaign()
  const name = entityName(entity)
  return (
    <header className="flex gap-3">
      {entity.identity.body ? (
        <BodyImage src={entity.identity.body} className="h-28 w-20 shrink-0" />
      ) : (
        <Portrait src={entity.identity.portrait} name={name} />
      )}
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-wider text-gold-text uppercase">
              {t.kinds[entity.kind]}
            </p>
            <h2 className="truncate font-display text-xl font-semibold text-ink">{name}</h2>
          </div>
          <IconButton size="sm" label={t.quick.close} icon={<X />} onClick={onClose} />
        </div>
        <HpBar
          current={entity.hp.current}
          max={entityHpMax(entity, campaign.rules)}
          temp={entity.hp.temp}
          thresholds={campaign.rules.hp}
          entityId={entity.id}
        />
        <div className="flex items-start gap-2">
          <HpQuickInput entityId={entity.id} name={name} compact className="flex-1" />
          <Button size="sm" variant="ghost" icon={<FileText />} onClick={onFull}>
            {t.quick.fullSheet}
          </Button>
        </div>
      </div>
    </header>
  )
}

function StatsBlock({ entity }: { entity: Entity }) {
  const t = useT()
  const campaign = useCampaign()
  const actions = useGameActions()
  const stats = effectiveStats(entity, campaign.rules)
  return (
    <section aria-labelledby="quick-stats">
      <h3
        id="quick-stats"
        className="mb-2 font-sans text-sm font-semibold tracking-normal text-ink"
      >
        {t.quick.stats}
      </h3>
      <ul className="grid grid-cols-1 gap-1.5">
        {STAT_KEYS.map((key) => {
          const label = t.stats.names[key]
          const { base, total } = stats[key]
          return (
            <li
              key={key}
              className="flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1"
            >
              <span className={cn('size-2 rounded-full', STAT_STYLES[key].dot)} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{label}</span>
              <IconButton
                size="sm"
                label={t.quick.less(label)}
                icon={<Minus />}
                disabled={base <= campaign.rules.stats.min}
                onClick={() => actions.nudgeStat(entity.id, key, -1)}
              />
              <span
                className="tabular w-8 text-center font-display text-lg font-semibold text-ink"
                aria-label={`${label} : ${total}`}
                title={total !== base ? `${t.sheet.base} ${base}` : undefined}
              >
                {total}
              </span>
              <IconButton
                size="sm"
                label={t.quick.more(label)}
                icon={<Plus />}
                disabled={base >= campaign.rules.stats.max}
                onClick={() => actions.nudgeStat(entity.id, key, 1)}
              />
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function ItemsBlock({ entity }: { entity: Entity }) {
  const t = useT()
  const actions = useGameActions()
  const [name, setName] = useState('')
  const [weapon, setWeapon] = useState(false)
  const [damage, setDamage] = useState('')
  const [equipNow, setEquipNow] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    if (weapon && damage.trim()) {
      try {
        validateDice(damage)
      } catch (err) {
        return setError(diceErrorMessage(t, err))
      }
    }
    const item = newItem({
      name: name.trim(),
      type: weapon ? 'weapon' : 'misc',
      damage: weapon ? damage.trim() : '',
    })
    actions.quickAddItem(entity.id, item, weapon && equipNow)
    setName('')
    setDamage('')
    setError(null)
  }

  return (
    <section aria-labelledby="quick-items">
      <h3
        id="quick-items"
        className="mb-2 font-sans text-sm font-semibold tracking-normal text-ink"
      >
        {t.quick.items}
      </h3>
      {entity.inventory.length === 0 ? (
        <p className="mb-2 text-sm text-ink-muted">{t.quick.noItems}</p>
      ) : (
        <ul className="mb-3 space-y-1.5">
          {entity.inventory.map((item) => {
            const equippable = slotsFor(item.type).length > 0
            return (
              <li
                key={item.id}
                className="flex items-center gap-2 rounded-md border border-line bg-surface p-1.5"
              >
                <span
                  className={cn(
                    'size-8 shrink-0 rounded-sm border-2',
                    RARITY_FRAME[item.rarity].frame,
                  )}
                >
                  <ItemArt item={item} />
                </span>
                <span className="min-w-0 flex-1 text-sm text-ink">
                  <span className="block truncate font-medium">
                    {item.name}
                    {item.quantity > 1 && (
                      <span className="tabular ml-1 text-ink-muted">×{item.quantity}</span>
                    )}
                  </span>
                  {(item.slot || item.damage) && (
                    <span className="block truncate text-xs text-ink-muted">
                      {[item.slot ? t.inventory.slots[item.slot] : '', item.damage]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  )}
                </span>
                {equippable && (
                  <IconButton
                    size="sm"
                    variant={item.slot ? 'secondary' : 'ghost'}
                    label={item.slot ? t.quick.unequip(item.name) : t.quick.equip(item.name)}
                    icon={item.type === 'weapon' ? <Sword /> : <Shield />}
                    aria-pressed={Boolean(item.slot)}
                    onClick={() => actions.toggleEquip(entity.id, item.id)}
                  />
                )}
                <IconButton
                  size="sm"
                  label={t.quick.remove(item.name)}
                  icon={<X />}
                  onClick={() => actions.quickRemoveItem(entity.id, item.id)}
                />
              </li>
            )
          })}
        </ul>
      )}
      <form onSubmit={submit} className="space-y-2 rounded-md border border-dashed border-line p-2">
        <div className="flex items-end gap-2">
          <TextField
            label={t.quick.itemName}
            value={name}
            placeholder={t.quick.itemPlaceholder}
            onChange={(e) => setName(e.target.value)}
            className="min-w-0 flex-1"
          />
          {weapon && (
            <TextField
              label={t.quick.damage}
              value={damage}
              placeholder="1d8"
              error={error}
              inputClassName="font-mono"
              onChange={(e) => {
                setDamage(e.target.value)
                setError(null)
              }}
              className="w-24"
            />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <CheckboxField label={t.quick.weapon} checked={weapon} onChange={setWeapon} />
          {weapon && (
            <CheckboxField label={t.quick.equipNow} checked={equipNow} onChange={setEquipNow} />
          )}
          <Button
            type="submit"
            size="sm"
            variant="primary"
            icon={<Plus />}
            disabled={!name.trim()}
            className="ml-auto"
          >
            {t.quick.add}
          </Button>
        </div>
      </form>
    </section>
  )
}

function ConditionsBlock({ entity }: { entity: Entity }) {
  const t = useT()
  const campaign = useCampaign()
  const actions = useGameActions()
  const update = useCampaignStore((s) => s.updateEntity)
  const library = allConditionTemplates(campaign.library.conditions)
  const [chosen, setChosen] = useState('')
  const selected = library.some((c) => c.id === chosen) ? chosen : (library[0]?.id ?? '')
  return (
    <section aria-labelledby="quick-conditions">
      <h3
        id="quick-conditions"
        className="mb-2 font-sans text-sm font-semibold tracking-normal text-ink"
      >
        {t.quick.conditions}
      </h3>
      {entity.conditions.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {entity.conditions.map((c) => (
            <li key={c.id} className="flex items-center gap-0.5">
              <ConditionPill condition={c} />
              <IconButton
                size="sm"
                label={`${t.common.remove} : ${c.name}`}
                icon={<X />}
                onClick={() =>
                  update(
                    entity.id,
                    (e) => ({ ...e, conditions: e.conditions.filter((x) => x.id !== c.id) }),
                    t.journal.conditionRemoved(c.name),
                  )
                }
              />
            </li>
          ))}
        </ul>
      )}
      {library.length > 0 && (
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (selected) actions.addConditionFromTemplate([entity.id], selected)
          }}
        >
          <SelectField<string>
            label={t.quick.addCondition}
            value={selected}
            onChange={setChosen}
            options={library.map((c) => ({ value: c.id, label: c.name }))}
            className="min-w-0 flex-1"
          />
          <Button type="submit" icon={<Plus />} aria-label={t.quick.addCondition} />
        </form>
      )}
    </section>
  )
}
