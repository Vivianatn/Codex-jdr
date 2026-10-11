import Dexie, { type EntityTable } from 'dexie'
import type { EnemyTemplate, Entity } from '@/domain/types'
import { defaultRules } from '@/rules'
import type { Campaign } from './types'

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
  }
}

export const db = new CodexDB()
