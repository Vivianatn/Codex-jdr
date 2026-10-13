import { createCampaignRepository } from './campaigns'
import { activeDb, type CodexDB } from './db'
import type { Backup, BackupReason } from './types'

/** Snapshots kept per account; the oldest goes first. */
export const MAX_BACKUPS = 3
/** An automatic snapshot is taken at unlock when the last one is older than this. */
export const AUTO_BACKUP_INTERVAL = 24 * 3600_000

/**
 * Snapshots of every campaign (D-242), stored in the account's database and
 * therefore encrypted like everything else. They guard against mistakes and
 * damaged records, not against losing the device: that is what exports are for.
 */
export function createBackupService(db: () => CodexDB = activeDb, now: () => number = Date.now) {
  const campaigns = createCampaignRepository(db, now)

  async function create(reason: BackupReason): Promise<Backup> {
    const archive = await campaigns.exportAll()
    const backup: Backup = {
      id: crypto.randomUUID(),
      createdAt: now(),
      reason,
      campaignCount: archive.campaigns.length,
      archive,
    }
    await db().backups.add(backup)
    const extra = await db()
      .backups.orderBy('createdAt')
      .reverse()
      .offset(MAX_BACKUPS)
      .primaryKeys()
    if (extra.length) await db().backups.bulkDelete(extra)
    return backup
  }

  return {
    create,

    /** Newest first, without their (heavy) content. */
    async list(): Promise<Omit<Backup, 'archive'>[]> {
      const all = await db().backups.orderBy('createdAt').reverse().toArray()
      return all.map(({ archive: _archive, ...rest }) => rest)
    },

    /** Takes a snapshot if the last one is old enough and there is something to keep. */
    async autoBackupIfDue(): Promise<Backup | null> {
      // Index only: reading the last backup itself would decrypt a whole archive.
      const lastAt = (await db().backups.orderBy('createdAt').lastKey()) as number | undefined
      if (lastAt !== undefined && now() - lastAt < AUTO_BACKUP_INTERVAL) return null
      if ((await db().campaigns.count()) === 0) return null
      return create('auto')
    },

    /** Replaces every campaign with the snapshot's, after a snapshot of the current state. */
    async restore(id: string): Promise<void> {
      const backup = await db().backups.get(id)
      if (!backup) throw new Error(`Backup ${id} not found`)
      await create('beforeRestore')
      // The online bookkeeping stays: the restored campaigns then reach the server like any edit.
      const tables = db().tables.filter((t) => !['backups', 'outbox', 'syncState'].includes(t.name))
      await db().transaction('rw', tables, async () => {
        for (const table of tables) await table.clear()
        for (const campaign of backup.archive.campaigns) await campaigns.importCampaign(campaign)
      })
    },
  }
}

export const backupService = createBackupService()
