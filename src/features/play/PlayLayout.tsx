import { Map } from 'lucide-react'
import { Link } from 'react-router'
import { buttonClasses } from '@/components/ui/buttonStyles'
import { EmptyState } from '@/components/ui/EmptyState'
import { useCampaign } from '@/features/shell/campaignContext'
import { PageTransition } from '@/features/shell/PageTransition'
import { useT } from '@/i18n'
import { GroupsPanel } from './GroupsPanel'
import { PlaySheetDrawer } from './PlaySheetDrawer'
import { QuickPanel } from './QuickPanel'
import { TurnBanner } from './TurnBanner'

/**
 * "En jeu" mode: the turn banner on top (D-226), the map, and the groups in
 * the sidebar. Sheets and the quick panel slide over the map.
 */
export function PlayLayout() {
  const t = useT()
  const campaign = useCampaign()

  return (
    <PageTransition className="flex-row">
      <div className="flex min-w-0 flex-1 flex-col">
        <TurnBanner />
        <main
          id="main"
          aria-label={t.play.mapRegion}
          className="relative flex min-w-0 flex-1 items-center justify-center overflow-hidden bg-surface-2"
        >
          <MapBackdrop />
          <div className="glass relative rounded-lg border border-line shadow-lifted">
            <EmptyState
              icon={<Map />}
              title={t.play.noMapTitle}
              body={t.play.noMapBody}
              actions={
                <Link to={`/c/${campaign.id}/prep/maps`} className={buttonClasses('secondary')}>
                  {t.play.goToMaps}
                </Link>
              }
            />
          </div>
        </main>
      </div>

      <aside
        aria-label={t.play.quickAccess}
        className="hidden w-80 shrink-0 flex-col overflow-y-auto border-l border-line bg-bg p-4 lg:flex"
      >
        <GroupsPanel />
      </aside>
      <PlaySheetDrawer />
      <QuickPanel />
    </PageTransition>
  )
}

/** Subtle square grid hinting at the future battle map. */
function MapBackdrop() {
  return (
    <svg className="absolute inset-0 size-full text-line-strong/60" aria-hidden>
      <defs>
        <pattern id="codex-grid" width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M48 0H0V48" fill="none" stroke="currentColor" strokeWidth="1" />
        </pattern>
        <radialGradient id="codex-vignette">
          <stop offset="40%" stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <mask id="codex-mask">
          <rect width="100%" height="100%" fill="url(#codex-vignette)" />
        </mask>
      </defs>
      <rect width="100%" height="100%" fill="url(#codex-grid)" mask="url(#codex-mask)" />
    </svg>
  )
}
