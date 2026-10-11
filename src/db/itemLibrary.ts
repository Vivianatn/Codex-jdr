import { normalizeItem } from '@/domain/items'
import type { Item } from '@/domain/types'
import { db as defaultDb, type CodexDB } from './db'

/** Item templates: a library shared by every campaign on this device (SPEC §2.3). */
export function createItemLibrary(db: CodexDB = defaultDb) {
  return {
    async list(): Promise<Item[]> {
      const all = (await db.itemLibrary.toArray()).map(normalizeItem)
      return all.sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    },
    async save(item: Item): Promise<void> {
      await db.itemLibrary.put({ ...item, slot: null, quantity: 1 })
    },
    async remove(id: string): Promise<void> {
      await db.itemLibrary.delete(id)
    },
  }
}

export const itemLibrary = createItemLibrary()
