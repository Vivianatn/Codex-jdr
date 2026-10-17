import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'

/** Dice choreography (DA §7.3): tumble in 520 ms, then the real face lands. */
const ROLL_MS = 520
const SPRING = { type: 'spring' as const, stiffness: 420, damping: 28, mass: 0.9 }

/** Outline of each die, in a 40×40 box. */
function shapeFor(sides: number): string {
  switch (sides) {
    case 4:
      return 'M20 3 L37 34 L3 34 Z'
    case 6:
      return 'M7 4 H33 Q36 4 36 7 V33 Q36 36 33 36 H7 Q4 36 4 33 V7 Q4 4 7 4 Z'
    case 8:
      return 'M20 2 L38 20 L20 38 L2 20 Z'
    case 10:
    case 100:
      return 'M20 2 L37 16 L31 36 H9 L3 16 Z'
    case 12:
      return 'M20 2 L38 15 L31 37 H9 L2 15 Z'
    case 20:
      return 'M20 1 L37 10.5 V29.5 L20 39 L3 29.5 V10.5 Z'
    default:
      return 'M20 2 A18 18 0 1 1 19.99 2 Z'
  }
}

/**
 * One die. When `rolling`, faces flicker and the die tumbles, then it lands
 * with a small bounce on its real value.
 */
export function AnimatedDie({
  value,
  sides,
  kept = true,
  rolling = false,
  tone = 'default',
  size = 40,
  rollMs = ROLL_MS,
  onLanded,
}: {
  value: number
  sides: number
  kept?: boolean
  rolling?: boolean
  /** `player`: the colour of the nearest data-player-color ancestor (D-268). */
  tone?: 'default' | 'gold' | 'red' | 'player'
  size?: number
  /** How long the faces flicker before the die lands. */
  rollMs?: number
  onLanded?: () => void
}) {
  // Start on another face; the real value only appears when the die lands.
  const [shown, setShown] = useState(rolling ? (value % sides) + 1 : value)
  const [landed, setLanded] = useState(!rolling)

  useEffect(() => {
    if (!rolling) return
    const tick = setInterval(() => setShown(Math.ceil(Math.random() * sides)), 60)
    const stop = setTimeout(() => {
      clearInterval(tick)
      setShown(value)
      setLanded(true)
      onLanded?.()
    }, rollMs)
    return () => {
      clearInterval(tick)
      clearTimeout(stop)
    }
    // Runs once per roll; `onLanded` is a callback that may change identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolling, sides, value, rollMs])

  const display = landed || !rolling ? value : shown
  return (
    <motion.span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center',
        !kept && 'opacity-40',
      )}
      style={{ width: size, height: size }}
      initial={rolling ? { rotate: -180, scale: 0.6, y: 40, opacity: 0 } : false}
      animate={
        landed
          ? { rotate: 0, scale: [1, 1.08, 1], y: 0, opacity: 1 }
          : { rotate: 0, scale: 1, y: 0, opacity: 1 }
      }
      transition={
        landed
          ? { scale: { duration: 0.18, ease: [0.34, 1.56, 0.64, 1] }, default: SPRING }
          : SPRING
      }
      aria-hidden
    >
      <svg viewBox="0 0 40 40" className="absolute inset-0 size-full">
        <path
          d={shapeFor(sides)}
          strokeWidth="1.6"
          strokeLinejoin="round"
          className={cn(
            tone === 'gold'
              ? 'fill-gold-soft stroke-gold-line'
              : tone === 'red'
                ? 'fill-hp-soft stroke-hp'
                : tone === 'player'
                  ? 'fill-player-soft stroke-player'
                  : 'fill-surface-raised stroke-gold-line',
          )}
        />
      </svg>
      <span
        className={cn(
          'tabular relative font-display font-bold',
          tone === 'gold'
            ? 'text-gold-text'
            : tone === 'red'
              ? 'text-hp-text'
              : tone === 'player'
                ? 'text-player-text'
                : 'text-ink',
          sides === 4 && 'mt-2',
          !kept && 'line-through',
        )}
        style={{ fontSize: size * (String(display).length > 2 ? 0.3 : 0.38) }}
      >
        {display}
      </span>
    </motion.span>
  )
}

/**
 * Critical success (DA §7.3): 12 four-pointed golden sparks fly out every
 * 30°, turning a quarter turn as they fade.
 */
export function GoldBurst({ reach = 1 }: { reach?: number }) {
  const sparks = Array.from({ length: 12 }, (_, i) => {
    const angle = (i * Math.PI) / 6
    const distance = (40 + (i % 3) * 18) * reach
    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      size: 7 + (i % 4) * 3,
      delay: i * 0.02,
    }
  })
  return (
    <span
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
      aria-hidden
    >
      {sparks.map((p, i) => (
        <motion.span
          key={i}
          className="absolute bg-gold [clip-path:polygon(50%_0,62%_38%,100%_50%,62%_62%,50%_100%,38%_62%,0_50%,38%_38%)]"
          style={{ width: p.size, height: p.size }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{ x: p.x, y: p.y, opacity: 0, rotate: 90 }}
          transition={{ duration: 0.9, delay: p.delay, ease: [0.22, 1, 0.36, 1] }}
        />
      ))}
    </span>
  )
}
