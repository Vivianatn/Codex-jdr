import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface EmptyStateProps {
  icon: ReactNode
  title: string
  body: ReactNode
  actions?: ReactNode
  className?: string
}

/** Illustrated, actionable empty state: always tells the GM what to do next. */
export function EmptyState({ icon, title, body, actions, className }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'mx-auto flex max-w-md flex-col items-center px-6 py-12 text-center',
        className,
      )}
    >
      <div className="relative mb-5">
        <div className="absolute inset-0 -m-3 rounded-full bg-accent-soft blur-md" aria-hidden />
        <div
          className="relative flex size-16 items-center justify-center rounded-full border border-line bg-surface text-accent-text shadow-soft [&>svg]:size-7"
          aria-hidden
        >
          {icon}
        </div>
      </div>
      <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
      {actions && <div className="mt-6 flex flex-wrap justify-center gap-2">{actions}</div>}
    </motion.div>
  )
}
