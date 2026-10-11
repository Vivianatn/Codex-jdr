import Dexie, { type EntityTable } from 'dexie'
import { normalizeEntityShape } from '@/domain/entity'
import type { RollRecord } from '@/domain/rolls'
import type { EnemyTemplate, Entity, Item } from '@/domain/types'
import { defaultRules, withDefaultRules } from '@/rules'
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
  itemLibrary!: EntityTable<Item, 'id'>

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
  }
}

export const db = new CodexDB()
