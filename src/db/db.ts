import Dexie, { type EntityTable } from 'dexie'
import type { Campaign } from './types'

export const DB_NAME = 'codex'

/**
 * Local IndexedDB database. Each schema change adds a new `version(n)` block
 * (never edit an existing one) and gets a migration test in db.test.ts.
 */
export class CodexDB extends Dexie {
  campaigns!: EntityTable<Campaign, 'id'>

  constructor(name: string = DB_NAME) {
    super(name)
    this.version(1).stores({
      campaigns: 'id, name, updatedAt, lastOpenedAt',
    })
  }
}

export const db = new CodexDB()
