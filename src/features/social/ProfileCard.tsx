import type { ReactNode } from 'react'
import { Portrait } from '@/features/characters/Portrait'
import { useIntlLocale, useT } from '@/i18n'
import { cn } from '@/lib/cn'
import type { AdventurerProfile } from '@shared/sync'

/** The banner, or a warm wash of the theme when there is none. */
export function ProfileBanner({ src, className }: { src: string | null; className?: string }) {
  return (
    <div
      className={cn(
        'overflow-hidden bg-[linear-gradient(135deg,var(--codex-accent-soft),var(--codex-gold-soft))]',
        className,
      )}
    >
      {src && <img src={src} alt="" className="size-full object-cover" draggable={false} />}
    </div>
  )
}

/** Banner, picture, name, motto and a few facts; `actions` sit next to the name (D-267). */
export function ProfileCard({
  profile,
  actions,
}: {
  profile: AdventurerProfile
  actions?: ReactNode
}) {
  const t = useT()
  const locale = useIntlLocale()
  const since = new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(profile.since)
  return (
    <section
      className="overflow-hidden rounded-xl border border-line bg-surface shadow-soft"
      aria-label={t.adventurers.profileTitle}
      data-testid="profile-card"
    >
      <ProfileBanner src={profile.banner} className="h-32 sm:h-48" />
      <div className="px-5 pb-6 sm:px-8">
        <div className="-mt-12 flex flex-wrap items-end justify-between gap-3 sm:-mt-16">
          <Portrait
            src={profile.avatar}
            name={profile.displayName}
            size="lg"
            className="size-24 text-[2.4rem] sm:size-[132px] sm:text-[3.3rem]"
          />
          {actions && <div className="flex flex-wrap items-center gap-2 pb-1">{actions}</div>}
        </div>
        <h1 className="mt-4 type-screen-title break-words text-ink">{profile.displayName}</h1>
        <p className={cn('mt-2 max-w-prose', profile.bio ? 'text-ink' : 'text-ink-muted italic')}>
          {profile.bio || t.adventurers.noBio}
        </p>
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
          <span>{t.adventurers.since(since)}</span>
          <span>{t.adventurers.friendCount(profile.friendCount)}</span>
        </p>
        {profile.together.length > 0 && (
          <p className="mt-1 text-sm text-ink-muted">
            {t.adventurers.together(profile.together.join(', '))}
          </p>
        )}
      </div>
    </section>
  )
}
