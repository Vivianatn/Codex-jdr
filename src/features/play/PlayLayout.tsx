import { Eye, PanelLeftClose } from 'lucide-react'
import { lazy, Suspense, useMemo, useState } from 'react'
import { useMediaQuery } from '@/app/useMediaQuery'
import { useSurface } from '@/app/useSurface'
import { GameIcon } from '@/components/GameIcon'
import { IconButton } from '@/components/ui/Button'
import { PageTransition } from '@/features/shell/PageTransition'
import { SessionMenu } from '@/features/sessions/SessionMenu'
import { StartPlayPanel } from '@/features/sessions/StartPlayPanel'
import { PlayDiceStage } from '@/features/dice/DiceStage'
import { useT } from '@/i18n'
import { useOnlineStore } from '@/online/onlineStore'
import { useCampaignStore } from '@/stores/campaignStore'
import { useUiStore } from '@/stores/uiStore'
import { BoardSlotsContext } from './boardSlots'
import { GameMoments } from './GameMoments'
import { GroupsPanel } from './GroupsPanel'
import { GmPartyStrip } from './PartyStrip'
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
      {/* Outside the inert table: spectators hear the announcements too (D-268). */}
      <PlayDiceStage />
    </PageTransition>
  )
}

/**
 * The table (D-272): the board fills everything under the turn bar; the turns
 * rail (left), the party strip and map controls (top), the tools (bottom) and
 * the quick panel (right) are laid out side by side over it, so no panel ever
 * covers another and the centre of the board stays free.
 */
function PlayTable() {
  const t = useT()
  const [top, setTop] = useState<HTMLElement | null>(null)
  const [bottom, setBottom] = useState<HTMLElement | null>(null)
  const slots = useMemo(() => ({ top, bottom }), [top, bottom])
  // Below lg the rail covers the board: it opens on demand there, and is remembered on wide screens.
  const narrow = useMediaQuery('(max-width: 1023.98px)')
  const railWide = useUiStore((s) => s.play.rail)
  const setPanels = useUiStore((s) => s.setPlayPanels)
  const [railNarrow, setRailNarrow] = useState(false)
  const railOpen = narrow ? railNarrow : railWide
  const setRail = (open: boolean) => (narrow ? setRailNarrow(open) : setPanels({ rail: open }))

  return (
    <>
      <TurnBanner />
      <main
        id="main"
        aria-label={t.play.mapRegion}
        className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden bg-bg"
      >
        <MapBackdrop />
        <BoardSlotsContext.Provider value={slots}>
          <Suspense fallback={null}>
            <PlayMap />
          </Suspense>
        </BoardSlotsContext.Provider>
        <GameMoments />
        <div className="pointer-events-none absolute inset-0 z-10 flex gap-3 p-2 sm:p-3">
          {railOpen && (
            <aside
              id="play-rail"
              aria-label={t.play.quickAccess}
              className="codex-glass pointer-events-auto flex max-h-full w-[17rem] shrink-0 flex-col self-start overflow-hidden max-lg:absolute max-lg:inset-y-2 max-lg:left-2 max-lg:z-20 max-lg:w-[min(20rem,calc(100%-1rem))] sm:max-lg:inset-y-3 sm:max-lg:left-3"
            >
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line py-1 pr-1 pl-3.5">
                <h2 className="flex items-center gap-2 type-eyebrow text-ink-muted">
                  <GameIcon name="two-shadows" className="size-3.5" aria-hidden />
                  {t.turns.groups}
                </h2>
                <IconButton
                  size="sm"
                  label={t.play.railHide}
                  icon={<PanelLeftClose />}
                  aria-expanded
                  aria-controls="play-rail"
                  onClick={() => setRail(false)}
                  className="pointer-coarse:size-10"
                />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
                <GroupsPanel />
              </div>
            </aside>
          )}
          <div className="@container/board flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-start gap-2">
              {!railOpen && (
                <button
                  type="button"
                  onClick={() => setRail(true)}
                  aria-expanded={false}
                  aria-label={t.play.railShow}
                  title={t.play.railShow}
                  className="codex-glass pointer-events-auto flex h-11 shrink-0 items-center gap-2 !rounded-xl px-3 text-sm font-semibold text-ink hover:text-accent-text"
                >
                  <GameIcon name="two-shadows" className="size-4" aria-hidden />
                  <span className="hidden sm:inline">{t.play.railButton}</span>
                </button>
              )}
              <div className="flex min-w-0 flex-[1_1_14rem]">
                <GmPartyStrip className="pointer-events-auto w-fit" />
              </div>
              <div ref={setTop} className="pointer-events-auto ml-auto empty:hidden" />
            </div>
            <div className="min-h-0 flex-1" />
            <div ref={setBottom} className="flex justify-center" />
          </div>
          <QuickPanel />
        </div>
      </main>
      <PlaySheetDrawer />
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
