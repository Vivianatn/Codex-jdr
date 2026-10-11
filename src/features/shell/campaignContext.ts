import { useOutletContext } from 'react-router'
import type { Campaign } from '@/db/types'

export interface CampaignContext {
  campaign: Campaign
}

/** The campaign loaded by CampaignLayout, available to every nested route. */
export function useCampaign(): Campaign {
  return useOutletContext<CampaignContext>().campaign
}
