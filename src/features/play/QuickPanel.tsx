import { MapTokenBlock } from '@/features/maps/MapTokenBlock'
import { motion, useReducedMotion } from 'framer-motion'
import { FileText, Minus, Plus, X } from 'lucide-react'
import { GameIcon } from '@/components/GameIcon'
import { useEffect, useState, type FormEvent } from 'react'
import { Button, IconButton } from '@/components/ui/Button'
import { CheckboxField, SelectField } from '@/components/ui/fields'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { TextField } from '@/components/ui/TextField'
import { validateDice } from '@/dice'
import { allConditionTemplates } from '@/domain/conditions'
import { effectiveStats, entityHpMax, entityName } from '@/domain/entity'
import { masterOf } from '@/domain/familiars'
import { newItem, slotsFor } from '@/domain/items'
import { colorOfEntity } from '@/domain/playerColors'
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

/** Touch screens get 40 px targets (D-272). */
const TOUCH = 'pointer-coarse:size-10'

/**
 * Quick manipulation of any character during play (D-227): HP, tests and the
 * seven characteristics in one grid, the token, items and conditions. Every
 * click is one undoable step; the full sheet is one click away. A column next
 * to the board on tablets and computers, a bottom sheet on phones (D-272): the
 * header stays put, the body scrolls only when the screen is really short.
 */
export function QuickPanel() {
  const t = useT()
  const id = useUiStore((s) => s.quickId)
  const close = useUiStore((s) => s.openQuick)
  const openSheet = useUiStore((s) => s.openPlaySheet)
  const entity = useCampaignStore((s) => (id ? s.entities[id] : undefined))
  const color = useCampaignStore((s) => (id ? colorOfEntity(id, (x) => s.entities[x]) : 'gm'))
  const reduce = useReducedMotion()

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
      data-player-color={color}
      className={cn(
        'codex-glass pointer-events-auto relative flex flex-col overflow-hidden',
        'max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:z-30 max-sm:max-h-[72dvh] max-sm:rounded-b-none',
        'sm:max-h-full sm:w-[21rem] sm:shrink-0 sm:self-start xl:w-[23rem]',
      )}
      initial={reduce ? { opacity: 0 } : { x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: reduce ? 0.1 : 0.2, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Whose character this is: the player colour, gold for the GM (D-268). */}
      <span className="absolute inset-x-0 top-0 h-1 bg-player" aria-hidden />
      <Header
        entity={entity}
        onClose={() => close(null)}
        onFull={() => {
          close(null)
          openSheet(entity.id)
        }}
      />
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-3">
        <StatsBlock entity={entity} />
        <MapTokenBlock entity={entity} />
        <LowerTabs entity={entity} />
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
  const master = useCampaignStore((s) => masterOf(s.entities, entity))
  return (
    <header className="flex shrink-0 gap-3 border-b border-line p-3 pt-3.5">
      {entity.identity.body ? (
        <BodyImage src={entity.identity.body} className="h-20 w-14 shrink-0" />
      ) : (
        <Portrait
          src={entity.identity.portrait}
          name={name}
          size="sm"
          square={entity.kind === 'enemy'}
          className="size-12 text-base"
        />
      )}
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-start gap-0.5">
          <div className="min-w-0 flex-1">
            <p className="type-eyebrow text-player-text">
              {master ? t.familiars.of(entityName(master)) : t.kinds[entity.kind]}
            </p>
            <h2 className="truncate font-title text-lg leading-tight font-semibold text-ink">
              {name}
            </h2>
          </div>
          <IconButton
            size="sm"
            label={t.quick.fullSheet}
            icon={<FileText />}
            onClick={onFull}
            className={TOUCH}
          />
          <IconButton
            size="sm"
            label={t.quick.close}
            icon={<X />}
            onClick={onClose}
            className={TOUCH}
          />
        </div>
        <HpBar
          current={entity.hp.current}
          max={entityHpMax(entity, campaign.rules)}
          temp={entity.hp.temp}
          thresholds={campaign.rules.hp}
          entityId={entity.id}
        />
        <HpQuickInput entityId={entity.id} name={name} compact />
      </div>
    </header>
  )
}

/**
 * Tests and characteristics in one grid (D-272, was two lists showing the same
 * values): the name rolls the test (D-269), minus and plus change the value.
 */
function StatsBlock({ entity }: { entity: Entity }) {
  const t = useT()
  const campaign = useCampaign()
  const actions = useGameActions()
  const stats = effectiveStats(entity, campaign.rules)
  const name = entityName(entity)
  return (
    <section aria-labelledby="quick-stats">
      <h3 id="quick-stats" className="mb-1.5 type-eyebrow text-ink-muted">
        {t.quick.testsAndStats}
      </h3>
      <ul className="grid grid-cols-2 gap-1.5">
        {STAT_KEYS.map((key) => {
          const label = t.stats.names[key]
          const { base, total } = stats[key]
          const test = t.crew.test(label, name)
          return (
            <li
              key={key}
              className={cn('flex items-center gap-0.5 rounded-md p-0.5', STAT_STYLES[key].soft)}
            >
              <button
                type="button"
                onClick={() => actions.check(entity.id, key)}
                aria-label={test}
                title={total !== base ? `${test} (${t.sheet.base} ${base})` : test}
                className="flex h-8 min-w-0 flex-1 items-center gap-1 rounded-sm px-1.5 hover:bg-surface/60 pointer-coarse:h-10"
              >
                <GameIcon
                  name="rolling-dices"
                  className="size-3 shrink-0 text-ink-muted"
                  aria-hidden
                />
                <span
                  className={cn(
                    'text-[0.6875rem] font-bold tracking-[0.08em]',
                    STAT_STYLES[key].text,
                  )}
                >
                  {t.stats.abbr[key]}
                </span>
                <span className="tabular ml-auto font-display text-base font-semibold text-ink">
                  {total}
                </span>
              </button>
              <IconButton
                size="sm"
                label={t.quick.less(label)}
                icon={<Minus />}
                disabled={base <= campaign.rules.stats.min}
                onClick={() => actions.nudgeStat(entity.id, key, -1)}
                className={cn('size-7', TOUCH)}
              />
              <IconButton
                size="sm"
                label={t.quick.more(label)}
                icon={<Plus />}
                disabled={base >= campaign.rules.stats.max}
                onClick={() => actions.nudgeStat(entity.id, key, 1)}
                className={cn('size-7', TOUCH)}
              />
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** Items or conditions: one at a time, the choice remembered on this device (D-272). */
function LowerTabs({ entity }: { entity: Entity }) {
  const t = useT()
  const tab = useUiStore((s) => s.play.quickTab)
  const setPanels = useUiStore((s) => s.setPlayPanels)
  return (
    <div className="space-y-2">
      <SegmentedControl
        label={t.quick.sections}
        size="sm"
        value={tab}
        onValueChange={(quickTab) => setPanels({ quickTab })}
        options={[
          { value: 'items', label: t.quick.itemsTab(entity.inventory.length) },
          { value: 'conditions', label: t.quick.conditionsTab(entity.conditions.length) },
        ]}
        className="grid w-full grid-cols-2 [&>button]:justify-center"
      />
      {tab === 'items' ? <ItemsBlock entity={entity} /> : <ConditionsBlock entity={entity} />}
    </div>
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
    <section aria-label={t.quick.items} className="space-y-2">
      {entity.inventory.length === 0 ? (
        <p className="text-sm text-ink-muted">{t.quick.noItems}</p>
      ) : (
        <ul className="space-y-1">
          {entity.inventory.map((item) => {
            const equippable = slotsFor(item.type).length > 0
            return (
              <li
                key={item.id}
                className="flex items-center gap-2 rounded-md border border-line bg-surface px-1.5 py-1"
              >
                <span
                  className={cn(
                    'size-7 shrink-0 rounded-sm border-2',
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
                    icon={
                      item.type === 'weapon' ? (
                        <GameIcon name="broadsword" />
                      ) : (
                        <GameIcon name="round-shield" />
                      )
                    }
                    aria-pressed={Boolean(item.slot)}
                    onClick={() => actions.toggleEquip(entity.id, item.id)}
                    className={TOUCH}
                  />
                )}
                <IconButton
                  size="sm"
                  label={t.quick.remove(item.name)}
                  icon={<X />}
                  onClick={() => actions.quickRemoveItem(entity.id, item.id)}
                  className={TOUCH}
                />
              </li>
            )
          })}
        </ul>
      )}
      {/* One line to add an item; the weapon fields appear only for a weapon. */}
      <form onSubmit={submit} className="space-y-2 rounded-md border border-dashed border-line p-2">
        <div className="flex items-center gap-2">
          <TextField
            label={t.quick.itemName}
            hideLabel
            value={name}
            placeholder={`${t.quick.itemName} : ${t.quick.itemPlaceholder}`}
            onChange={(e) => setName(e.target.value)}
            className="min-w-0 flex-1"
          />
          <CheckboxField label={t.quick.weapon} checked={weapon} onChange={setWeapon} />
          <IconButton
            type="submit"
            variant="primary"
            label={t.quick.add}
            icon={<Plus />}
            disabled={!name.trim()}
          />
        </div>
        {weapon && (
          <div className="flex items-center gap-3">
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
              className="w-28"
            />
            <CheckboxField label={t.quick.equipNow} checked={equipNow} onChange={setEquipNow} />
          </div>
        )}
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
    <section aria-label={t.quick.conditions} className="space-y-2">
      {entity.conditions.length === 0 && (
        <p className="text-sm text-ink-muted">{t.mini.noConditions}</p>
      )}
      {entity.conditions.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
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
                className={TOUCH}
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
            hideLabel
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
