import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Hammer, Swords } from 'lucide-react'
import { useEffect } from 'react'
import { Link, Outlet, useMatch, useNavigate, useParams } from 'react-router'
import { LogoMark } from '@/components/Brand'
import { IconButton } from '@/components/ui/Button'
import { buttonClasses } from '@/components/ui/buttonStyles'
import { EmptyState } from '@/components/ui/EmptyState'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { campaignRepository } from '@/db/campaigns'
import { useT } from '@/i18n'
import { useCampaignStore } from '@/stores/campaignStore'
import { useUiStore } from '@/stores/uiStore'
import { AppHeader } from './AppHeader'
import { UndoRedo } from './UndoRedo'
import type { CampaignContext } from './campaignContext'

export type GameMode = 'prep' | 'play'

/** Loads the campaign from the route and frames it with the header and mode switch. */
export function CampaignLayout() {
  const t = useT()
  const { campaignId = '' } = useParams()
  // `null` = loaded but missing; `undefined` = still loading.
  const campaign = useLiveQuery(
    async () => (await campaignRepository.get(campaignId)) ?? null,
    [campaignId],
  )

  const ready = useCampaignStore((s) => s.campaignId === campaignId && s.status === 'ready')

  useEffect(() => {
    if (!campaignId) return
    void campaignRepository.markOpened(campaignId)
    void useCampaignStore.getState().load(campaignId)
  }, [campaignId])

  if (campaign === undefined || (campaign && !ready)) return null

  if (campaign === null) {
    return (
      <div className="flex min-h-full flex-col">
        <AppHeader start={<BackToCampaigns />} />
        <main id="main" className="flex flex-1 items-center">
          <EmptyState
            icon={<LogoMark className="size-7" />}
            title={t.campaigns.notFoundTitle}
            body={t.campaigns.notFoundBody}
            actions={
              <Link to="/" className={buttonClasses('primary')}>
                {t.nav.backToCampaigns}
              </Link>
            }
          />
        </main>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <AppHeader
        start={
          <>
            <BackToCampaigns />
            <span className="truncate font-display text-base font-semibold text-ink">
              {campaign.name}
            </span>
          </>
        }
        center={<ModeSwitch campaignId={campaign.id} />}
        end={<UndoRedo />}
      />
      <Outlet context={{ campaign } satisfies CampaignContext} />
    </div>
  )
}

function BackToCampaigns() {
  const t = useT()
  const navigate = useNavigate()
  return (
    <IconButton label={t.nav.backToCampaigns} icon={<ArrowLeft />} onClick={() => navigate('/')} />
  )
}

/** Préparation ⇄ En jeu, one click away from anywhere in the campaign. */
export function ModeSwitch({ campaignId }: { campaignId: string }) {
  const t = useT()
  const navigate = useNavigate()
  const lastSection = useUiStore((s) => s.lastPrepSection[campaignId] ?? 'dashboard')
  // Exact route match: a substring test would confuse "/prep/players" with "/play".
  const mode: GameMode = useMatch('/c/:campaignId/play') ? 'play' : 'prep'

  return (
    <SegmentedControl<GameMode>
      label={t.modes.label}
      value={mode}
      onValueChange={(next) =>
        navigate(next === 'play' ? `/c/${campaignId}/play` : `/c/${campaignId}/prep/${lastSection}`)
      }
      options={[
        { value: 'prep', label: t.modes.prep, icon: <Hammer /> },
        { value: 'play', label: t.modes.play, icon: <Swords /> },
      ]}
    />
  )
}
