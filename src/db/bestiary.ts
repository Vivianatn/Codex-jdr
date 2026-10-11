import type { EnemyTemplate } from '@/domain/types'
import { db as defaultDb, type CodexDB } from './db'

/** Enemy templates: a library shared by every campaign on this device. */
export function createBestiaryRepository(db: CodexDB = defaultDb, now: () => number = Date.now) {
  return {
    async list(): Promise<EnemyTemplate[]> {
      const all = await db.bestiary.toArray()
      return all.sort((a, b) => a.identity.pseudo.localeCompare(b.identity.pseudo, 'fr'))
    },
    get(id: string): Promise<EnemyTemplate | undefined> {
      return db.bestiary.get(id)
    },
    async save(template: EnemyTemplate): Promise<void> {
      await db.bestiary.put({ ...template, campaignId: '', updatedAt: now() })
    },
    async remove(id: string): Promise<void> {
      await db.bestiary.delete(id)
    },
  }
}

export const bestiaryRepository = createBestiaryRepository()
