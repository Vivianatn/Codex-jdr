import * as RadixDialog from '@radix-ui/react-dialog'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useT } from '@/i18n'
import { cn } from '@/lib/cn'

export interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  className?: string
}

/**
 * Modal dialog. Reserved for preparation tasks and destructive confirmations:
 * during play, prefer drawers and toasts (no blocking modals).
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: DialogProps) {
  const t = useT()
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay asChild>
          <motion.div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
          />
        </RadixDialog.Overlay>
        {/* Without a description, Radix needs an explicit undefined to skip the aria link. */}
        <RadixDialog.Content asChild {...(description ? {} : { 'aria-describedby': undefined })}>
          <motion.div
            className={cn(
              'fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-md rounded-lg border border-line bg-surface p-6 shadow-overlay',
              className,
            )}
            initial={{ opacity: 0, x: '-50%', y: 'calc(-50% + 8px)', scale: 0.98 }}
            animate={{ opacity: 1, x: '-50%', y: '-50%', scale: 1 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <RadixDialog.Title className="font-display text-xl font-semibold text-ink">
                  {title}
                </RadixDialog.Title>
                {description && (
                  <RadixDialog.Description className="mt-1 text-sm text-ink-muted">
                    {description}
                  </RadixDialog.Description>
                )}
              </div>
              <RadixDialog.Close
                aria-label={t.common.close}
                className="-mt-1 -mr-2 inline-flex size-8 items-center justify-center rounded-sm text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <X className="size-4" />
              </RadixDialog.Close>
            </div>
            {children}
            {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
          </motion.div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
