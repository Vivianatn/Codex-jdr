import { normalizeEntityShape } from '@/domain/entity'
import type { EnemyTemplate } from '@/domain/types'
import { activeDb, type CodexDB } from './db'
import { compareText } from '@/lib/text'

/** Enemy templates of a campaign (D-224: everything belongs to its campaign). */
export function createBestiaryRepository(
  db: () => CodexDB = activeDb,
  now: () => number = Date.now,
) {
  return {
    async list(campaignId: string): Promise<EnemyTemplate[]> {
      const all = (await db().bestiary.where('campaignId').equals(campaignId).toArray()).map(
        normalizeEntityShape,
      )
      return all.sort((a, b) => compareText(a.identity.pseudo, b.identity.pseudo))
    },
    async get(id: string): Promise<EnemyTemplate | undefined> {
      const template = await db().bestiary.get(id)
      return template && normalizeEntityShape(template)
    },
    /** `template.campaignId` must be the campaign it belongs to. */
    async save(template: EnemyTemplate): Promise<void> {
      if (!template.campaignId) throw new Error('A template belongs to a campaign')
      await db().bestiary.put({ ...template, updatedAt: now() })
    },
    async remove(id: string): Promise<void> {
      await db().bestiary.delete(id)
    },
  }
}

export const bestiaryRepository = createBestiaryRepository()
