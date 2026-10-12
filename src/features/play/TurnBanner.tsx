import { motion } from 'framer-motion'
import { ChevronRight, CircleStop, Crown, Play, SkipForward } from 'lucide-react'
import { Fragment } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useIdle } from '@/app/useIdle'
import { Button } from '@/components/ui/Button'
import { entityName } from '@/domain/entity'
import { canStart, type PlayGroup, type TurnState } from '@/domain/turns'
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
 * its characters, the GM's turn at the end, and the next-turn button.
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
      className="relative z-20 flex min-h-16 shrink-0 items-center gap-3.5 border-b border-line bg-[var(--codex-bar)] px-4 py-2"
    >
      {turn.status !== 'stopped' && (
        <>
          <span className="tabular shrink-0 font-display text-sm font-bold tracking-[0.14em] text-gold-text uppercase">
            {t.turns.round(turn.round)}
          </span>
          <span className="h-7 w-px shrink-0 bg-line" aria-hidden />
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
        <p className="min-w-0 flex-1 text-sm text-ink-muted" aria-hidden>
          {t.turns.noGroupYet}
        </p>
      ) : (
        <ol
          aria-label={t.turns.order}
          className="flex min-w-0 flex-1 [scrollbar-width:none] items-center gap-2 overflow-x-auto px-1 py-1"
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
            <Crown className="size-3.5" aria-hidden />
            {t.turns.gmTurn}
          </li>
        </ol>
      )}

      <div className="flex shrink-0 items-center gap-2">
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
            <Button variant="ghost" icon={<CircleStop />} onClick={actions.stopTurns}>
              {t.turns.stop}
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
        'flex shrink-0 items-center gap-2 rounded-[14px] py-1.5 pr-2.5 pl-1.5',
        current ? 'bg-gold-soft shadow-[inset_0_0_0_1px_var(--codex-gold-line)]' : 'bg-surface-2',
      )}
    >
      <span
        className={cn(
          'max-w-28 truncate pl-1 text-xs font-bold tracking-wide uppercase',
          current ? 'text-gold-text' : 'text-ink-muted',
        )}
      >
        {group.name}
      </span>
      <ol className="flex items-center gap-1.5" aria-label={group.name}>
        {group.memberIds.map((id, index) => {
          const e = entities[id]
          if (!e) return null
          const name = entityName(e)
          const active = current && index === position
          const played = current && index < position
          return (
            <li key={id} className="relative">
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
                      e.kind === 'enemy' ? 'rounded-[9px]' : 'rounded-full',
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
                  className="size-[34px] text-xs"
                />
              </button>
            </li>
          )
        })}
      </ol>
    </li>
  )
}
