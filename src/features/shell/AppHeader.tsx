import type { ReactNode } from 'react'
import { LockKeyhole } from 'lucide-react'
import { IconButton } from '@/components/ui/Button'
import { SettingsButton, ThemeToggle } from '@/features/settings/SettingsDialog'
import { AlphaBadge } from '@/features/legal/AlphaBadge'
import { ProfileButton } from '@/features/social/ProfileButton'
import { useT } from '@/i18n'
import { lockSession } from '@/security/session'
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
        // Phones: the mode switch takes its own line instead of pushing the page sideways.
        'glass sticky top-0 z-30 flex min-h-14 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-3 py-2 sm:h-14 sm:flex-nowrap sm:px-4 sm:py-0',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {start}
        <AlphaBadge />
      </div>
      {center && (
        <div className="order-last flex basis-full justify-center sm:order-none sm:shrink-0 sm:basis-auto">
          {center}
        </div>
      )}
      <div className="flex shrink-0 items-center justify-end gap-0.5 sm:flex-1 sm:gap-1">
        {end}
        <ProfileButton />
        <LockButton />
        {/* Also in the settings: left out on phones to keep the header on one line. */}
        <span className="hidden sm:contents">
          <ThemeToggle />
        </span>
        <SettingsButton />
      </div>
    </header>
  )
}

function LockButton() {
  const t = useT()
  return (
    <IconButton
      label={t.account.lock}
      icon={<LockKeyhole />}
      onClick={() => void lockSession()}
      data-testid="lock-button"
    />
  )
}
