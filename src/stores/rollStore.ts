import { create } from 'zustand'
import { activeDb } from '@/db/db'
import { ROLL_HISTORY_LIMIT, type RollRecord } from '@/domain/rolls'

export type NewRoll = Omit<RollRecord, 'id' | 'campaignId' | 'at'>

interface RollState {
  campaignId: string | null
  /** Oldest first. */
  rolls: RollRecord[]
  load: (campaignId: string) => Promise<void>
  /** Records a roll (persisted right away; rolls are facts, not undoable). */
  add: (roll: NewRoll) => RollRecord
  clear: () => Promise<void>
}

/** Dice history of the open campaign (SPEC §7). */
export const useRollStore = create<RollState>()((set, get) => ({
  campaignId: null,
  rolls: [],

  load: async (campaignId) => {
    if (get().campaignId === campaignId) return
    set({ campaignId, rolls: [] })
    const rolls = await activeDb()
      .rolls.where('[campaignId+at]')
      .between([campaignId, 0], [campaignId, Infinity])
      .toArray()
    if (get().campaignId === campaignId) set({ rolls })
  },

  add: (input) => {
    const campaignId = get().campaignId ?? ''
    const record: RollRecord = { ...input, id: crypto.randomUUID(), campaignId, at: Date.now() }
    const rolls = [...get().rolls, record]
    const overflow = rolls.length - ROLL_HISTORY_LIMIT
    const dropped = overflow > 0 ? rolls.slice(0, overflow).map((r) => r.id) : []
    set({ rolls: overflow > 0 ? rolls.slice(overflow) : rolls })
    if (campaignId) {
      const db = activeDb()
      void db
        .transaction('rw', db.rolls, async () => {
          await db.rolls.add(record)
          if (dropped.length) await db.rolls.bulkDelete(dropped)
        })
        .catch((error) => console.error('Roll not saved', error))
    }
    return record
  },

  clear: async () => {
    const { campaignId } = get()
    set({ rolls: [] })
    if (campaignId) await activeDb().rolls.where('campaignId').equals(campaignId).delete()
  },
}))
