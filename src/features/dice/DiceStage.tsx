import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion } from 'framer-motion'
import { EyeOff } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { activeDb } from '@/db/db'
import { entityName } from '@/domain/entity'
import { colorIn, GM_COLOR, type RollColor } from '@/domain/playerColors'
import { GameIcon } from '@/components/GameIcon'
import type { RollRecord } from '@/domain/rolls'
import type { Entity } from '@/domain/types'
import { Portrait } from '@/features/characters/Portrait'
import { cuesForRoll } from '@/features/sound/soundEvents'
import { useT } from '@/i18n'
import { playSound } from '@/lib/audio/sfx'
import { cn } from '@/lib/cn'
import { clamp } from '@/lib/numbers'
import { isHostDevice } from '@/online/onlineStore'
import { useCampaignStore } from '@/stores/campaignStore'
import { useFxStore } from '@/stores/fxStore'
import { useRollStore } from '@/stores/rollStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { AnimatedDie, GoldBurst } from './AnimatedDie'
import { enqueueRolls, freshRolls, STAGE_FRESH_MS, stageDuration } from './diceStageQueue'
import { useDiceAnimation } from './useDiceAnimation'
import { useOutcomeText } from './useOutcomeText'

/** Dice shown big; the others are counted. */
const STAGE_DICE = 6

export interface DiceStageProps {
  /** Every roll this screen knows (any order); undefined while loading. */
  rolls: readonly RollRecord[] | undefined
  entities: Readonly<Record<string, Entity>>
  /** Secret GM rolls: the GM's own devices only. */
  showSecret: boolean
  /** A game is live: rolls are staged only then. */
  active: boolean
}

/**
 * The dice stage (D-268): during a live game, every new roll tumbles in big in
 * the middle of the screen, in the colour of whoever rolled (the GM's gold for
 * the GM), then leaves by itself. Rolls queue up; the queue speeds up and drops
 * the oldest when it grows. Never blocks the table (no pointer events); Esc
 * skips. Rolls already there when it mounts, and old ones arriving late
 * (initial sync, reconnection), are never played.
 */
export function DiceStage({ rolls, entities, showSecret, active }: DiceStageProps) {
  const t = useT()
  const enabled = useSettingsStore((s) => s.diceStage)
  const animated = useDiceAnimation()
  const seen = useRef<Set<string> | null>(null)
  const [queue, setQueue] = useState<RollRecord[]>([])

  useEffect(() => {
    if (!rolls) return
    if (!seen.current) {
      seen.current = new Set(rolls.map((r) => r.id))
      return
    }
    const fresh = freshRolls(rolls, seen.current, { now: Date.now(), showSecret })
    if (active && enabled && fresh.length) setQueue((q) => enqueueRolls(q, fresh))
  }, [rolls, active, enabled, showSecret])

  // The game ended or the setting was turned off: the stage empties.
  const on = active && enabled
  const [wasOn, setWasOn] = useState(on)
  if (on !== wasOn) {
    setWasOn(on)
    if (!on) setQueue([])
  }

  const current = queue[0]
  const currentId = current?.id
  const waiting = queue.length - 1
  const startedAt = useRef(0)

  useEffect(() => {
    if (currentId) startedAt.current = Date.now()
  }, [currentId])

  // Leaves by itself; sooner when other rolls wait.
  useEffect(() => {
    if (!currentId) return
    const left = stageDuration(waiting, animated) - (Date.now() - startedAt.current)
    const timer = setTimeout(() => setQueue((q) => q.slice(1)), Math.max(0, left))
    return () => clearTimeout(timer)
  }, [currentId, waiting, animated])

  useEffect(() => {
    if (!currentId) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setQueue((q) => q.slice(1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [currentId])

  // The dice rattle for rolls nobody played yet here (the roller's own device
  // already did through the roll feed); never in the players' window.
  useEffect(() => {
    if (!current) return
    const s = useSettingsStore.getState()
    if (!s.soundEffects || s.surface === 'players' || document.visibilityState !== 'visible') return
    if (useFxStore.getState().rollToAnimate === current.id) return
    for (const cue of cuesForRoll(current)) playSound(cue.name, cue.delay)
    // Once per roll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId])

  const entity = current?.entityId ? entities[current.entityId] : undefined
  const who = entity ? entityName(entity) : t.dice.gm

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[35] flex items-center justify-center overflow-hidden px-4">
      <div className="sr-only" aria-live="polite" data-testid="dice-stage-live">
        {current ? <Announce roll={current} who={who} /> : null}
      </div>
      {/* The table dims around the roll, so it reads over any board. */}
      <AnimatePresence>
        {current && (
          <motion.div
            key="scrim"
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--codex-scrim)_0%,var(--codex-scrim)_35%,transparent_80%)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {current && (
          <StageCard
            key={current.id}
            roll={current}
            who={who}
            portrait={entity?.identity.portrait ?? null}
            color={colorIn(entities, current.entityId)}
            animated={animated}
          />
        )}
      </AnimatePresence>
    </div>,
    document.body,
  )
}

function Announce({ roll, who }: { roll: RollRecord; who: string }) {
  const t = useT()
  const outcome = useOutcomeText(roll)
  return <>{t.diceStage.announce(who, roll.label, roll.total, outcome?.text ?? null)}</>
}

/** Die size for this screen: big on desktop, still big on a 390 px phone. */
function dieSize(count: number): number {
  const width = window.innerWidth
  const base = clamp(Math.round(width / 7), 76, 150)
  const fit = Math.floor((Math.min(width, 900) - 48 - (count - 1) * 12) / Math.max(count, 1))
  return clamp(Math.min(base, fit), 48, 150)
}

function StageCard({
  roll,
  who,
  portrait,
  color,
  animated,
}: {
  roll: RollRecord
  who: string
  portrait: string | null
  color: RollColor
  animated: boolean
}) {
  const t = useT()
  const outcome = useOutcomeText(roll)
  const dice = roll.groups.flatMap((g) => g.dice.map((d) => ({ ...d, sides: g.sides })))
  const shown = dice.slice(0, STAGE_DICE)
  const extra = dice.length - shown.length
  const [size] = useState(() => dieSize(shown.length))
  const [landed, setLanded] = useState(!animated || shown.length === 0)
  const critical = roll.check?.outcome.critical
  const shake = landed && animated && critical?.kind === 'failure'

  return (
    <motion.div
      data-testid="dice-stage"
      data-player-color={color}
      className="relative flex w-full max-w-[56rem] flex-col items-center gap-3 text-center sm:gap-4"
      initial={{ opacity: 0, scale: animated ? 0.92 : 1 }}
      animate={{ opacity: 1, scale: 1, x: shake ? [0, -14, 14, -10, 10, -5, 0] : 0 }}
      exit={{ opacity: 0, scale: animated ? 1.04 : 1, transition: { duration: 0.25 } }}
      transition={{ duration: animated ? 0.3 : 0.15, x: { duration: 0.45, ease: 'linear' } }}
    >
      {/* The roller's colour, as a halo behind everything. */}
      <span
        aria-hidden
        className="absolute top-1/2 left-1/2 -z-10 size-[min(110vw,46rem)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,var(--codex-player-glow)_0%,transparent_62%)]"
      />

      <span className="inline-flex max-w-full items-center gap-2.5 rounded-full border-2 border-player bg-surface-raised py-1 pr-4 pl-1 shadow-lifted">
        {color === GM_COLOR && !portrait ? (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-player-soft text-player-text shadow-[0_0_0_2px_var(--codex-surface-raised),0_0_0_4px_var(--codex-player)]">
            <GameIcon name="rolling-dices" className="size-6" aria-hidden />
          </span>
        ) : (
          <Portrait
            src={portrait}
            name={who}
            size="sm"
            className="bg-player-soft text-player-text shadow-[0_0_0_2px_var(--codex-surface-raised),0_0_0_4px_var(--codex-player)]"
          />
        )}
        <span className="truncate type-card-title text-player-text">{who}</span>
        {roll.secret && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-2 px-2 text-xs font-medium text-ink">
            <EyeOff className="size-3" aria-hidden />
            {t.diceStage.secret}
          </span>
        )}
      </span>

      <p className="max-w-full rounded-lg bg-surface-raised/90 px-3 py-0.5 font-title text-lg leading-snug text-ink shadow-soft sm:text-2xl">
        {roll.label}
      </p>

      {shown.length > 0 && (
        <div
          className="flex max-w-full flex-wrap items-center justify-center gap-3"
          style={{ perspective: 900 }}
          aria-hidden
        >
          {shown.map((d, i) => (
            <motion.span
              key={i}
              className="inline-flex drop-shadow-[0_0_20px_var(--codex-player-glow)]"
              style={{ transformStyle: 'preserve-3d' }}
              initial={
                animated
                  ? {
                      rotateX: 520 + i * 70,
                      rotateY: -380 - i * 50,
                      y: -240,
                      x: (i - (shown.length - 1) / 2) * -40,
                      scale: 1.5,
                      opacity: 0,
                    }
                  : { opacity: 0 }
              }
              animate={{ rotateX: 0, rotateY: 0, y: 0, x: 0, scale: 1, opacity: 1 }}
              transition={
                animated
                  ? { type: 'spring', stiffness: 150, damping: 15, mass: 1, delay: i * 0.07 }
                  : { duration: 0.15 }
              }
            >
              <AnimatedDie
                value={d.value}
                sides={d.sides}
                kept={d.kept}
                rolling={animated}
                tone="player"
                size={size}
                rollMs={620 + i * 80}
                onLanded={i === shown.length - 1 ? () => setLanded(true) : undefined}
              />
            </motion.span>
          ))}
        </div>
      )}
      {extra > 0 && (
        <p className="rounded-full bg-surface-raised/90 px-3 text-sm font-semibold text-ink-muted">
          {t.diceStage.moreDice(extra)}
        </p>
      )}

      <span className="relative inline-flex items-center justify-center">
        {landed && animated && critical?.kind === 'success' && <GoldBurst reach={2.6} />}
        <motion.span
          key={landed ? 'landed' : 'rolling'}
          className={cn(
            'tabular font-display text-[clamp(4.5rem,16vw,9rem)] leading-none font-bold',
            '[text-shadow:0_3px_0_var(--codex-bevel-lo),0_0_32px_var(--codex-player-glow)]',
            critical?.kind === 'success'
              ? 'text-gold-text'
              : critical?.kind === 'failure'
                ? 'text-hp-text'
                : 'text-player-text',
          )}
          initial={landed && animated ? { scale: 0.2, opacity: 0 } : false}
          animate={{ scale: 1, opacity: landed ? 1 : 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 14 }}
          data-testid="dice-stage-total"
        >
          {roll.total}
        </motion.span>
      </span>

      {outcome && (
        <motion.span
          className={cn(
            'rounded-full border px-4 py-1 font-display text-lg font-bold tracking-[0.06em] shadow-lifted sm:text-xl',
            outcome.tone === 'gold'
              ? 'border-gold-line bg-gold-soft text-gold-text'
              : outcome.tone === 'red'
                ? 'border-hp bg-hp-soft text-hp-text'
                : outcome.tone === 'success'
                  ? 'border-heal bg-heal-soft text-heal-text'
                  : 'border-line-strong bg-surface-raised text-ink',
          )}
          initial={animated ? { opacity: 0, y: 12 } : false}
          animate={{ opacity: landed ? 1 : 0, y: landed ? 0 : 12 }}
          transition={{ duration: 0.25, delay: animated ? 0.12 : 0 }}
        >
          {outcome.text}
        </motion.span>
      )}
    </motion.div>
  )
}

/** The dice stage of the GM's play screen: rolls of the open campaign. */
export function PlayDiceStage() {
  const rolls = useRollStore((s) => s.rolls)
  const entities = useCampaignStore((s) => s.entities)
  const live = useCampaignStore((s) => s.play.live)
  return (
    <DiceStage
      rolls={rolls}
      entities={entities}
      showSecret={isHostDevice()}
      active={Boolean(live)}
    />
  )
}

/**
 * The dice stage of screens that read the database live (players' window, a
 * player's device): the last few seconds of rolls only, never the secret ones.
 */
export function LiveDiceStage({
  campaignId,
  entities,
  active,
}: {
  campaignId: string
  entities: Readonly<Record<string, Entity>>
  active: boolean
}) {
  const rolls = useLiveQuery(
    () =>
      activeDb()
        .rolls.where('[campaignId+at]')
        .between([campaignId, Date.now() - STAGE_FRESH_MS], [campaignId, Infinity])
        .toArray(),
    [campaignId],
  )
  return <DiceStage rolls={rolls} entities={entities} showSecret={false} active={active} />
}
