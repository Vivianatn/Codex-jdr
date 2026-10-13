import { normalizeItem } from '@/domain/items'
import type { Item, LibraryItem } from '@/domain/types'
import { activeDb, type CodexDB } from './db'
import { compareText } from '@/lib/text'

/** Item templates of a campaign (SPEC §2.3, D-224). */
export function createItemLibrary(db: () => CodexDB = activeDb) {
  return {
    async list(campaignId: string): Promise<LibraryItem[]> {
      const all = await db().itemLibrary.where('campaignId').equals(campaignId).toArray()
      return all
        .map((i) => ({ ...normalizeItem(i), campaignId: i.campaignId }))
        .sort((a, b) => compareText(a.name, b.name))
    },
    async save(item: Item, campaignId: string): Promise<void> {
      await db().itemLibrary.put({ ...item, slot: null, quantity: 1, campaignId })
    },
    async remove(id: string): Promise<void> {
      await db().itemLibrary.delete(id)
    },
  }
}

export const itemLibrary = createItemLibrary()
