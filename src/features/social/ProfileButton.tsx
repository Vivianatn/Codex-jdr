import { UserRound } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Portrait } from '@/features/characters/Portrait'
import { useT } from '@/i18n'
import { useServerStore } from '@/online/server/serverStore'
import { usePendingAdventurers } from './socialState'

/** Top bar: the way to one's profile, as its picture and name (D-267). */
export function ProfileButton() {
  const t = useT()
  const user = useServerStore((s) => s.user)
  const avatar = useServerStore((s) => s.profile?.avatar ?? null)
  const pending = usePendingAdventurers()
  if (!user) return null
  return (
    <Link
      to="/profil"
      className="relative inline-flex h-10 max-w-48 items-center gap-2 rounded-full py-1 pr-1 pl-1 text-sm font-medium text-ink transition-colors hover:bg-surface-2 sm:pr-3"
      aria-label={t.adventurers.openProfile(user.displayName)}
      data-testid="profile-button"
    >
      <Portrait src={avatar} name={user.displayName} size="sm" className="size-8 text-xs" />
      <span className="hidden truncate sm:inline">{user.displayName}</span>
      {pending > 0 && (
        <span
          className="absolute -top-0.5 left-6 rounded-full bg-accent px-1.5 text-xs text-on-accent tabular-nums"
          title={t.adventurers.pendingBadge(pending)}
        >
          {pending}
        </span>
      )}
    </Link>
  )
}

/** Settings: the profile now holds the account, its picture and the adventurers (D-267). */
export function ProfileShortcut({ onOpen }: { onOpen: () => void }) {
  const t = useT()
  const navigate = useNavigate()
  const user = useServerStore((s) => s.user)
  if (!user) return null
  return (
    <section className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-ink-muted">{t.adventurers.settingsHint}</p>
      <Button
        size="sm"
        icon={<UserRound />}
        onClick={() => {
          onOpen()
          navigate('/profil')
        }}
      >
        {t.adventurers.myProfile}
      </Button>
    </section>
  )
}
