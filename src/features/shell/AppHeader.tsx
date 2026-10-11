import type { ReactNode } from 'react'
import { SettingsButton, ThemeToggle } from '@/features/settings/SettingsDialog'
import { cn } from '@/lib/cn'

export function AppHeader({
  start,
  center,
  end,
  className,
}: {
  start: ReactNode
  center?: ReactNode
  end?: ReactNode
  className?: string
}) {
  return (
    <header
      className={cn(
        'glass sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-line px-3 sm:px-4',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">{start}</div>
      {center && <div className="flex shrink-0 justify-center">{center}</div>}
      <div className="flex flex-1 items-center justify-end gap-1">
        {end}
        <ThemeToggle />
        <SettingsButton />
      </div>
    </header>
  )
}
