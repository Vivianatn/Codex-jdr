import { starterConditions } from '@/domain/conditions'
import type { RollRecord } from '@/domain/rolls'
import type { ConditionTemplate, Entity, SkillDefinition } from '@/domain/types'
import type { RulesConfig } from '@/rules'

export interface Campaign {
  id: string
  name: string
  description: string
  /** House rules for this campaign (Préparation › Règles). */
  rules: RulesConfig
  /** GM-made library entries and saved rolls, specific to this campaign. */
  library: CampaignLibrary
  createdAt: number
  updatedAt: number
  lastOpenedAt: number | null
}

export interface DiceMacro {
  id: string
  name: string
  expression: string
}

export interface CampaignLibrary {
  /** Custom conditions (the built-in ones are in code). */
  conditions: ConditionTemplate[]
  /** Favourite / saved rolls of the dice tray. */
  macros: DiceMacro[]
}

/** Library of a new campaign: the editable starter conditions, no macros. */
export function emptyLibrary(): CampaignLibrary {
  return { conditions: starterConditions(), macros: [] }
}

/** Current version of the campaign export file. Bump it when the shape changes. */
export const CAMPAIGN_EXPORT_VERSION = 5
export const CAMPAIGN_EXPORT_FORMAT = 'codex-campaign'

export interface CampaignExport {
  format: typeof CAMPAIGN_EXPORT_FORMAT
  version: number
  exportedAt: string
  campaign: Campaign
  entities: Entity[]
  rolls: RollRecord[]
  /** Skill library (v5+). */
  skills: SkillDefinition[]
}
