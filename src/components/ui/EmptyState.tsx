import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface EmptyStateProps {
  /** Small icon, used when there is no illustration (compact places). */
  icon?: ReactNode
  /** 280 × 200 line drawing (DA §11.3). */
  illustration?: ReactNode
  eyebrow?: string
  title: string
  body: ReactNode
  actions?: ReactNode
  className?: string
}

/**
 * Illustrated, actionable empty state (DA §8.13): illustration, gold eyebrow,
 * Alegreya title, two sentences at most, then the actions.
 */
export function EmptyState({
  icon,
  illustration,
  eyebrow,
  title,
  body,
  actions,
  className,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'mx-auto flex max-w-[520px] flex-col items-center gap-[18px] px-6 py-10 text-center',
        className,
      )}
    >
      {illustration ? (
        <div className="w-full max-w-[280px]">{illustration}</div>
      ) : (
        icon && (
          <div
            className="flex size-16 items-center justify-center rounded-full border border-line bg-surface text-accent-text shadow-soft [&>svg]:size-7"
            aria-hidden
          >
            {icon}
          </div>
        )
      )}
      <div className="space-y-2">
        {eyebrow && <p className="type-eyebrow">{eyebrow}</p>}
        <h2
          className={cn(
            'font-title leading-tight font-semibold text-ink',
            illustration ? 'text-[1.875rem]' : 'text-[1.375rem]',
          )}
        >
          {title}
        </h2>
        <p className="text-base leading-relaxed text-ink-muted">{body}</p>
      </div>
      {actions && <div className="flex flex-wrap justify-center gap-2">{actions}</div>}
    </motion.div>
  )
}
