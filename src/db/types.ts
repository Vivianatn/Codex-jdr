import type { Entity } from '@/domain/types'
import type { RulesConfig } from '@/rules'

export interface Campaign {
  id: string
  name: string
  description: string
  /** House rules for this campaign (Préparation › Règles). */
  rules: RulesConfig
  createdAt: number
  updatedAt: number
  lastOpenedAt: number | null
}

/** Current version of the campaign export file. Bump it when the shape changes. */
export const CAMPAIGN_EXPORT_VERSION = 2
export const CAMPAIGN_EXPORT_FORMAT = 'codex-campaign'

export interface CampaignExport {
  format: typeof CAMPAIGN_EXPORT_FORMAT
  version: number
  exportedAt: string
  campaign: Campaign
  entities: Entity[]
}
