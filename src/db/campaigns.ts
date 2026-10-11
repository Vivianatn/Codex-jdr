import { newId } from '@/domain/entity'
import type { RollRecord } from '@/domain/rolls'
import type { ConditionTemplate, Entity, SkillDefinition } from '@/domain/types'
import { starterConditions } from '@/domain/conditions'
import { defaultRules, dropLegacyPhase2Defaults, withDefaultRules, type RulesConfig } from '@/rules'
import { db as defaultDb, type CodexDB } from './db'
import { normalizeEntity } from './normalize'
import {
  CAMPAIGN_EXPORT_FORMAT,
  CAMPAIGN_EXPORT_VERSION,
  emptyLibrary,
  type Campaign,
  type CampaignExport,
  type CampaignLibrary,
  type DiceMacro,
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
        rules: defaultRules(),
        library: emptyLibrary(),
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

    async updateRules(id: string, rules: RulesConfig): Promise<void> {
      await db.campaigns.update(id, { rules, updatedAt: now() })
    },

    async updateLibrary(id: string, library: CampaignLibrary): Promise<void> {
      await db.campaigns.update(id, { library, updatedAt: now() })
    },

    async markOpened(id: string): Promise<void> {
      await db.campaigns.update(id, { lastOpenedAt: now() })
    },

    /** Deletes the campaign and everything it owns. */
    async remove(id: string): Promise<void> {
      await db.transaction('rw', [db.campaigns, db.entities, db.rolls, db.skills], async () => {
        await db.entities.where('campaignId').equals(id).delete()
        await db.skills.where('campaignId').equals(id).delete()
        await db.rolls.where('campaignId').equals(id).delete()
        await db.campaigns.delete(id)
      })
    },

    async exportCampaign(id: string): Promise<CampaignExport> {
      const campaign = await db.campaigns.get(id)
      if (!campaign) throw new Error(`Campaign ${id} not found`)
      const entities = await db.entities.where('campaignId').equals(id).toArray()
      const rolls = await db.rolls.where('campaignId').equals(id).sortBy('at')
      const skills = await db.skills.where('campaignId').equals(id).sortBy('createdAt')
      return {
        format: CAMPAIGN_EXPORT_FORMAT,
        version: CAMPAIGN_EXPORT_VERSION,
        exportedAt: new Date(now()).toISOString(),
        campaign,
        entities: entities.sort((a, b) => a.createdAt - b.createdAt),
        rolls,
        skills,
      }
    },

    /** Accepts raw file text or an already-parsed object. */
    async importCampaign(input: string | unknown, copySuffix = '(copie)'): Promise<ImportResult> {
      const data = parseExport(input)
      return db.transaction('rw', [db.campaigns, db.entities, db.rolls, db.skills], async () => {
        const existing = await db.campaigns.get(data.campaign.id)
        const campaign: Campaign = existing
          ? {
              ...data.campaign,
              id: newId(),
              name: `${data.campaign.name} ${copySuffix}`,
              updatedAt: now(),
            }
          : data.campaign

        // Fresh ids if the campaign is a copy or if any id is already taken.
        const taken = await db.entities.bulkGet(data.entities.map((e) => e.id))
        const remap = existing || taken.some(Boolean)
        const ids = new Map(data.entities.map((e) => [e.id, remap ? newId() : e.id]))
        const entities = data.entities.map((e): Entity => {
          const moved = { ...e, id: ids.get(e.id)!, campaignId: campaign.id } as Entity
          if (moved.kind === 'familiar' && moved.details.ownerId)
            moved.details = { ...moved.details, ownerId: ids.get(moved.details.ownerId) ?? null }
          return moved
        })

        const rolls = data.rolls.map((r) => ({
          ...r,
          id: remap ? newId() : r.id,
          campaignId: campaign.id,
          entityId: r.entityId ? (ids.get(r.entityId) ?? null) : null,
        }))
        const skillIds = new Map(data.skills.map((d) => [d.id, remap ? newId() : d.id]))
        const skills = data.skills.map((d) => ({
          ...d,
          id: skillIds.get(d.id)!,
          campaignId: campaign.id,
        }))
        for (const e of entities)
          e.skills = e.skills.map((s) => ({
            ...s,
            sourceId: s.sourceId ? (skillIds.get(s.sourceId) ?? s.sourceId) : null,
          }))
        await db.campaigns.add(campaign)
        await db.skills.bulkPut(skills)
        await db.entities.bulkAdd(entities)
        await db.rolls.bulkPut(rolls)
        return { campaign, renamed: Boolean(existing) }
      })
    },
  }
}

export type CampaignRepository = ReturnType<typeof createCampaignRepository>

export const campaignRepository = createCampaignRepository()

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isCampaignCore(
  value: unknown,
): value is Omit<Campaign, 'rules' | 'library'> & { rules?: unknown; library?: unknown } {
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

/** Validates and upgrades an export file (v1 files have no rules and no entities). */
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
  if (!isCampaignCore(data.campaign)) throw new CampaignImportError('invalidCampaign')
  if (data.entities !== undefined && !Array.isArray(data.entities))
    throw new CampaignImportError('invalidCampaign')

  const legacy = data.version < 4
  const library = isRecord(data.campaign.library) ? data.campaign.library : {}
  const campaign: Campaign = {
    ...data.campaign,
    // Files written before v4 carry the invented phase-2 defaults (D-217).
    rules: legacy
      ? dropLegacyPhase2Defaults(data.campaign.rules)
      : withDefaultRules(data.campaign.rules),
    library: {
      conditions:
        Array.isArray(library.conditions) && (library.conditions.length > 0 || !legacy)
          ? (library.conditions as ConditionTemplate[])
          : starterConditions(),
      macros: Array.isArray(library.macros) ? (library.macros as DiceMacro[]) : [],
    },
  }
  const entities = ((data.entities as unknown[] | undefined) ?? []).map((raw) => {
    const entity = normalizeEntity(raw, campaign.id)
    if (!entity) throw new CampaignImportError('invalidCampaign')
    return entity
  })
  const rolls = (Array.isArray(data.rolls) ? data.rolls : []).filter(
    (r): r is RollRecord => isRecord(r) && typeof r.id === 'string' && typeof r.total === 'number',
  )
  const skills = (Array.isArray(data.skills) ? data.skills : []).filter(
    (d): d is SkillDefinition =>
      isRecord(d) &&
      typeof d.id === 'string' &&
      typeof d.name === 'string' &&
      typeof d.kind === 'string',
  )
  return {
    format: CAMPAIGN_EXPORT_FORMAT,
    version: CAMPAIGN_EXPORT_VERSION,
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : '',
    campaign,
    entities,
    rolls,
    skills,
  }
}
