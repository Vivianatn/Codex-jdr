import { lazy, Suspense } from 'react'
import { PageTransition } from '@/features/shell/PageTransition'
import { useT } from '@/i18n'
import { GroupsPanel } from './GroupsPanel'
import { PlaySheetDrawer } from './PlaySheetDrawer'
import { QuickPanel } from './QuickPanel'
import { TurnBanner } from './TurnBanner'

// Konva is heavy: the map loads with the play screen only.
const PlayMap = lazy(() => import('@/features/maps/PlayMap').then((m) => ({ default: m.PlayMap })))

/**
 * "En jeu" mode: the turn banner on top (D-226), the map, and the groups in
 * the sidebar. Sheets and the quick panel slide over the map.
 */
export function PlayLayout() {
  const t = useT()

  return (
    <PageTransition className="flex-row">
      <div className="flex min-w-0 flex-1 flex-col">
        <TurnBanner />
        <main
          id="main"
          aria-label={t.play.mapRegion}
          className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden bg-surface-2"
        >
          <MapBackdrop />
          <Suspense fallback={null}>
            <PlayMap />
          </Suspense>
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
