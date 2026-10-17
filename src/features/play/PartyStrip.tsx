import { ChevronsLeft, ChevronsRight } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { IconButton } from '@/components/ui/Button'
import { entityHpMax, entityName } from '@/domain/entity'
import { familiarsOf } from '@/domain/familiars'
import { playerColorOf } from '@/domain/playerColors'
import { turnActors } from '@/domain/turns'
import type { Entity } from '@/domain/types'
import {
  CONDITION_COLOR_CLASSES,
  CONDITION_ICON_COMPONENTS,
} from '@/features/characters/conditionStyles'
import { HpBar } from '@/features/characters/HpBar'
import { Portrait } from '@/features/characters/Portrait'
import { useCampaign } from '@/features/shell/campaignContext'
import { useT } from '@/i18n'
import { compareText } from '@/lib/text'
import { cn } from '@/lib/cn'
import { useOnlineStore } from '@/online/onlineStore'
import type { RulesConfig } from '@/rules'
import { useCampaignStore } from '@/stores/campaignStore'
import { useUiStore } from '@/stores/uiStore'

export type Presence = 'online' | 'offline' | null

/**
 * The players at the table, always in view over the board (D-272): each player
 * character in its colour (D-268) with its HP, conditions, whether its player is
 * connected, whose turn it is, and its familiars joined to it (D-269).
 */
export function PartyStrip({
  players,
  entities,
  rules,
  activeIds,
  presence,
  selfIds = [],
  onOpen,
  compact = false,
  onToggleCompact,
  className,
}: {
  players: readonly Entity[]
  /** Every character, to find the familiars. */
  entities: readonly Entity[]
  rules: RulesConfig
  /** Who plays now (the character and its familiars). */
  activeIds: readonly string[]
  presence?: (id: string) => Presence
  /** The viewer own characters (online player). */
  selfIds?: readonly string[]
  /** Opens a character (the GM quick panel); without it the cards are read-only. */
  onOpen?: (id: string) => void
  compact?: boolean
  onToggleCompact?: () => void
  className?: string
}) {
  const t = useT()
  if (players.length === 0) return null
  return (
    <section
      aria-label={t.party.title}
      className={cn(
        'codex-glass flex max-w-full min-w-0 items-start gap-1 !rounded-xl p-1',
        className,
      )}
      data-testid="party-strip"
    >
      <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
        {players.map((p) => (
          <PartyCard
            key={p.id}
            entity={p}
            familiars={familiarsOf(entities, p.id)}
            rules={rules}
            activeIds={activeIds}
            presence={presence?.(p.id) ?? null}
            self={selfIds.includes(p.id)}
            onOpen={onOpen}
            compact={compact}
          />
        ))}
      </ul>
      {onToggleCompact && (
        <IconButton
          size="sm"
          label={compact ? t.party.expand : t.party.compact}
          icon={compact ? <ChevronsRight /> : <ChevronsLeft />}
          onClick={onToggleCompact}
          aria-expanded={!compact}
          className="hidden self-center @lg/board:inline-flex"
        />
      )}
    </section>
  )
}

function PartyCard({
  entity,
  familiars,
  rules,
  activeIds,
  presence,
  self,
  onOpen,
  compact,
}: {
  entity: Entity
  familiars: Entity[]
  rules: RulesConfig
  activeIds: readonly string[]
  presence: Presence
  self: boolean
  onOpen?: (id: string) => void
  compact: boolean
}) {
  const t = useT()
  const name = entityName(entity)
  const max = entityHpMax(entity, rules)
  const color = playerColorOf(entity)
  const active = activeIds.includes(entity.id)
  const extra = [
    self ? t.party.you : '',
    presence ? t.party[presence] : '',
    active ? t.party.playing : '',
    entity.conditions.length
      ? t.party.conditions(entity.conditions.map((c) => c.name).join(', '))
      : '',
  ]
    .filter(Boolean)
    .map((s) => `, ${s}`)
    .join('')
  const label = t.party.card(name, entity.hp.current, max, extra)
  // The player colour rings the portrait; uncoloured players keep the gold liseré.
  const ring = color
    ? 'shadow-[0_0_0_2px_var(--codex-surface),0_0_0_4px_var(--codex-player)]'
    : undefined

  const body = (
    <>
      <span className="relative flex shrink-0 flex-col items-center gap-1">
        <Portrait
          src={entity.identity.portrait}
          name={name}
          size="sm"
          className={cn('size-9 text-xs', ring)}
        />
        {presence && (
          <span
            className={cn(
              'absolute -top-0.5 -right-0.5 size-3 rounded-full border-2 border-surface',
              presence === 'online' ? 'bg-heal' : 'bg-ink-faint',
            )}
            aria-hidden
          />
        )}
        {/* Portraits only: the HP stay readable as a small bar. */}
        <HpBar
          current={entity.hp.current}
          max={max}
          size="sm"
          showLabel={false}
          thresholds={rules.hp}
          className={cn('w-9', compact ? 'block' : '@lg/board:hidden')}
        />
      </span>
      <span className={cn('w-28 min-w-0', compact ? 'hidden' : 'hidden @lg/board:block')}>
        <span className="flex items-baseline justify-between gap-1">
          <span
            className={cn(
              'truncate text-[0.8125rem] font-semibold',
              color ? 'text-player-text' : 'text-ink',
            )}
          >
            {name}
          </span>
          <span className="tabular shrink-0 text-[0.6875rem] text-ink-muted">
            {entity.hp.current}/{max}
          </span>
        </span>
        <HpBar
          current={entity.hp.current}
          max={max}
          size="sm"
          showLabel={false}
          thresholds={rules.hp}
          entityId={entity.id}
        />
        {entity.conditions.length > 0 && (
          <span className="mt-0.5 flex items-center gap-0.5" aria-hidden>
            {entity.conditions.slice(0, 4).map((c) => {
              const Icon = CONDITION_ICON_COMPONENTS[c.icon]
              const colors = CONDITION_COLOR_CLASSES[c.color]
              return (
                <span
                  key={c.id}
                  className={cn(
                    'inline-flex size-4 items-center justify-center rounded-full border',
                    colors.pill,
                  )}
                >
                  <Icon className={cn('size-2.5', colors.icon)} />
                </span>
              )
            })}
            {entity.conditions.length > 4 && (
              <span className="tabular text-[0.625rem] text-ink-muted">
                +{entity.conditions.length - 4}
              </span>
            )}
          </span>
        )}
      </span>
    </>
  )

  const cardClass = cn(
    'flex min-h-11 items-center gap-2 rounded-lg py-1 pr-2 pl-1 text-left',
    active && 'bg-gold-soft shadow-[inset_0_0_0_1px_var(--codex-gold-line)]',
    self && !active && 'bg-player-soft',
  )
  return (
    <li
      className="flex items-center gap-0.5"
      {...(color ? { 'data-player-color': color } : {})}
      aria-current={active ? 'step' : undefined}
    >
      {onOpen ? (
        <button
          type="button"
          onClick={() => onOpen(entity.id)}
          aria-label={label}
          title={label}
          className={cn(cardClass, !active && 'hover:bg-surface-2')}
        >
          {body}
        </button>
      ) : (
        <span role="img" aria-label={label} title={label} className={cardClass}>
          {body}
        </span>
      )}
      {familiars.length > 0 && (
        <FamiliarDots master={name} familiars={familiars} activeIds={activeIds} onOpen={onOpen} />
      )}
    </li>
  )
}

function FamiliarDots({
  master,
  familiars,
  activeIds,
  onOpen,
}: {
  master: string
  familiars: Entity[]
  activeIds: readonly string[]
  onOpen?: (id: string) => void
}) {
  const t = useT()
  return (
    <span className="flex flex-col gap-0.5">
      {familiars.map((f) => {
        const name = entityName(f)
        const label = `${t.party.familiar(name, master)} : ${f.hp.current} PV`
        const avatar: ReactNode = (
          <Portrait
            src={f.identity.portrait}
            name={name}
            size="sm"
            className={cn(
              'size-6 text-[0.5625rem]',
              activeIds.includes(f.id) &&
                'shadow-[0_0_0_2px_var(--codex-surface),0_0_0_3px_var(--codex-gold)]',
            )}
          />
        )
        return onOpen ? (
          <button
            key={f.id}
            type="button"
            onClick={() => onOpen(f.id)}
            aria-label={label}
            title={label}
            className="inline-flex rounded-full pointer-coarse:size-10 pointer-coarse:items-center pointer-coarse:justify-center"
          >
            {avatar}
          </button>
        ) : (
          <span key={f.id} role="img" aria-label={label} title={label} className="inline-flex">
            {avatar}
          </span>
        )
      })}
    </span>
  )
}

/** The GM party strip: the open campaign players, presence from the online game. */
export function GmPartyStrip({ className }: { className?: string }) {
  const campaign = useCampaign()
  const entities = useCampaignStore(useShallow((s) => Object.values(s.entities)))
  const play = useCampaignStore((s) => s.play)
  const peers = useOnlineStore((s) => s.peers)
  const openQuick = useUiStore((s) => s.openQuick)
  const compact = useUiStore((s) => s.play.partyCompact)
  const setPanels = useUiStore((s) => s.setPlayPanels)
  const players = useMemo(
    () =>
      entities
        .filter((e) => e.kind === 'player')
        .sort((a, b) => compareText(entityName(a), entityName(b))),
    [entities],
  )
  const activeIds = useMemo(() => turnActors(play, entities), [play, entities])
  const online = play.live?.mode === 'online'
  const presence = (id: string): Presence => {
    const peer = peers.find((p) => p.characterIds.includes(id))
    if (peer?.status === 'connected') return 'online'
    return online ? 'offline' : null
  }
  return (
    <PartyStrip
      players={players}
      entities={entities}
      rules={campaign.rules}
      activeIds={activeIds}
      presence={presence}
      onOpen={openQuick}
      compact={compact}
      onToggleCompact={() => setPanels({ partyCompact: !compact })}
      className={className}
    />
  )
}
