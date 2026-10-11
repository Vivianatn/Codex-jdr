import Dexie, { type EntityTable } from 'dexie'
import { normalizeEntityShape } from '@/domain/entity'
import type { RollRecord } from '@/domain/rolls'
import type { GameMap } from '@/domain/maps'
import type { EnemyTemplate, Entity, Item, LibraryItem, SkillDefinition } from '@/domain/types'
import type { Asset } from './types'
import { starterConditions } from '@/domain/conditions'
import { defaultRules, dropLegacyPhase2Defaults, withDefaultRules } from '@/rules'
import { emptyLibrary, type Campaign } from './types'

export const DB_NAME = 'codex'

/** Index layout of each schema version. Never edit a past version: add a new one. */
export const SCHEMA = {
  1: {
    campaigns: 'id, name, updatedAt, lastOpenedAt',
  },
  2: {
    campaigns: 'id, name, updatedAt, lastOpenedAt',
    entities: 'id, campaignId, [campaignId+kind]',
    bestiary: 'id, updatedAt',
  },
  3: {
    campaigns: 'id, name, updatedAt, lastOpenedAt',
    entities: 'id, campaignId, [campaignId+kind]',
    bestiary: 'id, updatedAt',
    rolls: 'id, campaignId, [campaignId+at]',
    itemLibrary: 'id, name',
  },
  4: {
    campaigns: 'id, name, updatedAt, lastOpenedAt',
    entities: 'id, campaignId, [campaignId+kind]',
    bestiary: 'id, updatedAt',
    rolls: 'id, campaignId, [campaignId+at]',
    itemLibrary: 'id, name',
  },
  5: {
    campaigns: 'id, name, updatedAt, lastOpenedAt',
    entities: 'id, campaignId, [campaignId+kind]',
    bestiary: 'id, updatedAt',
    rolls: 'id, campaignId, [campaignId+at]',
    itemLibrary: 'id, name',
    skills: 'id, campaignId',
  },
  6: {
    campaigns: 'id, name, updatedAt, lastOpenedAt',
    entities: 'id, campaignId, [campaignId+kind]',
    bestiary: 'id, campaignId, updatedAt',
    rolls: 'id, campaignId, [campaignId+at]',
    itemLibrary: 'id, campaignId, name',
    skills: 'id, campaignId',
  },
  7: {
    campaigns: 'id, name, updatedAt, lastOpenedAt',
    entities: 'id, campaignId, [campaignId+kind]',
    bestiary: 'id, campaignId, updatedAt',
    rolls: 'id, campaignId, [campaignId+at]',
    itemLibrary: 'id, campaignId, name',
    skills: 'id, campaignId',
    maps: 'id, campaignId',
    assets: 'id, campaignId',
  },
} as const

/**
 * Local IndexedDB database. Each schema change adds a new `version(n)` block
 * and gets a migration test in db.test.ts.
 */
export class CodexDB extends Dexie {
  campaigns!: EntityTable<Campaign, 'id'>
  entities!: EntityTable<Entity, 'id'>
  /** Enemy templates, shared by every campaign. */
  bestiary!: EntityTable<EnemyTemplate, 'id'>
  /** Dice history, per campaign. */
  rolls!: EntityTable<RollRecord, 'id'>
  /** Item templates, shared by every campaign. */
  itemLibrary!: EntityTable<LibraryItem, 'id'>
  /** Skill library, per campaign (D-218). */
  skills!: EntityTable<SkillDefinition, 'id'>
  /** Battle maps of each campaign (D-228). */
  maps!: EntityTable<GameMap, 'id'>
  /** Big pictures (map backgrounds, mood images), kept out of frequently saved records. */
  assets!: EntityTable<Asset, 'id'>

  constructor(name: string = DB_NAME) {
    super(name)
    this.version(1).stores(SCHEMA[1])
    // v2 (phase 1): characters, bestiary, per-campaign rules.
    this.version(2)
      .stores(SCHEMA[2])
      .upgrade((tx) =>
        tx
          .table('campaigns')
          .toCollection()
          .modify((campaign: Partial<Campaign>) => {
            campaign.rules ??= defaultRules()
          }),
      )
    // v3 (phase 2): dice history, item library, campaign library, richer items/skills/conditions.
    this.version(3)
      .stores(SCHEMA[3])
      .upgrade(async (tx) => {
        await tx
          .table('campaigns')
          .toCollection()
          .modify((campaign: Partial<Campaign>) => {
            campaign.rules = withDefaultRules(campaign.rules)
            campaign.library ??= emptyLibrary()
          })
        const upgrade = (e: Entity) => Object.assign(e, normalizeEntityShape(e))
        await tx.table('entities').toCollection().modify(upgrade)
        await tx.table('bestiary').toCollection().modify(upgrade)
      })
    // v4: no imposed mechanics (D-217) — invented phase-2 defaults are switched off,
    // and every campaign gets its own editable starter condition list.
    this.version(4)
      .stores(SCHEMA[4])
      .upgrade((tx) =>
        tx
          .table('campaigns')
          .toCollection()
          .modify((campaign: Campaign) => {
            campaign.rules = dropLegacyPhase2Defaults(campaign.rules)
            campaign.library ??= emptyLibrary()
            if (campaign.library.conditions.length === 0)
              campaign.library.conditions = starterConditions()
          }),
      )
    // v5: skill library table. Existing skills are adopted into it when a
    // campaign is opened (adoptSkills), so no data is rewritten here.
    this.version(5).stores(SCHEMA[5])
    // v6 (D-224): everything belongs to a campaign. The bestiary and the item
    // library were shared by every campaign: each campaign gets its own copy,
    // and existing enemies point to the template of their campaign.
    this.version(6)
      .stores(SCHEMA[6])
      .upgrade(async (tx) => {
        const campaigns = (await tx.table('campaigns').toArray()) as Campaign[]
        const templates = (await tx.table('bestiary').toArray()) as EnemyTemplate[]
        const items = (await tx.table('itemLibrary').toArray()) as Item[]
        await tx.table('bestiary').clear()
        await tx.table('itemLibrary').clear()
        for (const [index, campaign] of campaigns.entries()) {
          // The first campaign keeps the original ids.
          const id = (old: string) => (index === 0 ? old : crypto.randomUUID())
          const templateIds = new Map(templates.map((t) => [t.id, id(t.id)]))
          await tx
            .table('bestiary')
            .bulkAdd(
              templates.map((t) => ({ ...t, id: templateIds.get(t.id)!, campaignId: campaign.id })),
            )
          await tx
            .table('itemLibrary')
            .bulkAdd(items.map((i) => ({ ...i, id: id(i.id), campaignId: campaign.id })))
          await tx
            .table('entities')
            .where('campaignId')
            .equals(campaign.id)
            .modify((e: Entity) => {
              if (
                e.kind === 'enemy' &&
                e.details.templateId &&
                templateIds.has(e.details.templateId)
              )
                e.details.templateId = templateIds.get(e.details.templateId)!
            })
        }
      })
    // v7 (D-228): battle maps and image assets.
    this.version(7).stores(SCHEMA[7])
  }
}

export const db = new CodexDB()
