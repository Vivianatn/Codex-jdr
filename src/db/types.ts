export interface Campaign {
  id: string
  name: string
  description: string
  createdAt: number
  updatedAt: number
  lastOpenedAt: number | null
}

/** Current version of the campaign export file. Bump it when the shape changes. */
export const CAMPAIGN_EXPORT_VERSION = 1
export const CAMPAIGN_EXPORT_FORMAT = 'codex-campaign'

export interface CampaignExport {
  format: typeof CAMPAIGN_EXPORT_FORMAT
  version: number
  exportedAt: string
  campaign: Campaign
}
