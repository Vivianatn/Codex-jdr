import * as Tooltip from '@radix-ui/react-tooltip'
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { buttonClasses, VARIANTS, type Size, type Variant } from './buttonStyles'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, className, children, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(buttonClasses(variant, size), className)}
      {...props}
    >
      {icon && <span className="-ml-0.5 inline-flex">{icon}</span>}
      {children}
    </button>
  )
})

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Accessible name, also shown as a tooltip. */
  label: string
  icon: ReactNode
  size?: Size
  /** ghost: plain icon; secondary: framed (DA §8.1, « Icône »). */
  variant?: 'ghost' | 'secondary' | 'primary'
}

const ICON_SIZES: Record<Size, string> = {
  sm: 'size-8 rounded-lg [&_svg]:size-4',
  md: 'size-10 rounded-[10px] [&_svg]:size-5',
  lg: 'size-11 rounded-xl [&_svg]:size-5',
  xl: 'size-12 rounded-xl [&_svg]:size-5',
}

const ICON_VARIANTS: Record<NonNullable<IconButtonProps['variant']>, string> = {
  ghost:
    'text-ink-muted hover:bg-surface-2 hover:text-ink aria-pressed:bg-accent-soft aria-pressed:text-accent-text',
  secondary:
    'border border-line-strong bg-surface text-ink hover:bg-surface-2 aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-accent-text',
  primary: VARIANTS.primary,
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, size = 'md', variant = 'ghost', className, type = 'button', ...props },
  ref,
) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          ref={ref}
          type={type}
          aria-label={label}
          className={cn(
            'inline-flex shrink-0 items-center justify-center transition-colors duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55',
            ICON_VARIANTS[variant],
            ICON_SIZES[size],
            className,
          )}
          {...props}
        >
          {icon}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          sideOffset={6}
          className="z-50 max-w-[260px] rounded-lg bg-ink px-2 py-1.5 text-xs font-medium text-bg shadow-lifted"
        >
          {label}
          <Tooltip.Arrow width={8} height={4} className="fill-ink" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
})
