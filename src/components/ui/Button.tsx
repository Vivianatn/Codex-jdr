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
      {icon && <span className="-ml-0.5 inline-flex [&>svg]:size-4">{icon}</span>}
      {children}
    </button>
  )
})

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Accessible name, also shown as a tooltip. */
  label: string
  icon: ReactNode
  size?: Size
  variant?: Exclude<Variant, 'danger'>
}

const ICON_SIZES: Record<Size, string> = {
  sm: 'size-8 rounded-sm [&_svg]:size-4',
  md: 'size-10 rounded-md [&_svg]:size-[18px]',
  lg: 'size-12 rounded-md [&_svg]:size-5',
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
            'inline-flex shrink-0 items-center justify-center transition-colors duration-150 disabled:opacity-50',
            VARIANTS[variant],
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
          className="z-50 rounded-sm bg-ink px-2 py-1 text-xs font-medium text-bg shadow-overlay"
        >
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
})
