import { Eye } from 'lucide-react'
import { lazy, Suspense } from 'react'
import { useSurface } from '@/app/useSurface'
import { PageTransition } from '@/features/shell/PageTransition'
import { SessionMenu } from '@/features/sessions/SessionMenu'
import { StartPlayPanel } from '@/features/sessions/StartPlayPanel'
import { useT } from '@/i18n'
import { useOnlineStore } from '@/online/onlineStore'
import { useCampaignStore } from '@/stores/campaignStore'
import { GroupsPanel } from './GroupsPanel'
import { PlaySheetDrawer } from './PlaySheetDrawer'
import { QuickPanel } from './QuickPanel'
import { TurnBanner } from './TurnBanner'

// Konva is heavy: the map loads with the play screen only.
const PlayMap = lazy(() => import('@/features/maps/PlayMap').then((m) => ({ default: m.PlayMap })))

/**
 * "En jeu" mode: the turn bar on top (D-226), then the board on the whole
 * screen; groups, tools, sheets and the quick panel float over it (DA §10.6).
 */
export function PlayLayout() {
  const t = useT()
  useSurface('play')
  const live = useCampaignStore((s) => s.play.live)
  const selfId = useOnlineStore((s) => s.selfId)

  // Play starts by hand (D-244).
  if (!live)
    return (
      <PageTransition className="flex-col">
        <StartPlayPanel />
      </PageTransition>
    )

  // Only the operator acts; other editors watch the same table (D-244).
  const operating = live.operator.id === selfId
  return (
    <PageTransition className="flex-col">
      {!operating && (
        <div
          role="status"
          className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-accent-soft px-4 py-2 text-sm text-accent-text"
          data-testid="spectator-bar"
        >
          <span className="flex items-center gap-2">
            <Eye className="size-4" aria-hidden />
            {t.sessions.spectating(live.operator.name)}
          </span>
          <SessionMenu />
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col" {...(operating ? {} : { inert: '' })}>
        <PlayTable />
      </div>
    </PageTransition>
  )
}

function PlayTable() {
  const t = useT()
  return (
    <>
      <TurnBanner />
      <main
        id="main"
        aria-label={t.play.mapRegion}
        className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden bg-bg"
      >
        <MapBackdrop />
        <Suspense fallback={null}>
          <PlayMap />
        </Suspense>
        {/* The board is the hero: the groups float over it in glass (DA §10.6). */}
        <aside
          aria-label={t.play.quickAccess}
          className="codex-glass absolute top-4 bottom-4 left-4 z-10 hidden w-64 flex-col overflow-y-auto p-3.5 lg:flex"
        >
          <GroupsPanel />
        </aside>
      </main>
      <PlaySheetDrawer />
      <QuickPanel />
    </>
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
