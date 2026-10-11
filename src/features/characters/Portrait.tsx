import { cn } from '@/lib/cn'

const SIZES = {
  sm: 'size-10 text-sm',
  md: 'size-14 text-lg',
  lg: 'size-24 text-3xl',
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return (
    words.length > 1 ? words[0]![0]! + words[1]![0]! : (words[0] ?? '?').slice(0, 2)
  ).toUpperCase()
}

/** Round medallion with a fine gold ring; initials when there is no portrait. */
export function Portrait({
  src,
  name,
  size = 'md',
  className,
}: {
  src: string | null
  name: string
  size?: keyof typeof SIZES
  className?: string
}) {
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-soft font-display font-semibold text-accent-text ring-2 ring-gold/70 ring-offset-2 ring-offset-surface',
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
