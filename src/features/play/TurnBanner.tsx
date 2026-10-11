import { motion } from 'framer-motion'
import { CircleStop, Crown, Play, SkipForward } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/Button'
import { entityName } from '@/domain/entity'
import { canStart } from '@/domain/turns'
import { Portrait } from '@/features/characters/Portrait'
import { useGameActions } from '@/features/game/useGameActions'
import { useT } from '@/i18n'
import { cn } from '@/lib/cn'
import { useCampaignStore } from '@/stores/campaignStore'
import { useUiStore } from '@/stores/uiStore'

/**
 * Turn banner (D-226): which group plays, its characters in order with the
 * active one highlighted, the following groups, and the GM's turn at the end.
 */
export function TurnBanner() {
  const t = useT()
  const actions = useGameActions()
  const play = useCampaignStore((s) => s.play)
  const entities = useCampaignStore(useShallow((s) => s.entities))
  const openQuick = useUiStore((s) => s.openQuick)
  const turn = play.turn

  if (turn.status === 'stopped')
    return (
      <Bar>
        <p className="min-w-0 flex-1 text-sm text-ink-muted">
          {canStart(play) ? t.turns.banner : t.turns.noGroupYet}
        </p>
        <Button
          variant="primary"
          icon={<Play />}
          disabled={!canStart(play)}
          onClick={actions.startTurns}
        >
          {t.turns.start}
        </Button>
      </Bar>
    )

  if (turn.status === 'gm')
    return (
      <Bar tone="gold">
        <RoundChip round={turn.round} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
            <Crown className="size-5 text-gold" aria-hidden />
            {t.turns.gmTurn}
          </p>
          <p className="text-sm text-ink-muted">{t.turns.gmTurnHint}</p>
        </div>
        <Button variant="ghost" icon={<CircleStop />} onClick={actions.stopTurns}>
          {t.turns.stop}
        </Button>
        <Button variant="primary" icon={<Play />} onClick={actions.resumeTurns} autoFocus>
          {t.turns.resume}
        </Button>
      </Bar>
    )

  const group = play.groups.find((g) => g.id === turn.groupId)
  const position = group ? group.memberIds.indexOf(turn.memberId) : -1
  const later = play.groups.slice(play.groups.findIndex((g) => g.id === turn.groupId) + 1)
  return (
    <Bar>
      <RoundChip round={turn.round} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">
          {t.turns.playing(group?.name ?? '')}
        </p>
        <ol className="mt-1 flex flex-wrap items-center gap-2" aria-label={group?.name}>
          {group?.memberIds.map((id, index) => {
            const e = entities[id]
            if (!e) return null
            const current = id === turn.memberId
            const name = entityName(e)
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => openQuick(id)}
                  aria-current={current ? 'step' : undefined}
                  aria-label={`${t.turns.open(name)}${current ? ` — ${t.turns.current(name)}` : index < position ? ` (${t.turns.done})` : ''}`}
                  className={cn(
                    'flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm transition-all',
                    current
                      ? 'border-accent bg-accent-soft font-semibold text-ink shadow-soft'
                      : 'border-line bg-surface text-ink-muted hover:text-ink',
                    index < position && 'opacity-60',
                  )}
                >
                  <span className="relative">
                    <Portrait
                      src={e.identity.portrait}
                      name={name}
                      size="sm"
                      className="size-8 text-xs"
                    />
                    {current && (
                      <motion.span
                        className="absolute -inset-1 rounded-full ring-2 ring-accent"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        aria-hidden
                      />
                    )}
                  </span>
                  {name}
                </button>
              </li>
            )
          })}
        </ol>
        {later.some((g) => g.memberIds.length) && (
          <p className="mt-1 truncate text-xs text-ink-muted">
            {t.turns.upcoming} :{' '}
            {later
              .filter((g) => g.memberIds.length)
              .map((g) => g.name)
              .join(' → ')}{' '}
            → {t.turns.gmTurn}
          </p>
        )}
      </div>
      <Button variant="ghost" icon={<CircleStop />} onClick={actions.stopTurns}>
        {t.turns.stop}
      </Button>
      <Button
        variant="primary"
        icon={<SkipForward />}
        onClick={actions.nextTurn}
        title={t.turns.nextHint}
      >
        {t.turns.next}
      </Button>
    </Bar>
  )
}

function Bar({ children, tone }: { children: React.ReactNode; tone?: 'gold' }) {
  const t = useT()
  return (
    <section
      aria-label={t.turns.banner}
      className={cn(
        'glass relative z-10 flex flex-wrap items-center gap-3 border-b px-4 py-3',
        tone === 'gold' ? 'border-gold/60 bg-gold-soft/60' : 'border-line',
      )}
    >
      {children}
    </section>
  )
}

function RoundChip({ round }: { round: number }) {
  const t = useT()
  return (
    <span className="tabular shrink-0 rounded-md bg-ink px-2.5 py-1 font-display text-sm font-semibold text-bg">
      {t.turns.round(round)}
    </span>
  )
}
