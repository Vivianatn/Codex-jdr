import { cn } from '@/lib/cn'

const SIZES = {
  sm: 'size-10 text-[1rem]',
  md: 'size-16 text-[1.6rem]',
  lg: 'size-[132px] text-[3.3rem]',
}

/** Gold liseré (DA §8.18): double ring on the sheet, single ring elsewhere. */
const RINGS = {
  sm: 'shadow-[0_0_0_2px_var(--codex-surface),0_0_0_3px_var(--codex-gold-line)]',
  md: 'shadow-[0_0_0_2px_var(--codex-surface),0_0_0_3px_var(--codex-gold-line)]',
  lg: 'shadow-[0_0_0_4px_var(--codex-surface),0_0_0_5px_var(--codex-gold-line),0_0_0_10px_var(--codex-surface),0_0_0_11px_var(--codex-gold-line)]',
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return (
    words.length > 1 ? words[0]![0]! + words[1]![0]! : (words[0] ?? '?').slice(0, 2)
  ).toUpperCase()
}

/**
 * Portrait medallion: round with a fine gold ring, a rounded square for
 * enemies (shape, not only colour, tells them apart); initials when there
 * is no picture.
 */
export function Portrait({
  src,
  name,
  size = 'md',
  square = false,
  className,
}: {
  src: string | null
  name: string
  size?: keyof typeof SIZES
  /** Enemies: rounded square with an HP-red liseré. */
  square?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-accent-soft font-sans font-bold text-accent-text',
        square
          ? 'rounded-[25%] shadow-[0_0_0_2px_var(--codex-surface),0_0_0_3px_var(--codex-token-foe)]'
          : cn('rounded-full', RINGS[size]),
        SIZES[size],
        className,
      )}
      aria-hidden
    >
      {src ? (
        <img src={src} alt="" className="size-full object-cover" draggable={false} />
      ) : (
        initials(name)
      )}
    </span>
  )
}
