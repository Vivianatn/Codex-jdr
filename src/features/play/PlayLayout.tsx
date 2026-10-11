import { Map, Skull, Star, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { buttonClasses } from '@/components/ui/buttonStyles'
import { EmptyState } from '@/components/ui/EmptyState'
import { useCampaign } from '@/features/shell/campaignContext'
import { PageTransition } from '@/features/shell/PageTransition'
import { useT } from '@/i18n'

/**
 * "En jeu" mode: the map takes the whole screen, with a slim quick-access
 * sidebar. Everything else (sheets, menus) will float over the map.
 */
export function PlayLayout() {
  const t = useT()
  const campaign = useCampaign()

  return (
    <PageTransition className="flex-row">
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

      <aside
        aria-label={t.play.quickAccess}
        className="hidden w-72 shrink-0 flex-col gap-6 overflow-y-auto border-l border-line bg-bg p-4 lg:flex"
      >
        <QuickSection icon={<Users />} title={t.play.party} empty={t.play.partyEmpty} />
        <QuickSection icon={<Skull />} title={t.play.enemies} empty={t.play.enemiesEmpty} />
        <QuickSection icon={<Star />} title={t.play.favorites} empty={t.play.favoritesEmpty} />
      </aside>
    </PageTransition>
  )
}

function QuickSection({ icon, title, empty }: { icon: ReactNode; title: string; empty: string }) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 font-sans text-xs font-semibold tracking-wider text-ink-muted uppercase [&>svg]:size-3.5">
        {icon}
        {title}
      </h2>
      <p className="rounded-md border border-dashed border-line px-3 py-4 text-center text-sm text-ink-muted">
        {empty}
      </p>
    </section>
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
