import { cn } from '@/lib/cn'

export type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type Size = 'sm' | 'md' | 'lg'

export const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent text-accent-contrast shadow-soft hover:bg-accent-hover active:translate-y-px disabled:hover:bg-accent',
  secondary:
    'bg-surface text-ink border border-line hover:border-line-strong hover:bg-surface-2 active:translate-y-px',
  ghost: 'text-ink-muted hover:bg-surface-2 hover:text-ink',
  danger: 'bg-hp text-white shadow-soft hover:brightness-95 active:translate-y-px',
}

export const SIZES: Record<Size, string> = {
  sm: 'h-8 gap-1.5 rounded-sm px-3 text-sm',
  md: 'h-10 gap-2 rounded-md px-4 text-sm',
  lg: 'h-12 gap-2 rounded-md px-5 text-base',
}

/** Button styling, also usable on links: `<Link className={buttonClasses('primary')}>`. */
export function buttonClasses(variant: Variant = 'secondary', size: Size = 'md'): string {
  return cn(
    'inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-[background-color,border-color,color,transform,filter] duration-150 select-none disabled:cursor-not-allowed disabled:opacity-50',
    VARIANTS[variant],
    SIZES[size],
  )
}
