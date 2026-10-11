import { normalizeItem } from '@/domain/items'
import type { Item, LibraryItem } from '@/domain/types'
import { db as defaultDb, type CodexDB } from './db'

/** Item templates of a campaign (SPEC §2.3, D-224). */
export function createItemLibrary(db: CodexDB = defaultDb) {
  return {
    async list(campaignId: string): Promise<LibraryItem[]> {
      const all = await db.itemLibrary.where('campaignId').equals(campaignId).toArray()
      return all
        .map((i) => ({ ...normalizeItem(i), campaignId: i.campaignId }))
        .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    },
    async save(item: Item, campaignId: string): Promise<void> {
      await db.itemLibrary.put({ ...item, slot: null, quantity: 1, campaignId })
    },
    async remove(id: string): Promise<void> {
      await db.itemLibrary.delete(id)
    },
  }
}

export const itemLibrary = createItemLibrary()
