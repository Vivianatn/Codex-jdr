import { db as defaultDb, type CodexDB } from './db'
import {
  CAMPAIGN_EXPORT_FORMAT,
  CAMPAIGN_EXPORT_VERSION,
  type Campaign,
  type CampaignExport,
} from './types'

export type ImportErrorCode =
  'invalidJson' | 'wrongFormat' | 'unsupportedVersion' | 'invalidCampaign'

export class CampaignImportError extends Error {
  constructor(
    readonly code: ImportErrorCode,
    readonly version?: number,
  ) {
    super(`Campaign import failed: ${code}`)
    this.name = 'CampaignImportError'
  }
}

export interface ImportResult {
  campaign: Campaign
  /** True when a campaign with the same id existed and the import was saved as a copy. */
  renamed: boolean
}

function newId(): string {
  return crypto.randomUUID()
}

export function createCampaignRepository(db: CodexDB = defaultDb, now: () => number = Date.now) {
  return {
    async create(input: { name: string; description?: string }): Promise<Campaign> {
      const name = input.name.trim()
      if (!name) throw new Error('Campaign name is required')
      const timestamp = now()
      const campaign: Campaign = {
        id: newId(),
        name,
        description: input.description?.trim() ?? '',
        createdAt: timestamp,
        updatedAt: timestamp,
        lastOpenedAt: null,
      }
      await db.campaigns.add(campaign)
      return campaign
    },

    get(id: string): Promise<Campaign | undefined> {
      return db.campaigns.get(id)
    },

    /** Most recently opened first, then most recently updated. */
    async list(): Promise<Campaign[]> {
      const all = await db.campaigns.toArray()
      return all.sort(
        (a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0) || b.updatedAt - a.updatedAt,
      )
    },

    async update(
      id: string,
      patch: Partial<Pick<Campaign, 'name' | 'description'>>,
    ): Promise<void> {
      const clean: Partial<Campaign> = { updatedAt: now() }
      if (patch.name !== undefined) {
        const name = patch.name.trim()
        if (!name) throw new Error('Campaign name is required')
        clean.name = name
      }
      if (patch.description !== undefined) clean.description = patch.description.trim()
      await db.campaigns.update(id, clean)
    },

    async markOpened(id: string): Promise<void> {
      await db.campaigns.update(id, { lastOpenedAt: now() })
    },

    async remove(id: string): Promise<void> {
      await db.transaction('rw', db.campaigns, async () => {
        await db.campaigns.delete(id)
      })
    },

    async exportCampaign(id: string): Promise<CampaignExport> {
      const campaign = await db.campaigns.get(id)
      if (!campaign) throw new Error(`Campaign ${id} not found`)
      return {
        format: CAMPAIGN_EXPORT_FORMAT,
        version: CAMPAIGN_EXPORT_VERSION,
        exportedAt: new Date(now()).toISOString(),
        campaign,
      }
    },

    /** Accepts raw file text or an already-parsed object. */
    async importCampaign(input: string | unknown, copySuffix = '(copie)'): Promise<ImportResult> {
      const data = parseExport(input)
      const existing = await db.campaigns.get(data.campaign.id)
      const campaign: Campaign = existing
        ? {
            ...data.campaign,
            id: newId(),
            name: `${data.campaign.name} ${copySuffix}`,
            updatedAt: now(),
          }
        : data.campaign
      await db.campaigns.add(campaign)
      return { campaign, renamed: Boolean(existing) }
    },
  }
}

export type CampaignRepository = ReturnType<typeof createCampaignRepository>

export const campaignRepository = createCampaignRepository()

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isCampaign(value: unknown): value is Campaign {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.name === 'string' &&
    value.name.trim().length > 0 &&
    typeof value.description === 'string' &&
    typeof value.createdAt === 'number' &&
    typeof value.updatedAt === 'number' &&
    (value.lastOpenedAt === null || typeof value.lastOpenedAt === 'number')
  )
}

export function parseExport(input: string | unknown): CampaignExport {
  let data: unknown = input
  if (typeof input === 'string') {
    try {
      data = JSON.parse(input)
    } catch {
      throw new CampaignImportError('invalidJson')
    }
  }
  if (!isRecord(data) || data.format !== CAMPAIGN_EXPORT_FORMAT) {
    throw new CampaignImportError('wrongFormat')
  }
  if (typeof data.version !== 'number' || data.version > CAMPAIGN_EXPORT_VERSION) {
    throw new CampaignImportError(
      'unsupportedVersion',
      typeof data.version === 'number' ? data.version : undefined,
    )
  }
  if (!isCampaign(data.campaign)) throw new CampaignImportError('invalidCampaign')
  return data as unknown as CampaignExport
}
