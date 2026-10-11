import { cn } from '@/lib/cn'

/** The Codex monogram (DA §6.4): a bound codex with a diamond, in gold line. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('size-6 text-gold-line', className)}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    >
      <path d="M5 3h11l3 3v15H5z" />
      <path d="M12 8l2 3-2 3-2-3z" />
      <path d="M8 18h8" />
    </svg>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'font-display text-lg font-bold tracking-[0.12em] text-ink uppercase',
        className,
      )}
    >
      Codex
    </span>
  )
}

/**
 * Diamond rule (DA §6.1): one per screen at most, under the campaigns title
 * and the pause title; never between cards, in a list or during play.
 */
export function Ornament({
  width = 160,
  height = 16,
  stroke = 1,
  className,
}: {
  width?: number
  height?: number
  stroke?: number
  className?: string
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 160 16"
      className={cn('text-gold-line', className)}
      aria-hidden
      fill="none"
      stroke="currentColor"
    >
      <line x1="0" y1="8" x2="70" y2="8" strokeWidth={stroke} />
      <path d="M80 2 L86 8 L80 14 L74 8 Z" strokeWidth={stroke * 1.25} />
      <circle cx="80" cy="8" r="1.6" fill="currentColor" stroke="none" />
      <line x1="90" y1="8" x2="160" y2="8" strokeWidth={stroke} />
    </svg>
  )
}

/** Illuminated corner (DA §6.2): two per element, top corners; mirror the right one. */
export function CornerOrnament({
  mirrored = false,
  className,
}: {
  mirrored?: boolean
  className?: string
}) {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      className={cn('pointer-events-none text-gold-line', mirrored && '-scale-x-100', className)}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
    >
      <path d="M2 26V8a6 6 0 0 1 6-6h18" />
      <path d="M6 26V12a6 6 0 0 1 6-6h14" opacity="0.5" />
      <circle cx="2" cy="2" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Candle (DA §6.3): the emblem of the pause screen and of empty beginnings. */
export function CandleOrnament({ className, base = true }: { className?: string; base?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 36"
      className={cn('text-gold-line', className)}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d="M12 2c2 3.5 4 5.5 4 9a4 4 0 0 1-8 0c0-3.5 2-5.5 4-9z"
        fill="currentColor"
        fillOpacity="0.18"
      />
      <path
        d="M12 9c.8 1.5 1.5 2.5 1.5 3.8a1.5 1.5 0 0 1-3 0c0-1.3.7-2.3 1.5-3.8z"
        fill="currentColor"
      />
      {base && <path d="M9 17h6v15H9zM6 34h12" />}
    </svg>
  )
}
