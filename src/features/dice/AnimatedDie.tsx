import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'

const ROLL_MS = 650

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
  onLanded,
}: {
  value: number
  sides: number
  kept?: boolean
  rolling?: boolean
  tone?: 'default' | 'gold' | 'red'
  size?: number
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
    }, ROLL_MS)
    return () => {
      clearInterval(tick)
      clearTimeout(stop)
    }
    // Runs once per roll; `onLanded` is a callback that may change identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolling, sides, value])

  const display = landed || !rolling ? value : shown
  return (
    <motion.span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center',
        !kept && 'opacity-40',
      )}
      style={{ width: size, height: size }}
      initial={rolling ? { rotate: -200, scale: 0.6, y: -12 } : false}
      animate={landed ? { rotate: 0, scale: 1, y: 0 } : { rotate: 180, scale: 0.9, y: -6 }}
      transition={
        landed
          ? { type: 'spring', stiffness: 420, damping: 14 }
          : { duration: ROLL_MS / 1000, ease: 'linear' }
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
              ? 'fill-gold-soft stroke-gold'
              : tone === 'red'
                ? 'fill-hp/10 stroke-hp'
                : 'fill-surface stroke-accent',
          )}
        />
      </svg>
      <span
        className={cn(
          'tabular relative font-display font-semibold text-ink',
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

/** Burst of golden particles for a critical success (SPEC §7). */
export function GoldBurst() {
  const particles = Array.from({ length: 14 }, (_, i) => {
    const angle = (i / 14) * Math.PI * 2
    const distance = 38 + (i % 3) * 14
    return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance, delay: (i % 4) * 0.02 }
  })
  return (
    <span
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
      aria-hidden
    >
      {particles.map((p, i) => (
        <motion.span
          key={i}
          className="absolute size-1.5 rounded-full bg-gold shadow-[0_0_6px_var(--codex-gold)]"
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.4 }}
          transition={{ duration: 0.8, delay: p.delay, ease: 'easeOut' }}
        />
      ))}
    </span>
  )
}
