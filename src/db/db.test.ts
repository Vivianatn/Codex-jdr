import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { defaultRules } from '@/rules'
import { CodexDB, SCHEMA } from './db'

const names: string[] = []
afterEach(async () => {
  for (const name of names.splice(0)) await Dexie.delete(name)
})

describe('schema migrations', () => {
  it('v1 → v2 adds default rules to existing campaigns and the new tables', async () => {
    const name = `codex-migration-${crypto.randomUUID()}`
    names.push(name)

    // A database as phase 0 left it.
    const v1 = new Dexie(name)
    v1.version(1).stores(SCHEMA[1])
    await v1.open()
    await v1.table('campaigns').add({
      id: 'c1',
      name: 'Ancienne',
      description: '',
      createdAt: 1,
      updatedAt: 1,
      lastOpenedAt: null,
    })
    v1.close()

    const db = new CodexDB(name)
    await db.open()
    expect(db.verno).toBe(2)
    expect((await db.campaigns.get('c1'))?.rules).toEqual(defaultRules())
    expect(await db.entities.count()).toBe(0)
    expect(await db.bestiary.count()).toBe(0)
    db.close()
  })
})
