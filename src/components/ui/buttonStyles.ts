import { cn } from '@/lib/cn'

export type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold'
export type Size = 'sm' | 'md' | 'lg' | 'xl'

/** Button variants (DA §8.1). */
export const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent text-on-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_2px_6px_rgb(70_50_170/0.30)] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_2px_8px_rgb(0_0_0/0.40)] hover:bg-accent-hover active:bg-accent-active active:translate-y-px disabled:hover:bg-accent',
  secondary:
    'border border-line-strong bg-surface text-ink hover:bg-surface-2 active:translate-y-px active:border-ink-muted active:bg-surface-2',
  ghost: 'text-accent-text hover:bg-accent-soft active:translate-y-px',
  danger: 'bg-danger text-on-accent hover:bg-danger-hover active:translate-y-px',
  gold: 'border border-gold-line bg-gold-soft text-gold-text hover:shadow-[0_0_0_3px_var(--codex-gold-glow)] active:translate-y-px',
}

/** Heights 32 / 40 / 44 / 48 px; radius grows with the height (DA §5.2). */
export const SIZES: Record<Size, string> = {
  sm: 'h-8 gap-2 rounded-lg px-2.5 text-[0.8125rem] [&_svg]:size-4',
  md: 'h-10 gap-2 rounded-[10px] px-[18px] text-[0.9375rem] [&_svg]:size-[18px]',
  lg: 'h-11 gap-2 rounded-xl px-5 text-[0.9375rem] [&_svg]:size-[18px]',
  xl: 'h-12 gap-2 rounded-xl px-6 text-base [&_svg]:size-[18px]',
}

/** Button styling, also usable on links: `<Link className={buttonClasses('primary')}>`. */
export function buttonClasses(variant: Variant = 'secondary', size: Size = 'md'): string {
  return cn(
    'inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform] duration-150 select-none disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none',
    VARIANTS[variant],
    SIZES[size],
  )
}
