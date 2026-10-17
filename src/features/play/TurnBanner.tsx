import { motion } from 'framer-motion'
import { ChevronRight, CircleStop, Play, SkipForward } from 'lucide-react'
import { GameIcon } from '@/components/GameIcon'
import { Fragment } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useIdle } from '@/app/useIdle'
import { Button } from '@/components/ui/Button'
import { entityName } from '@/domain/entity'
import { turnFamiliars } from '@/domain/familiars'
import { playerColorOf } from '@/domain/playerColors'
import { canStart, turnActors, type PlayGroup, type TurnState } from '@/domain/turns'
import type { Entity } from '@/domain/types'
import { Portrait } from '@/features/characters/Portrait'
import { useGameActions } from '@/features/game/useGameActions'
import { SessionMenu } from '@/features/sessions/SessionMenu'
import { useT } from '@/i18n'
import { cn } from '@/lib/cn'
import { useCampaignStore } from '@/stores/campaignStore'
import { useUiStore } from '@/stores/uiStore'

/**
 * Turn bar (D-226, DA §8.21): the round, every group in playing order with
 * its characters, the GM's turn at the end, and the next-turn button. One
 * slim row on computers (D-272); on phones the round and the buttons come
 * first and the order wraps under them, never cut off.
 */
export function TurnBanner() {
  const t = useT()
  const actions = useGameActions()
  const play = useCampaignStore((s) => s.play)
  const entities = useCampaignStore(useShallow((s) => s.entities))
  const turn = play.turn
  const idle = useIdle(20_000, turn.status === 'playing')
  const groups = play.groups.filter((g) => g.memberIds.length)
  const currentIndex =
    turn.status === 'playing' ? play.groups.findIndex((g) => g.id === turn.groupId) : -1
  const currentGroup = currentIndex >= 0 ? play.groups[currentIndex] : undefined

  return (
    <section
      aria-label={t.turns.banner}
      className="relative z-20 flex min-h-14 shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line bg-[var(--codex-bar)] px-3 py-1.5 sm:px-4"
    >
      {turn.status !== 'stopped' && (
        <>
          <span className="tabular order-1 shrink-0 font-display text-sm font-bold tracking-[0.14em] text-gold-text uppercase">
            {t.turns.round(turn.round)}
          </span>
          <span className="order-1 hidden h-7 w-px shrink-0 bg-line lg:block" aria-hidden />
        </>
      )}
      {/* For screen readers and tests: who plays, in words. */}
      <p className="sr-only" aria-live="polite">
        {turn.status === 'playing'
          ? t.turns.playing(currentGroup?.name ?? '')
          : turn.status === 'gm'
            ? `${t.turns.gmTurn}. ${t.turns.gmTurnHint}`
            : canStart(play)
              ? t.turns.banner
              : t.turns.noGroupYet}
      </p>

      {groups.length === 0 ? (
        <p
          className="order-3 min-w-0 flex-1 basis-full text-sm text-ink-muted lg:order-2 lg:basis-0"
          aria-hidden
        >
          {t.turns.noGroupYet}
        </p>
      ) : (
        <ol
          aria-label={t.turns.order}
          // Every group in view: the chips wrap rather than scroll out of sight.
          className="order-3 flex min-w-0 flex-1 basis-full flex-wrap items-center gap-1.5 py-0.5 lg:order-2 lg:basis-0"
        >
          {groups.map((group, index) => (
            <Fragment key={group.id}>
              {index > 0 && <ChevronRight className="size-3 shrink-0 text-ink-muted" aria-hidden />}
              <GroupChip
                group={group}
                entities={entities}
                turn={turn}
                state={
                  turn.status === 'stopped'
                    ? 'idle'
                    : group.id === currentGroup?.id
                      ? 'current'
                      : turn.status === 'gm' ||
                          play.groups.findIndex((g) => g.id === group.id) < currentIndex
                        ? 'done'
                        : 'upcoming'
                }
              />
            </Fragment>
          ))}
          <ChevronRight className="size-3 shrink-0 text-ink-muted" aria-hidden />
          <li
            className={cn(
              'flex h-[34px] shrink-0 items-center gap-1.5 rounded-full border px-3 text-[0.8125rem] font-semibold',
              turn.status === 'gm'
                ? 'border-accent bg-accent-soft text-accent-text'
                : 'border-dashed border-line-strong text-ink-muted',
            )}
            aria-current={turn.status === 'gm' ? 'step' : undefined}
          >
            <GameIcon name="crown" className="size-3.5" aria-hidden />
            {t.turns.gmTurn}
          </li>
        </ol>
      )}

      <ActorRolls ids={turnActors(play, entities)} entities={entities} />

      <div className="order-2 ml-auto flex min-w-0 flex-wrap items-center justify-end gap-1.5 lg:order-4">
        <SessionMenu />
        {turn.status === 'stopped' ? (
          <Button
            variant="primary"
            icon={<Play />}
            disabled={!canStart(play)}
            onClick={actions.startTurns}
          >
            {t.turns.start}
          </Button>
        ) : (
          <>
            <Button
              variant="ghost"
              icon={<CircleStop />}
              onClick={actions.stopTurns}
              aria-label={t.turns.stop}
              title={t.turns.stop}
              className="max-xl:px-2.5"
            >
              <span className="hidden xl:inline">{t.turns.stop}</span>
            </Button>
            {turn.status === 'gm' ? (
              <Button variant="primary" icon={<Play />} onClick={actions.resumeTurns} autoFocus>
                {t.turns.resume}
              </Button>
            ) : (
              <Button
                variant="primary"
                icon={<SkipForward />}
                onClick={actions.nextTurn}
                title={t.turns.nextHint}
                className={cn(idle && 'idle-pulse')}
              >
                {t.turns.next}
              </Button>
            )}
          </>
        )}
      </div>
    </section>
  )
}

function GroupChip({
  group,
  entities,
  turn,
  state,
}: {
  group: PlayGroup
  entities: Record<string, Entity>
  turn: TurnState
  state: 'idle' | 'current' | 'done' | 'upcoming'
}) {
  const t = useT()
  const openQuick = useUiStore((s) => s.openQuick)
  const current = state === 'current'
  const position =
    current && turn.status === 'playing' ? group.memberIds.indexOf(turn.memberId) : -1
  return (
    <li
      className={cn(
        'flex max-w-full min-w-0 shrink-0 items-center gap-1.5 rounded-lg py-1 pr-2 pl-1',
        current ? 'bg-gold-soft shadow-[inset_0_0_0_1px_var(--codex-gold-line)]' : 'bg-surface-2',
      )}
    >
      <span
        className={cn(
          'max-w-24 truncate pl-1 text-xs font-bold tracking-wide uppercase',
          current ? 'text-gold-text' : 'text-ink-muted',
        )}
      >
        {group.name}
      </span>
      <ol className="flex min-w-0 flex-wrap items-center gap-1.5" aria-label={group.name}>
        {group.memberIds.map((id, index) => {
          const e = entities[id]
          if (!e) return null
          const name = entityName(e)
          const active = current && index === position
          const played = current && index < position
          const color = playerColorOf(e)
          return (
            <li
              key={id}
              className="relative flex items-center"
              {...(color ? { 'data-player-color': color } : {})}
            >
              <button
                type="button"
                onClick={() => openQuick(id)}
                aria-current={active ? 'step' : undefined}
                aria-label={`${t.turns.open(name)}${active ? ` — ${t.turns.current(name)}` : played ? ` (${t.turns.done})` : ''}`}
                title={name}
                className={cn(
                  'relative block rounded-full transition-[filter]',
                  // Already played: desaturated (an opacity would break text contrast).
                  (played || state === 'done') && 'grayscale',
                )}
              >
                {active && (
                  <motion.span
                    layoutId="turn-halo"
                    className={cn(
                      'absolute inset-0',
                      e.kind === 'enemy' ? 'rounded-md' : 'rounded-full',
                    )}
                    style={{
                      boxShadow:
                        '0 0 0 2px var(--codex-bg), 0 0 0 4px var(--codex-gold), 0 0 12px var(--codex-gold-glow)',
                    }}
                    transition={{ duration: 0.3, ease: [0.65, 0, 0.35, 1] }}
                    aria-hidden
                  />
                )}
                <Portrait
                  src={e.identity.portrait}
                  name={name}
                  size="sm"
                  square={e.kind === 'enemy'}
                  className={cn(
                    'size-[34px] text-xs',
                    color && 'shadow-[0_0_0_2px_var(--codex-bg),0_0_0_3.5px_var(--codex-player)]',
                  )}
                />
              </button>
              <FamiliarAvatars
                master={e}
                entities={entities}
                active={active}
                played={played || state === 'done'}
              />
            </li>
          )
        })}
      </ol>
    </li>
  )
}

/** Familiars play at their master's turn (D-269): small avatars joined to the master's. */
function FamiliarAvatars({
  master,
  entities,
  active,
  played,
}: {
  master: Entity
  entities: Record<string, Entity>
  active: boolean
  played: boolean
}) {
  const t = useT()
  const openQuick = useUiStore((s) => s.openQuick)
  const familiars = turnFamiliars(entities, master.id)
  if (familiars.length === 0) return null
  const masterName = entityName(master)
  return (
    <span className="-ml-1.5 flex items-center">
      {familiars.map((f) => {
        const name = entityName(f)
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => openQuick(f.id)}
            aria-label={`${t.turns.open(name)} — ${t.crew.sharesTurn(masterName)}`}
            title={`${name} · ${t.familiars.of(masterName)}`}
            className={cn(
              'relative -ml-1 block rounded-full shadow-[0_0_0_2px_var(--codex-bg)] first:ml-0',
              active && 'shadow-[0_0_0_2px_var(--codex-bg),0_0_0_3px_var(--codex-gold)]',
              played && 'grayscale',
            )}
          >
            <Portrait
              src={f.identity.portrait}
              name={name}
              size="sm"
              className="size-[22px] text-[0.5625rem]"
            />
          </button>
        )
      })}
    </span>
  )
}

/**
 * Who acts now, one tap from their dice (D-269): the character whose turn it
 * is and its familiars. The GM rolls for enemies and allies from here; on a
 * player's turn it is there too, the GM keeping every power.
 */
function ActorRolls({ ids, entities }: { ids: string[]; entities: Record<string, Entity> }) {
  const t = useT()
  const openQuick = useUiStore((s) => s.openQuick)
  const actors = ids.map((id) => entities[id]).filter((e): e is Entity => Boolean(e))
  if (actors.length === 0) return null
  return (
    <ul
      aria-label={t.crew.actors}
      className="order-4 hidden min-w-0 flex-wrap items-center gap-1.5 sm:flex lg:order-3"
    >
      {actors.map((e) => {
        const name = entityName(e)
        return (
          <li key={e.id}>
            <Button
              size="sm"
              variant="secondary"
              icon={<GameIcon name="rolling-dices" />}
              onClick={() => openQuick(e.id)}
              aria-label={t.crew.rollFor(name)}
              title={t.crew.rollFor(name)}
              className="max-w-40"
            >
              <span className="truncate">{name}</span>
            </Button>
          </li>
        )
      })}
    </ul>
  )
}
