import { useEffect } from 'react'
import { Navigate, NavLink, Outlet, useParams } from 'react-router'
import { useCampaign } from '@/features/shell/campaignContext'
import { useT } from '@/i18n'
import { cn } from '@/lib/cn'
import { SECTION_ICONS, sectionLabel } from './sections'
import { isPrepSection, PREP_SECTIONS, useUiStore } from '@/stores/uiStore'

export function PrepLayout() {
  const t = useT()
  const campaign = useCampaign()
  const { section } = useParams()
  const remember = useUiStore((s) => s.rememberPrepSection)

  useEffect(() => {
    if (isPrepSection(section)) remember(campaign.id, section)
  }, [campaign.id, section, remember])

  if (!isPrepSection(section)) return <Navigate to={`/c/${campaign.id}/prep/dashboard`} replace />

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <nav
        aria-label={t.nav.prepSections}
        className="shrink-0 border-b border-line md:w-60 md:border-r md:border-b-0"
      >
        {/* Narrow screens: every section in view, on several lines — never a sideways scroll. */}
        <ul className="flex flex-wrap gap-1 p-2 md:flex-col md:flex-nowrap md:p-3">
          {PREP_SECTIONS.map((id) => {
            const Icon = SECTION_ICONS[id]
            return (
              <li key={id}>
                <NavLink
                  to={`/c/${campaign.id}/prep/${id}`}
                  className={({ isActive }) =>
                    cn(
                      'relative flex h-8 items-center gap-2 rounded-md border px-2.5 text-[0.8125rem] whitespace-nowrap transition-colors duration-150 md:h-9 md:gap-2.5 md:px-3 md:text-sm',
                      isActive
                        ? 'border-gold-line bg-leather font-semibold text-ink bevel before:absolute before:inset-y-1.5 before:-left-px before:w-[3px] before:rounded-r-sm before:bg-accent before:content-[""] [&>svg]:text-accent-text'
                        : 'border-transparent text-ink-muted hover:bg-surface-2 hover:text-ink',
                    )
                  }
                >
                  <Icon className="size-5 shrink-0" aria-hidden />
                  {sectionLabel(t, id)}
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>
      <main id="main" className="min-h-0 flex-1 overflow-y-auto">
        <Outlet context={{ campaign }} />
      </main>
    </div>
  )
}
