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
        <ul className="flex gap-1 overflow-x-auto p-2 md:flex-col md:overflow-visible md:p-3">
          {PREP_SECTIONS.map((id) => {
            const Icon = SECTION_ICONS[id]
            return (
              <li key={id}>
                <NavLink
                  to={`/c/${campaign.id}/prep/${id}`}
                  className={({ isActive }) =>
                    cn(
                      'flex h-9 items-center gap-2.5 rounded-md px-3 text-sm whitespace-nowrap transition-colors duration-150',
                      isActive
                        ? 'bg-accent-soft font-medium text-accent-text'
                        : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
                    )
                  }
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
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
