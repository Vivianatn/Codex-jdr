import { normalizeEntityShape } from '@/domain/entity'
import type { EnemyTemplate } from '@/domain/types'
import { db as defaultDb, type CodexDB } from './db'

/** Enemy templates: a library shared by every campaign on this device. */
export function createBestiaryRepository(db: CodexDB = defaultDb, now: () => number = Date.now) {
  return {
    async list(): Promise<EnemyTemplate[]> {
      const all = (await db.bestiary.toArray()).map(normalizeEntityShape)
      return all.sort((a, b) => a.identity.pseudo.localeCompare(b.identity.pseudo, 'fr'))
    },
    async get(id: string): Promise<EnemyTemplate | undefined> {
      const template = await db.bestiary.get(id)
      return template && normalizeEntityShape(template)
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
