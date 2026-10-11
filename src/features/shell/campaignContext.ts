import { createContext, useContext } from 'react'
import { useOutletContext } from 'react-router'
import type { Campaign } from '@/db/types'

export interface CampaignContext {
  campaign: Campaign
}

/** Provided by CampaignLayout around the whole campaign UI (pages and overlays). */
export const CampaignReactContext = createContext<Campaign | null>(null)

/** The open campaign (rules already normalised). */
export function useCampaign(): Campaign {
  const fromContext = useContext(CampaignReactContext)
  const fromOutlet = useOutletContext<CampaignContext | undefined>()
  const campaign = fromContext ?? fromOutlet?.campaign
  if (!campaign) throw new Error('useCampaign() used outside a campaign')
  return campaign
}
