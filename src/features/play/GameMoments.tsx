import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { GameIcon, type GameIconName } from '@/components/GameIcon'
import { useT } from '@/i18n'
import { playSound } from '@/lib/audio/sfx'
import { cn } from '@/lib/cn'
import { useCampaignStore } from '@/stores/campaignStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { momentBetween, type GameMoment } from './battleMoments'

const SHOWN_MS: Record<GameMoment['kind'], number> = { round: 1800, victory: 3800, defeat: 3800 }
const ICONS: Record<GameMoment['kind'], GameIconName> = {
  round: 'crossed-swords',
  victory: 'laurel-crown',
  defeat: 'crowned-skull',
}

/**
 * Banners of the big moments (D-252): « Round 2 » sweeps across the board,
 * « Victoire » or « Défaite » closes a fight. They never block the table
 * (no pointer events) and leave by themselves. Settings › Ambiance de jeu.
 */
export function GameMoments() {
  const t = useT()
  const [moment, setMoment] = useState<(GameMoment & { id: number }) | null>(null)

  useEffect(() => {
    let id = 0
    return useCampaignStore.subscribe((state, previous) => {
      if (!useSettingsStore.getState().gameBanners) return
      if (state.status !== 'ready' || previous.status !== 'ready') return
      if (state.campaignId !== previous.campaignId) return
      const next = momentBetween(previous, state)
      if (!next) return
      setMoment({ ...next, id: ++id })
      if (next.kind !== 'round' && useSettingsStore.getState().soundEffects) playSound(next.kind)
    })
  }, [])

  useEffect(() => {
    if (!moment) return
    const timer = setTimeout(() => setMoment(null), SHOWN_MS[moment.kind])
    return () => clearTimeout(timer)
  }, [moment])

  const text = !moment
    ? ''
    : moment.kind === 'round'
      ? t.moments.round(moment.round)
      : t.moments[moment.kind]
  const subtitle = moment && moment.kind !== 'round' ? t.moments[`${moment.kind}Sub`] : null

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center overflow-hidden">
      <div className="sr-only" aria-live="polite">
        {text}
      </div>
      <AnimatePresence>
        {moment && (
          <motion.div
            key={moment.id}
            data-testid="game-moment"
            className="w-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              className={cn(
                'relative flex flex-col items-center gap-1 border-y py-5 shadow-overlay',
                moment.kind === 'defeat'
                  ? 'border-line-strong bg-surface-sunken/90'
                  : 'border-gold-line bg-surface-raised/90',
              )}
              initial={{ scaleY: 0.2 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <motion.div
                className="flex items-center gap-4"
                initial={{
                  x: moment.kind === 'round' ? '-40vw' : 0,
                  scale: moment.kind === 'round' ? 1 : 1.3,
                }}
                animate={{ x: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <GameIcon
                  name={ICONS[moment.kind]}
                  className={cn(
                    'size-10',
                    moment.kind === 'defeat' ? 'text-hp-text' : 'text-gold-text',
                  )}
                  aria-hidden
                />
                <span
                  className={cn(
                    'font-display text-[3rem] leading-none font-bold tracking-[0.08em] [text-shadow:0_2px_0_var(--codex-bevel-lo)]',
                    moment.kind === 'defeat' ? 'text-hp-text' : 'text-gold-text',
                  )}
                >
                  {text}
                </span>
                <GameIcon
                  name={ICONS[moment.kind]}
                  className={cn(
                    'size-10 -scale-x-100',
                    moment.kind === 'defeat' ? 'text-hp-text' : 'text-gold-text',
                  )}
                  aria-hidden
                />
              </motion.div>
              {subtitle && <p className="font-title text-lg text-ink">{subtitle}</p>}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
