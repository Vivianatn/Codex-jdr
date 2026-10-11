import { cn } from '@/lib/cn'

const STAT_COLORS = [
  'bg-stat-strength',
  'bg-stat-constitution',
  'bg-stat-dexterity',
  'bg-stat-intelligence',
  'bg-stat-charisma',
  'bg-stat-wisdom',
  'bg-stat-luck',
]

/** The Codex sigil: an open book framed by a fine diamond. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-8', className)} aria-hidden fill="none">
      <rect
        x="16"
        y="1.5"
        width="20.5"
        height="20.5"
        rx="4"
        transform="rotate(45 16 1.5)"
        className="fill-accent-soft stroke-accent"
        strokeWidth="1.2"
      />
      <path
        d="M16 11.5c-2-1.4-4.6-1.9-7-1.5v11c2.4-.4 5 .1 7 1.5 2-1.4 4.6-1.9 7-1.5V10c-2.4-.4-5 .1-7 1.5Z"
        className="fill-surface stroke-accent"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M16 11.5v11" className="stroke-accent" strokeWidth="1.4" />
      <circle cx="16" cy="6.5" r="1.3" className="fill-gold" />
    </svg>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn('font-display text-lg font-semibold tracking-[0.12em] text-ink', className)}
    >
      Codex
    </span>
  )
}

/**
 * Fine fantasy ornament: a hairline with a central diamond.
 * The `stats` variant replaces the diamond with the seven characteristic colours.
 */
export function Ornament({
  variant = 'diamond',
  className,
}: {
  variant?: 'diamond' | 'stats'
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-3', className)} aria-hidden>
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-line-strong" />
      {variant === 'diamond' ? (
        <span className="size-1.5 rotate-45 bg-gold" />
      ) : (
        <span className="flex gap-1.5">
          {STAT_COLORS.map((color) => (
            <span key={color} className={cn('size-1.5 rounded-full', color)} />
          ))}
        </span>
      )}
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-line-strong" />
    </div>
  )
}
