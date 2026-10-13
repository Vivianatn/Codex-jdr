import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Hammer } from 'lucide-react'
import { GameIcon } from '@/components/GameIcon'
import { useEffect, useMemo } from 'react'
import { Link, Navigate, Outlet, useMatch, useNavigate, useParams } from 'react-router'
import { LogoMark } from '@/components/Brand'
import { IconButton } from '@/components/ui/Button'
import { buttonClasses } from '@/components/ui/buttonStyles'
import { EmptyState } from '@/components/ui/EmptyState'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { campaignRepository } from '@/db/campaigns'
import { GuestBadge } from '@/features/online/JoinDialog'
import { OnlinePanel } from '@/features/online/OnlinePanel'
import { useLiveRelay } from '@/features/online/useLiveRelay'
import { useT } from '@/i18n'
import { useOnlineStore } from '@/online/onlineStore'
import { useCampaignStore } from '@/stores/campaignStore'
import { useRollStore } from '@/stores/rollStore'
import { DiceButton } from '@/features/dice/DicePanel'
import { CampaignOverlays } from './CampaignOverlays'
import { withDefaultRules } from '@/rules'
import { emptyLibrary } from '@/db/types'
import { useUiStore } from '@/stores/uiStore'
import { AppHeader } from './AppHeader'
import { UndoRedo } from './UndoRedo'
import { CampaignReactContext, type CampaignContext } from './campaignContext'

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

  const online = useOnlineStore((s) => s.role)
  const guestRole = useOnlineStore((s) => s.guestRole)

  useEffect(() => {
    if (!campaignId) return
    // A guest's copy is not "opened" by them: nothing to write back to the host.
    if (useOnlineStore.getState().role !== 'guest') void campaignRepository.markOpened(campaignId)
    void useCampaignStore.getState().load(campaignId)
    void useRollStore.getState().load(campaignId)
  }, [campaignId])

  // Older records may miss newer rule keys; normalise once per change.
  const normalized = useMemo(
    () =>
      campaign
        ? {
            ...campaign,
            rules: withDefaultRules(campaign.rules),
            library: campaign.library ?? emptyLibrary(),
          }
        : null,
    [campaign],
  )

  // The players of a running online game are served while the operator stays here (D-262).
  const relayed = useMemo(
    () => ({ id: campaignId, name: campaign?.name ?? '' }),
    [campaignId, campaign?.name],
  )
  useLiveRelay(relayed)

  // Players have their own screen; the prep screens are for GMs (D-245).
  if (guestRole === 'player') return <Navigate to={`/c/${campaignId}/player`} replace />
  if (campaign === undefined || (campaign && !ready)) return null

  if (campaign === null || !normalized) {
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
    <CampaignReactContext.Provider value={normalized}>
      <div className="flex h-full flex-col">
        <AppHeader
          start={
            <>
              {online !== 'guest' && <BackToCampaigns />}
              <span className="truncate type-card-title text-ink">{campaign.name}</span>
            </>
          }
          center={<ModeSwitch campaignId={campaign.id} />}
          end={
            <>
              {online === 'guest' ? <GuestBadge /> : <OnlinePanel />}
              <UndoRedo />
              <DiceButton />
            </>
          }
        />
        <Outlet context={{ campaign: normalized } satisfies CampaignContext} />
        <CampaignOverlays />
      </div>
    </CampaignReactContext.Provider>
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
        { value: 'play', label: t.modes.play, icon: <GameIcon name="crossed-swords" /> },
      ]}
    />
  )
}
