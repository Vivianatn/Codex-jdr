import { cn } from '@/lib/cn'

export type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold'
export type Size = 'sm' | 'md' | 'lg' | 'xl'

/**
 * Button variants (D-250, « RPG classique »): bevelled like game-menu buttons.
 * Primary = crimson set in brass, secondary = leather, gold = treasure.
 * Pressing sinks the button (inner shadow) instead of lifting it.
 */
export const VARIANTS: Record<Variant, string> = {
  primary:
    'type-button border border-gold-line bg-crimson text-on-accent bevel [text-shadow:0_1px_0_var(--codex-bevel-lo)] hover:brightness-110 active:translate-y-px active:bevel-pressed disabled:hover:brightness-100',
  secondary:
    'border border-line-strong bg-leather text-ink bevel hover:border-gold-line active:translate-y-px active:bevel-pressed',
  ghost: 'text-accent-text hover:bg-accent-soft active:translate-y-px',
  danger:
    'type-button border border-gold-line bg-blood text-on-accent bevel [text-shadow:0_1px_0_var(--codex-bevel-lo)] hover:brightness-110 active:translate-y-px active:bevel-pressed',
  gold: 'type-button border border-gold-line bg-brass text-gold-text bevel hover:shadow-[0_0_0_3px_var(--codex-gold-glow)] active:translate-y-px active:bevel-pressed',
}

/** Heights 32 / 40 / 44 / 48 px; small, square-ish corners like a game menu. */
export const SIZES: Record<Size, string> = {
  sm: 'h-8 gap-2 rounded-sm px-2.5 text-[0.8125rem] [&_svg]:size-4',
  md: 'h-10 gap-2 rounded-md px-[18px] text-[0.9375rem] [&_svg]:size-[18px]',
  lg: 'h-11 gap-2 rounded-md px-5 text-[0.9375rem] [&_svg]:size-[18px]',
  xl: 'h-12 gap-2 rounded-md px-6 text-base [&_svg]:size-[18px]',
}

/** Button styling, also usable on links: `<Link className={buttonClasses('primary')}>`. */
export function buttonClasses(variant: Variant = 'secondary', size: Size = 'md'): string {
  return cn(
    'inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform,filter] duration-150 select-none disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none',
    VARIANTS[variant],
    SIZES[size],
  )
}
