import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createEntity } from '@/domain/entity'
import { defaultRules } from '@/rules'
import { randomBytes } from '@/security/crypto'
import { AUTO_BACKUP_INTERVAL, createBackupService, MAX_BACKUPS } from './backups'
import { createCampaignRepository } from './campaigns'
import { CodexDB } from './db'

let db: CodexDB
let clock: number
let backups: ReturnType<typeof createBackupService>
let campaigns: ReturnType<typeof createCampaignRepository>

beforeEach(async () => {
  db = new CodexDB(`codex-backups-${crypto.randomUUID()}`, { key: randomBytes(32) })
  await db.open()
  clock = 1_000_000
  backups = createBackupService(
    () => db,
    () => clock++,
  )
  campaigns = createCampaignRepository(
    () => db,
    () => clock++,
  )
})

afterEach(async () => {
  db.close()
  await Dexie.delete(db.name)
})

describe('backups (D-242)', () => {
  it('takes an automatic snapshot at most once a day, and only with something to keep', async () => {
    expect(await backups.autoBackupIfDue()).toBeNull()
    await campaigns.create({ name: 'A' })
    expect(await backups.autoBackupIfDue()).not.toBeNull()
    expect(await backups.autoBackupIfDue()).toBeNull()
    clock += AUTO_BACKUP_INTERVAL
    expect(await backups.autoBackupIfDue()).not.toBeNull()
  })

  it(`keeps the ${MAX_BACKUPS} newest, listed newest first without their content`, async () => {
    await campaigns.create({ name: 'A' })
    for (let i = 0; i < MAX_BACKUPS + 2; i++) await backups.create('manual')
    const list = await backups.list()
    expect(list).toHaveLength(MAX_BACKUPS)
    expect(list[0]!.createdAt).toBeGreaterThan(list[1]!.createdAt)
    expect(list[0]).not.toHaveProperty('archive')
    expect(list[0]).toMatchObject({ reason: 'manual', campaignCount: 1 })
  })

  it('restores every campaign, after a snapshot of the current state', async () => {
    const kept = await campaigns.create({ name: 'Gardée' })
    await db.entities.add(createEntity('player', kept.id, defaultRules()))
    const snapshot = await backups.create('manual')

    await campaigns.remove(kept.id)
    await campaigns.create({ name: 'Ajoutée ensuite' })
    await backups.restore(snapshot.id)

    expect((await campaigns.list()).map((c) => c.name)).toEqual(['Gardée'])
    expect(await db.entities.count()).toBe(1)
    const list = await backups.list()
    expect(list[0]).toMatchObject({ reason: 'beforeRestore', campaignCount: 1 })
  })
})
