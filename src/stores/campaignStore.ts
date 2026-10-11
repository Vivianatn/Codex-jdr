import { create } from 'zustand'
import { db } from '@/db/db'
import type { Entity } from '@/domain/types'
import { createHistory, withHistory } from './history'

/**
 * In-memory state of the open campaign — the source of truth while it is open
 * (see DECISIONS D-008). Every change is undoable and auto-saved to IndexedDB.
 */

export type EntityMap = Record<string, Entity>

interface Tracked {
  entities: EntityMap
}

export interface CampaignDataState extends Tracked {
  campaignId: string | null
  status: 'idle' | 'loading' | 'ready'
  load: (campaignId: string) => Promise<void>
  unload: () => Promise<void>
  addEntities: (entities: Entity[], label: string) => void
  /** `recipe` returns the new entity; `updatedAt` is stamped automatically. */
  updateEntity: (id: string, recipe: (entity: Entity) => Entity, label: string) => void
  removeEntity: (id: string, label: string) => void
}

export const campaignHistory = createHistory<Tracked>({ limit: 200 })

export const useCampaignStore = create<CampaignDataState>()(
  withHistory(campaignHistory, { select: ({ entities }) => ({ entities }) }, (set, get) => ({
    campaignId: null,
    status: 'idle',
    entities: {},

    load: async (campaignId) => {
      if (get().campaignId === campaignId && get().status !== 'idle') return
      await flushAutosave()
      campaignHistory
        .getState()
        .untracked(() => set({ campaignId, status: 'loading', entities: {} }))
      const list = await db.entities.where('campaignId').equals(campaignId).toArray()
      if (get().campaignId !== campaignId) return // another campaign was opened meanwhile
      const entities = Object.fromEntries(list.map((e) => [e.id, e]))
      lastSaved = entities
      campaignHistory.getState().untracked(() => set({ status: 'ready', entities }))
      campaignHistory.getState().clear()
    },

    unload: async () => {
      await flushAutosave()
      lastSaved = {}
      campaignHistory
        .getState()
        .untracked(() => set({ campaignId: null, status: 'idle', entities: {} }))
      campaignHistory.getState().clear()
    },

    addEntities: (list, label) =>
      campaignHistory.getState().transaction(label, () =>
        set((s) => ({
          entities: { ...s.entities, ...Object.fromEntries(list.map((e) => [e.id, e])) },
        })),
      ),

    updateEntity: (id, recipe, label) =>
      campaignHistory.getState().transaction(label, () =>
        set((s) => {
          const current = s.entities[id]
          if (!current) return s
          const next = recipe(current)
          if (next === current) return s
          return { entities: { ...s.entities, [id]: { ...next, updatedAt: Date.now() } } }
        }),
      ),

    removeEntity: (id, label) =>
      campaignHistory.getState().transaction(label, () =>
        set((s) => {
          if (!s.entities[id]) return s
          const { [id]: _removed, ...rest } = s.entities
          return { entities: rest }
        }),
      ),
  })),
)

// ---------------------------------------------------------------------------
// Autosave: diff by reference against what was last written, debounced.
// ---------------------------------------------------------------------------

const AUTOSAVE_DELAY = 250
let lastSaved: EntityMap = {}
let timer: ReturnType<typeof setTimeout> | null = null
let pending: Promise<void> = Promise.resolve()

async function save(): Promise<void> {
  timer = null
  const { entities, campaignId, status } = useCampaignStore.getState()
  if (!campaignId || status !== 'ready') return
  const previous = lastSaved
  const changed = Object.values(entities).filter((e) => previous[e.id] !== e)
  const removed = Object.keys(previous).filter((id) => !entities[id])
  if (!changed.length && !removed.length) return
  lastSaved = entities
  await db.transaction('rw', db.entities, async () => {
    if (changed.length) await db.entities.bulkPut(changed)
    if (removed.length) await db.entities.bulkDelete(removed)
  })
}

function schedule() {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    pending = pending.then(save).catch((error) => console.error('Autosave failed', error))
  }, AUTOSAVE_DELAY)
}

/** Writes pending changes now (before export, campaign switch, page hide…). */
export async function flushAutosave(): Promise<void> {
  if (timer) {
    clearTimeout(timer)
    timer = null
    pending = pending.then(save).catch((error) => console.error('Autosave failed', error))
  }
  await pending
}

useCampaignStore.subscribe((state, previous) => {
  if (state.status === 'ready' && state.entities !== previous.entities) schedule()
})

if (typeof window !== 'undefined') {
  const flushNow = () => void flushAutosave()
  window.addEventListener('pagehide', flushNow)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushNow()
  })
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export function selectEntitiesOfKinds(entities: EntityMap, kinds: readonly Entity['kind'][]) {
  return Object.values(entities)
    .filter((e) => kinds.includes(e.kind))
    .sort((a, b) => a.createdAt - b.createdAt)
}
