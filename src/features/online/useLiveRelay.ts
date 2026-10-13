import { useEffect } from 'react'
import { serveCampaign, stopServing } from '@/online/controller'
import { useOnlineStore } from '@/online/onlineStore'
import { useIsOnlineCampaign } from '@/online/server/serverStore'
import { useCampaignStore } from '@/stores/campaignStore'

/**
 * The operator of a running online game opens it to the players while the
 * campaign is open on this device (D-262). Leaving the campaign, ending the
 * game or handing it over closes it.
 */
export function useLiveRelay(campaign: { id: string; name: string }): void {
  const selfId = useOnlineStore((s) => s.selfId)
  const guest = useOnlineStore((s) => s.role === 'guest')
  const online = useIsOnlineCampaign(campaign.id)
  const serving = useCampaignStore(
    (s) =>
      s.campaignId === campaign.id &&
      s.status === 'ready' &&
      s.play.live?.mode === 'online' &&
      s.play.live.operator.id === selfId,
  )
  const should = online && serving && !guest
  useEffect(() => {
    if (!should) return
    serveCampaign(campaign)
    return () => stopServing()
  }, [should, campaign])
}
