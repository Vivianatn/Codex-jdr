import { ENTITY_DRAG_TYPE } from '@/features/maps/dragTypes'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  EllipsisVertical,
  PawPrint,
  Plus,
  Trash,
  UserPlus,
} from 'lucide-react'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Button, IconButton } from '@/components/ui/Button'
import { CommitInput, SelectField } from '@/components/ui/fields'
import { TextField } from '@/components/ui/TextField'
import { entityHpMax, entityName } from '@/domain/entity'
import { attachedFamiliarIds, playableFamiliars, turnFamiliars } from '@/domain/familiars'
import { playerColorOf } from '@/domain/playerColors'
import {
  addGroup,
  addMember,
  groupOf,
  moveGroup,
  moveMember,
  removeGroup,
  removeMember,
  renameGroup,
  type PlayGroup,
} from '@/domain/turns'
import type { Entity } from '@/domain/types'
import { HpBar } from '@/features/characters/HpBar'
import { HpQuickInput } from '@/features/characters/HpQuickInput'
import { Portrait } from '@/features/characters/Portrait'
import { StatusPills } from '@/features/characters/StatusPills'
import { useCampaign } from '@/features/shell/campaignContext'
import { useT } from '@/i18n'
import { cn } from '@/lib/cn'
import { useMapActions } from '@/features/game/useMapActions'
import { useCampaignStore } from '@/stores/campaignStore'
import { useUiStore } from '@/stores/uiStore'
import { compareText } from '@/lib/text'
import { BoardMenu } from './BoardMenu'

const MENU_ITEM =
  'flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-ink outline-none data-[highlighted]:bg-surface-2 data-[disabled]:cursor-default data-[disabled]:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-ink-muted'

/**
 * Rail of the play screen: the groups in playing order (D-226), everyone not
 * in a group, and the familiars to bring in (D-269). Dense rows (D-272): one
 * line per character, its HP field under it, the rare gestures in one menu.
 */
export function GroupsPanel() {
  const t = useT()
  const play = useCampaignStore((s) => s.play)
  const updatePlay = useCampaignStore((s) => s.updatePlay)
  const characters = useCampaignStore(
    useShallow((s) =>
      Object.values(s.entities).sort((a, b) => compareText(entityName(a), entityName(b))),
    ),
  )
  const [name, setName] = useState('')
  // Familiars attached to a master play at its turn (D-269): listed under it, never on their own.
  const attached = useMemo(() => attachedFamiliarIds(characters), [characters])
  const ungrouped = characters.filter((c) => !groupOf(play, c.id) && !attached.has(c.id))

  return (
    <div className="space-y-4">
      {play.groups.map((group, index) => (
        <GroupCard
          key={group.id}
          group={group}
          first={index === 0}
          last={index === play.groups.length - 1}
          characters={characters.filter((c) => !attached.has(c.id))}
        />
      ))}
      <form
        className="flex items-center gap-2"
        onSubmit={(e: FormEvent) => {
          e.preventDefault()
          const groupName = name.trim() || t.turns.defaultGroupName(play.groups.length + 1)
          updatePlay((p) => addGroup(p, groupName), t.turns.groupCreated(groupName))
          setName('')
        }}
      >
        <TextField
          label={t.turns.newGroup}
          hideLabel
          value={name}
          placeholder={`${t.turns.newGroup} : ${t.turns.groupPlaceholder}`}
          onChange={(e) => setName(e.target.value)}
          className="min-w-0 flex-1"
        />
        <IconButton type="submit" variant="secondary" icon={<Plus />} label={t.turns.createGroup} />
      </form>

      <Disclosure id="ungrouped" title={t.turns.ungrouped} count={ungrouped.length} defaultOpen>
        {ungrouped.length === 0 ? (
          <p className="text-xs text-ink-muted">{t.turns.noneUngrouped}</p>
        ) : (
          <ul className="space-y-0.5">
            {ungrouped.map((e) => (
              <li key={e.id} className="space-y-0.5">
                <div className="flex items-center gap-0.5">
                  <OpenButton entity={e} />
                  <BoardMenu entity={e} />
                </div>
                <FamiliarRows masterId={e.id} />
              </li>
            ))}
          </ul>
        )}
      </Disclosure>

      <AddFamiliars />
    </div>
  )
}

/** A section that folds (rare or long content), its heading being the toggle. */
function Disclosure({
  id,
  title,
  icon,
  count,
  defaultOpen = false,
  children,
}: {
  id: string
  title: string
  icon?: ReactNode
  count?: number
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section aria-labelledby={`${id}-heading`}>
      <h3 id={`${id}-heading`} className="type-eyebrow text-ink-muted">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-content`}
          onClick={() => setOpen(!open)}
          className="flex min-h-9 w-full items-center gap-1.5 rounded-md text-left hover:text-ink pointer-coarse:min-h-10"
        >
          {open ? (
            <ChevronDown className="size-3.5 shrink-0" aria-hidden />
          ) : (
            <ChevronRight className="size-3.5 shrink-0" aria-hidden />
          )}
          {icon}
          <span className="flex-1">{title}</span>
          {count !== undefined && <span className="tabular">{count}</span>}
        </button>
      </h3>
      {open && (
        <div id={`${id}-content`} className="pt-1">
          {children}
        </div>
      )}
    </section>
  )
}

function GroupCard({
  group,
  first,
  last,
  characters,
}: {
  group: PlayGroup
  first: boolean
  last: boolean
  characters: Entity[]
}) {
  const t = useT()
  const updatePlay = useCampaignStore((s) => s.updatePlay)
  const entities = useCampaignStore((s) => s.entities)
  const turn = useCampaignStore((s) => s.play.turn)
  const rules = useCampaign().rules
  const [chosen, setChosen] = useState('')
  const candidates = characters.filter((c) => !group.memberIds.includes(c.id))
  const selected = candidates.some((c) => c.id === chosen) ? chosen : (candidates[0]?.id ?? '')
  const active = turn.status === 'playing' && turn.groupId === group.id

  return (
    <section
      aria-label={group.name}
      className={cn(
        'space-y-1.5 rounded-xl border p-2',
        active ? 'border-gold-line bg-gold-soft/60' : 'border-line bg-surface/70',
      )}
    >
      <div className="flex items-center gap-0.5">
        <CommitInput
          label={t.turns.groupName}
          hideLabel
          value={group.name}
          onCommit={(v) => v && updatePlay((p) => renameGroup(p, group.id, v), t.turns.rename(v))}
          className="min-w-0 flex-1"
          inputClassName="h-8 font-semibold"
        />
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <IconButton
              size="sm"
              label={t.turns.groupActions(group.name)}
              icon={<EllipsisVertical />}
              className="pointer-coarse:size-10"
            />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={4}
              className="z-50 max-w-[calc(100vw-2rem)] min-w-48 rounded-xl border border-line bg-surface-raised p-1 shadow-lifted"
            >
              <DropdownMenu.Item
                className={MENU_ITEM}
                disabled={first}
                onSelect={() =>
                  updatePlay((p) => moveGroup(p, group.id, -1), t.turns.moveUp(group.name))
                }
              >
                <ChevronUp /> {t.turns.moveUp(group.name)}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className={MENU_ITEM}
                disabled={last}
                onSelect={() =>
                  updatePlay((p) => moveGroup(p, group.id, 1), t.turns.moveDown(group.name))
                }
              >
                <ChevronDown /> {t.turns.moveDown(group.name)}
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 h-px bg-line" />
              <DropdownMenu.Item
                className={cn(MENU_ITEM, 'text-hp-text [&>svg]:text-hp-text')}
                onSelect={() =>
                  updatePlay((p) => removeGroup(p, group.id), t.turns.groupDeleted(group.name))
                }
              >
                <Trash /> {t.turns.deleteGroup(group.name)}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {group.memberIds.length === 0 ? (
        <p className="px-1 text-xs text-ink-muted">{t.turns.emptyGroup}</p>
      ) : (
        <ol className="space-y-1">
          {group.memberIds.map((id, index) => {
            const e = entities[id]
            if (!e) return null
            const name = entityName(e)
            const current = turn.status === 'playing' && turn.memberId === id
            return (
              <li key={id} className="space-y-1 rounded-md bg-surface-2/70 p-1">
                <div className="flex items-center gap-0.5">
                  <OpenButton entity={e} current={current} />
                  <BoardMenu
                    entity={e}
                    member={{
                      up:
                        index > 0
                          ? () => updatePlay((p) => moveMember(p, id, -1), t.turns.moveUp(name))
                          : undefined,
                      down:
                        index < group.memberIds.length - 1
                          ? () => updatePlay((p) => moveMember(p, id, 1), t.turns.moveDown(name))
                          : undefined,
                      leave: () =>
                        updatePlay((p) => removeMember(p, id), t.turns.memberRemoved(name)),
                    }}
                  />
                </div>
                <FamiliarRows masterId={id} current={current} />
                {/* HP in one gesture (-7, +5, t+4), statuses beside it. */}
                <div className="flex flex-wrap items-center gap-1">
                  <HpQuickInput entityId={id} name={name} compact className="w-24 min-w-0" />
                  <StatusPills entity={e} rules={rules} limit={2} className="min-w-0" />
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {candidates.length > 0 && (
        <form
          className="flex items-center gap-1.5"
          onSubmit={(ev) => {
            ev.preventDefault()
            const e = entities[selected]
            if (!e) return
            updatePlay(
              (p) => addMember(p, group.id, selected),
              t.turns.memberAdded(entityName(e), group.name),
            )
            setChosen('')
          }}
        >
          <SelectField<string>
            label={t.turns.addMember(group.name)}
            hideLabel
            value={selected}
            onChange={setChosen}
            selectClassName="h-8 text-xs"
            options={candidates.map((c) => ({
              value: c.id,
              label: `${entityName(c)} (${t.kinds[c.kind]})`,
            }))}
            className="min-w-0 flex-1"
          />
          <IconButton
            type="submit"
            size="sm"
            variant="secondary"
            label={t.turns.addMember(group.name)}
            icon={<UserPlus />}
            className="pointer-coarse:size-10"
          />
        </form>
      )}
    </section>
  )
}

/** Name + mini HP bar, in the player colour; opens the quick panel, drags onto the map. */
function OpenButton({ entity, current = false }: { entity: Entity; current?: boolean }) {
  const t = useT()
  const campaign = useCampaign()
  const openQuick = useUiStore((s) => s.openQuick)
  const name = entityName(entity)
  const max = entityHpMax(entity, campaign.rules)
  const color = playerColorOf(entity)
  return (
    <button
      type="button"
      onClick={() => openQuick(entity.id)}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(ENTITY_DRAG_TYPE, entity.id)
        e.dataTransfer.effectAllowed = 'copyMove'
      }}
      aria-label={t.turns.open(name)}
      aria-current={current ? 'step' : undefined}
      {...(color ? { 'data-player-color': color } : {})}
      className={cn(
        // A button sizes to its content: w-full keeps long names inside the panel.
        'flex min-h-10 w-full min-w-0 items-center gap-2 rounded-md px-1 py-0.5 text-left hover:bg-surface-2',
        current && 'bg-gold-soft hover:bg-gold-soft',
      )}
    >
      <Portrait
        src={entity.identity.portrait}
        name={name}
        size="sm"
        square={entity.kind === 'enemy'}
        className={cn(
          'size-8 text-xs',
          color && 'shadow-[0_0_0_2px_var(--codex-surface),0_0_0_3px_var(--codex-player)]',
        )}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-1">
          <span
            className={cn(
              'truncate text-[0.8125rem] font-semibold',
              color ? 'text-player-text' : 'text-ink',
            )}
          >
            {name}
          </span>
          <span className={cn('tabular shrink-0 text-xs', current ? 'text-ink' : 'text-ink-muted')}>
            {entity.hp.current}/{max}
          </span>
        </span>
        <HpBar
          current={entity.hp.current}
          max={max}
          size="sm"
          showLabel={false}
          thresholds={campaign.rules.hp}
          entityId={entity.id}
        />
      </span>
    </button>
  )
}

/** Familiars sharing their master turn (D-269), joined under it; not orderable. */
function FamiliarRows({ masterId, current = false }: { masterId: string; current?: boolean }) {
  const t = useT()
  const openQuick = useUiStore((s) => s.openQuick)
  const master = useCampaignStore((s) => s.entities[masterId])
  const familiars = useCampaignStore(useShallow((s) => turnFamiliars(s.entities, masterId)))
  if (!master || familiars.length === 0) return null
  const masterName = entityName(master)
  return (
    <ul
      className="ml-4 space-y-0.5 border-l-2 border-gold-line pl-1.5"
      aria-label={t.crew.sharesTurn(masterName)}
    >
      {familiars.map((f) => {
        const name = entityName(f)
        return (
          <li key={f.id} className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => openQuick(f.id)}
              aria-label={`${t.turns.open(name)} — ${t.crew.sharesTurn(masterName)}`}
              aria-current={current ? 'step' : undefined}
              className={cn(
                'flex min-h-8 w-full min-w-0 items-center gap-2 rounded-md px-1.5 py-0.5 text-left hover:bg-surface-2 pointer-coarse:min-h-10',
                current && 'bg-gold-soft hover:bg-gold-soft',
              )}
            >
              <Portrait
                src={f.identity.portrait}
                name={name}
                size="sm"
                className="size-6 text-[0.625rem]"
              />
              <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink">{name}</span>
              <span className="tabular shrink-0 text-xs text-ink-muted">{f.hp.current}</span>
            </button>
            <BoardMenu entity={f} />
          </li>
        )
      })}
    </ul>
  )
}

/**
 * « Ajouter un familier » (D-269): only the familiars of player characters and
 * enemies, by master; a click puts one next to its master on the map in play.
 * Folded by default (D-272): a rare gesture, also offered in the master panel.
 */
function AddFamiliars() {
  const t = useT()
  const actions = useMapActions()
  const entities = useCampaignStore((s) => s.entities)
  const map = useCampaignStore((s) => (s.play.mapId ? s.maps[s.play.mapId] : undefined))
  const choices = useMemo(() => playableFamiliars(entities), [entities])
  return (
    <Disclosure
      id="add-familiar"
      title={t.crew.addFamiliar}
      icon={<PawPrint className="size-3.5 shrink-0" aria-hidden />}
    >
      {choices.length === 0 ? (
        <p className="text-xs text-ink-muted">{t.crew.noFamiliars}</p>
      ) : !map ? (
        <p className="text-xs text-ink-muted">{t.crew.noMapInPlay}</p>
      ) : (
        <>
          <p className="mb-2 text-xs text-ink-muted">{t.crew.addFamiliarHint}</p>
          <ul className="space-y-2">
            {choices.map(({ master, familiars }) => (
              <li key={master.id}>
                <p className="truncate text-xs font-semibold text-ink">
                  {entityName(master)}{' '}
                  <span className="font-normal text-ink-muted">({t.kinds[master.kind]})</span>
                </p>
                <ul className="mt-1 space-y-1">
                  {familiars.map((f) => {
                    const placed = map.tokens.some((tk) => tk.entityId === f.id)
                    return (
                      <li key={f.id} className="flex min-h-8 items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-sm text-ink">
                          {entityName(f)}
                        </span>
                        {placed ? (
                          <span className="shrink-0 text-xs text-ink-muted">{t.crew.onBoard}</span>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            icon={<PawPrint />}
                            aria-label={t.crew.placeFamiliar(entityName(f))}
                            onClick={() => actions.addFamiliar(map.id, f.id)}
                          >
                            {t.crew.place}
                          </Button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}
    </Disclosure>
  )
}
