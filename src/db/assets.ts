import { db as defaultDb, type CodexDB } from './db'
import type { Asset } from './types'

/** Pictures referenced by id (map backgrounds, mood images), written immediately. */
export function createAssetRepository(db: CodexDB = defaultDb) {
  return {
    get(id: string): Promise<Asset | undefined> {
      return db.assets.get(id)
    },
    async add(campaignId: string, data: string, name: string): Promise<Asset> {
      const asset: Asset = { id: crypto.randomUUID(), campaignId, data, name }
      await db.assets.add(asset)
      return asset
    },
    async remove(id: string): Promise<void> {
      await db.assets.delete(id)
    },
    list(campaignId: string): Promise<Asset[]> {
      return db.assets.where('campaignId').equals(campaignId).toArray()
    },
  }
}

export const assetRepository = createAssetRepository()
