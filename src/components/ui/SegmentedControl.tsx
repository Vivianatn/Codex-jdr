import * as ToggleGroup from '@radix-ui/react-toggle-group'
import { motion } from 'framer-motion'
import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface SegmentedOption<V extends string> {
  value: V
  label: string
  icon?: ReactNode
}

export interface SegmentedControlProps<V extends string> {
  value: V
  onValueChange: (value: V) => void
  options: SegmentedOption<V>[]
  /** Accessible name of the group. */
  label: string
  size?: 'sm' | 'md'
  className?: string
}

/** Single-choice toggle that can never be left empty, with a sliding highlight. */
export function SegmentedControl<V extends string>({
  value,
  onValueChange,
  options,
  label,
  size = 'md',
  className,
}: SegmentedControlProps<V>) {
  const highlightId = useId()
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(next) => next && onValueChange(next as V)}
      aria-label={label}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md border border-line-strong bg-surface-sunken p-[3px] shadow-[inset_0_1px_3px_var(--codex-bevel-lo)]',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <ToggleGroup.Item
            key={option.value}
            value={option.value}
            className={cn(
              'relative inline-flex items-center gap-1.5 rounded-sm transition-colors duration-150',
              size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3.5 text-[0.8125rem]',
              active ? 'font-semibold text-ink' : 'font-medium text-ink-muted hover:text-ink',
            )}
          >
            {active && (
              <motion.span
                layoutId={highlightId}
                className="absolute inset-0 rounded-sm border border-gold-line bg-leather bevel"
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                aria-hidden
              />
            )}
            {option.icon && <span className="relative [&>svg]:size-4">{option.icon}</span>}
            <span className="relative">{option.label}</span>
          </ToggleGroup.Item>
        )
      })}
    </ToggleGroup.Root>
  )
}
