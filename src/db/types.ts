import { starterConditions } from '@/domain/conditions'
import type { RollRecord } from '@/domain/rolls'
import type { GameMap } from '@/domain/maps'
import type { SessionPlan, SessionRun } from '@/domain/sessions'
import type { PlayState } from '@/domain/turns'
import type {
  ConditionTemplate,
  EnemyTemplate,
  Entity,
  LibraryItem,
  SkillDefinition,
} from '@/domain/types'
import type { RulesConfig } from '@/rules'

export interface Campaign {
  id: string
  name: string
  description: string
  /** House rules for this campaign (Préparation › Règles). */
  rules: RulesConfig
  /** GM-made library entries and saved rolls, specific to this campaign. */
  library: CampaignLibrary
  /** Groups and turn of the game in progress (D-226); missing on older records. */
  play?: PlayState
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

/** A picture stored once and referenced by id (map backgrounds, mood images). */
export interface Asset {
  id: string
  campaignId: string
  /** data: URL */
  data: string
  name: string
}

/** Current version of the campaign export file. Bump it when the shape changes. */
export const CAMPAIGN_EXPORT_VERSION = 8
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
  /** Enemy templates and item library of the campaign (v6+). */
  bestiary: EnemyTemplate[]
  items: LibraryItem[]
  /** Battle maps and their pictures (v7+). */
  maps: GameMap[]
  assets: Asset[]
  /** Session plans and the games played (v8+, D-244). */
  sessions: SessionPlan[]
  sessionRuns: SessionRun[]
}

/** Every campaign of this device in one file (GDPR data portability, D-240). */
export const ARCHIVE_EXPORT_VERSION = 1
export const ARCHIVE_EXPORT_FORMAT = 'codex-archive'

export interface ArchiveExport {
  format: typeof ARCHIVE_EXPORT_FORMAT
  version: number
  exportedAt: string
  campaigns: CampaignExport[]
}

export type BackupReason = 'auto' | 'manual' | 'beforeRestore'

/** Snapshot of every campaign of an account, kept in its (encrypted) database (D-242). */
export interface Backup {
  id: string
  createdAt: number
  reason: BackupReason
  campaignCount: number
  archive: ArchiveExport
}

/** One local change of an online campaign waiting for the server (D-262), one per record. */
export interface OutboxEntry {
  /** `table:recordId`: a newer change of the same record replaces the older one. */
  id: string
  campaignId: string
  table: string
  recordId: string
  /** The record to write, or null to delete it. */
  record: Record<string, unknown> | null
  /** Changes on every write: an entry is removed only if it was not rewritten while being sent. */
  version: string
}

/** An online campaign of this account (D-262). */
export interface SyncState {
  /** The campaign's id. */
  id: string
  /** Last server revision pulled. */
  rev: number
  role: 'owner' | 'editor'
  /** Owner: the campaign vanished from the server (deleted from another device). Kept here, off line. */
  detached?: boolean
  /** Deleted (owner) or left (co-GM) on this device: the server is told as soon as it can be. */
  leaving?: boolean
}
