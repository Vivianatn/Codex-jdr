import { ENTITY_DRAG_TYPE } from '@/features/maps/dragTypes'
import { ChevronDown, ChevronUp, Plus, Trash, UserPlus, Users, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Button, IconButton } from '@/components/ui/Button'
import { CommitInput, SelectField } from '@/components/ui/fields'
import { TextField } from '@/components/ui/TextField'
import { entityHpMax, entityName } from '@/domain/entity'
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
import { useCampaignStore } from '@/stores/campaignStore'
import { useUiStore } from '@/stores/uiStore'

/** Sidebar of the play screen: the groups (D-226) and everyone not in a group. */
export function GroupsPanel() {
  const t = useT()
  const play = useCampaignStore((s) => s.play)
  const updatePlay = useCampaignStore((s) => s.updatePlay)
  const characters = useCampaignStore(
    useShallow((s) =>
      Object.values(s.entities).sort((a, b) => entityName(a).localeCompare(entityName(b), 'fr')),
    ),
  )
  const [name, setName] = useState('')
  const ungrouped = characters.filter((c) => !groupOf(play, c.id))

  return (
    <div className="space-y-5">
      <h2 className="flex items-center gap-2 font-sans text-xs font-semibold tracking-wider text-ink-muted uppercase">
        <Users className="size-3.5" aria-hidden />
        {t.turns.groups}
      </h2>
      {play.groups.map((group, index) => (
        <GroupCard
          key={group.id}
          group={group}
          first={index === 0}
          last={index === play.groups.length - 1}
          characters={characters}
        />
      ))}
      <form
        className="flex items-end gap-2"
        onSubmit={(e: FormEvent) => {
          e.preventDefault()
          const groupName = name.trim() || t.turns.defaultGroupName(play.groups.length + 1)
          updatePlay((p) => addGroup(p, groupName), t.turns.groupCreated(groupName))
          setName('')
        }}
      >
        <TextField
          label={t.turns.newGroup}
          value={name}
          placeholder={t.turns.groupPlaceholder}
          onChange={(e) => setName(e.target.value)}
          className="min-w-0 flex-1"
        />
        <Button type="submit" icon={<Plus />} aria-label={t.turns.createGroup} />
      </form>

      <section aria-labelledby="ungrouped-heading">
        <h3
          id="ungrouped-heading"
          className="mb-2 font-sans text-xs font-semibold tracking-wider text-ink-muted uppercase"
        >
          {t.turns.ungrouped}
        </h3>
        {ungrouped.length === 0 ? (
          <p className="text-xs text-ink-muted">{t.turns.noneUngrouped}</p>
        ) : (
          <ul className="space-y-1.5">
            {ungrouped.map((e) => (
              <li key={e.id}>
                <OpenButton entity={e} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
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
        'space-y-2 rounded-lg border bg-surface p-3',
        active ? 'border-accent shadow-soft' : 'border-line',
      )}
    >
      <div className="flex items-end gap-1">
        <CommitInput
          label={t.turns.groupName}
          hideLabel
          value={group.name}
          onCommit={(v) => v && updatePlay((p) => renameGroup(p, group.id, v), t.turns.rename(v))}
          className="min-w-0 flex-1"
          inputClassName="h-8 font-semibold"
        />
        <IconButton
          size="sm"
          label={t.turns.moveUp(group.name)}
          icon={<ChevronUp />}
          disabled={first}
          onClick={() => updatePlay((p) => moveGroup(p, group.id, -1), t.turns.moveUp(group.name))}
        />
        <IconButton
          size="sm"
          label={t.turns.moveDown(group.name)}
          icon={<ChevronDown />}
          disabled={last}
          onClick={() => updatePlay((p) => moveGroup(p, group.id, 1), t.turns.moveDown(group.name))}
        />
        <IconButton
          size="sm"
          label={t.turns.deleteGroup(group.name)}
          icon={<Trash />}
          onClick={() =>
            updatePlay((p) => removeGroup(p, group.id), t.turns.groupDeleted(group.name))
          }
        />
      </div>

      {group.memberIds.length === 0 ? (
        <p className="text-xs text-ink-muted">{t.turns.emptyGroup}</p>
      ) : (
        <ol className="space-y-2">
          {group.memberIds.map((id, index) => {
            const e = entities[id]
            if (!e) return null
            const name = entityName(e)
            return (
              <li key={id} className="space-y-1.5 rounded-md bg-surface-2/60 p-2">
                <div className="flex items-center gap-1">
                  <OpenButton
                    entity={e}
                    current={turn.status === 'playing' && turn.memberId === id}
                  />
                  <IconButton
                    size="sm"
                    label={t.turns.moveUp(name)}
                    icon={<ChevronUp />}
                    disabled={index === 0}
                    onClick={() => updatePlay((p) => moveMember(p, id, -1), t.turns.moveUp(name))}
                  />
                  <IconButton
                    size="sm"
                    label={t.turns.moveDown(name)}
                    icon={<ChevronDown />}
                    disabled={index === group.memberIds.length - 1}
                    onClick={() => updatePlay((p) => moveMember(p, id, 1), t.turns.moveDown(name))}
                  />
                  <IconButton
                    size="sm"
                    label={t.turns.removeMember(name)}
                    icon={<X />}
                    onClick={() =>
                      updatePlay((p) => removeMember(p, id), t.turns.memberRemoved(name))
                    }
                  />
                </div>
                <StatusPills entity={e} rules={rules} limit={3} />
                <HpQuickInput entityId={id} name={name} compact />
              </li>
            )
          })}
        </ol>
      )}

      {candidates.length > 0 && (
        <form
          className="flex items-end gap-1.5"
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
          />
        </form>
      )}
    </section>
  )
}

/** Name + mini HP bar; opens the quick panel. */
function OpenButton({ entity, current = false }: { entity: Entity; current?: boolean }) {
  const t = useT()
  const campaign = useCampaign()
  const openQuick = useUiStore((s) => s.openQuick)
  const name = entityName(entity)
  const max = entityHpMax(entity, campaign.rules)
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
      className={cn(
        'flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-0.5 text-left hover:bg-surface-2',
        current && 'bg-accent-soft',
      )}
    >
      <Portrait src={entity.identity.portrait} name={name} size="sm" className="size-8 text-xs" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{name}</span>
        <HpBar
          current={entity.hp.current}
          max={max}
          size="sm"
          showLabel={false}
          thresholds={campaign.rules.hp}
          entityId={entity.id}
        />
      </span>
      <span className={cn('tabular shrink-0 text-xs', current ? 'text-ink' : 'text-ink-muted')}>
        {entity.hp.current}/{max}
      </span>
    </button>
  )
}
