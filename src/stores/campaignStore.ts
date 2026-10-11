import { create } from 'zustand'
import { db } from '@/db/db'
import { normalizeEntityShape } from '@/domain/entity'
import { adoptSkills, syncEntitySkills, type SkillLibrary } from '@/domain/skills'
import type { Entity, Skill, SkillDefinition } from '@/domain/types'
import { createHistory, withHistory } from './history'

/**
 * In-memory state of the open campaign — the source of truth while it is open
 * (see DECISIONS D-008). Every change is undoable and auto-saved to IndexedDB.
 */

export type EntityMap = Record<string, Entity>

interface Tracked {
  entities: EntityMap
  /** Skill library of the campaign (D-218), undoable together with the characters. */
  skills: SkillLibrary
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
  /** Creates or edits a library skill and re-syncs every character holding it. */
  saveSkill: (def: SkillDefinition, label: string) => void
  /** Deletes a library skill and removes it from every character. */
  removeSkill: (id: string, label: string) => void
  /** Links loose skills (template, import) to the library, adding definitions as needed. */
  adoptLooseSkills: (skills: Skill[], label: string) => Skill[]
}

export const campaignHistory = createHistory<Tracked>({ limit: 200 })

export const useCampaignStore = create<CampaignDataState>()(
  withHistory(
    campaignHistory,
    { select: ({ entities, skills }) => ({ entities, skills }) },
    (set, get) => ({
      campaignId: null,
      status: 'idle',
      entities: {},
      skills: {},

      load: async (campaignId) => {
        if (get().campaignId === campaignId && get().status !== 'idle') return
        await flushAutosave()
        campaignHistory
          .getState()
          .untracked(() => set({ campaignId, status: 'loading', entities: {}, skills: {} }))
        const [list, defs] = await Promise.all([
          db.entities.where('campaignId').equals(campaignId).toArray(),
          db.skills.where('campaignId').equals(campaignId).toArray(),
        ])
        if (get().campaignId !== campaignId) return // another campaign was opened meanwhile
        const stored = Object.fromEntries(defs.map((d) => [d.id, d]))
        lastSaved = Object.fromEntries(list.map((e) => [e.id, e]))
        lastSavedSkills = stored
        // Older saves are upgraded in memory (shape, skills adopted into the library);
        // the next auto-save writes what changed.
        const adopted = adoptSkills(list.map(normalizeEntityShape), stored, campaignId)
        const entities = Object.fromEntries(adopted.entities.map((e) => [e.id, e]))
        const skills = { ...stored, ...Object.fromEntries(adopted.added.map((d) => [d.id, d])) }
        campaignHistory.getState().untracked(() => set({ status: 'ready', entities, skills }))
        campaignHistory.getState().clear()
      },

      unload: async () => {
        await flushAutosave()
        lastSaved = {}
        lastSavedSkills = {}
        campaignHistory
          .getState()
          .untracked(() => set({ campaignId: null, status: 'idle', entities: {}, skills: {} }))
        campaignHistory.getState().clear()
      },

      addEntities: (list, label) =>
        campaignHistory.getState().transaction(label, () =>
          set((s) => {
            // Skills of new characters always end up in the library.
            const adopted = adoptSkills(list, s.skills, s.campaignId ?? '')
            return {
              entities: {
                ...s.entities,
                ...Object.fromEntries(adopted.entities.map((e) => [e.id, e])),
              },
              skills: adopted.added.length
                ? { ...s.skills, ...Object.fromEntries(adopted.added.map((d) => [d.id, d])) }
                : s.skills,
            }
          }),
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
            // Familiars of a removed master become free (restored together by undo).
            for (const [key, e] of Object.entries(rest))
              if (e.kind === 'familiar' && e.details.ownerId === id)
                rest[key] = { ...e, details: { ...e.details, ownerId: null } }
            return { entities: rest }
          }),
        ),

      saveSkill: (def, label) =>
        campaignHistory.getState().transaction(label, () =>
          set((s) => {
            const saved = {
              ...def,
              campaignId: s.campaignId ?? def.campaignId,
              updatedAt: Date.now(),
            }
            const skills = { ...s.skills, [def.id]: saved }
            const entities = { ...s.entities }
            for (const [id, e] of Object.entries(s.entities)) {
              const next = syncEntitySkills(e, { [def.id]: saved })
              if (next !== e) entities[id] = { ...next, updatedAt: Date.now() }
            }
            return { skills, entities }
          }),
        ),

      removeSkill: (id, label) =>
        campaignHistory.getState().transaction(label, () =>
          set((s) => {
            if (!s.skills[id]) return s
            const { [id]: _removed, ...skills } = s.skills
            const entities = { ...s.entities }
            for (const [key, e] of Object.entries(s.entities))
              if (e.skills.some((k) => k.sourceId === id))
                entities[key] = { ...e, skills: e.skills.filter((k) => k.sourceId !== id) }
            return { skills, entities }
          }),
        ),

      adoptLooseSkills: (loose, label) => {
        const s = get()
        const holder = { skills: loose } as Entity
        const adopted = adoptSkills([holder], s.skills, s.campaignId ?? '')
        if (adopted.added.length)
          campaignHistory.getState().transaction(label, () =>
            set((state) => ({
              skills: {
                ...state.skills,
                ...Object.fromEntries(adopted.added.map((d) => [d.id, d])),
              },
            })),
          )
        return adopted.entities[0]!.skills
      },
    }),
  ),
)

// ---------------------------------------------------------------------------
// Autosave: diff by reference against what was last written, debounced.
// ---------------------------------------------------------------------------

const AUTOSAVE_DELAY = 250
let lastSaved: EntityMap = {}
let lastSavedSkills: SkillLibrary = {}
let timer: ReturnType<typeof setTimeout> | null = null
let pending: Promise<void> = Promise.resolve()

async function save(): Promise<void> {
  timer = null
  const { entities, skills, campaignId, status } = useCampaignStore.getState()
  if (!campaignId || status !== 'ready') return
  const previous = lastSaved
  const changed = Object.values(entities).filter((e) => previous[e.id] !== e)
  const removed = Object.keys(previous).filter((id) => !entities[id])
  const previousSkills = lastSavedSkills
  const changedSkills = Object.values(skills).filter((d) => previousSkills[d.id] !== d)
  const removedSkills = Object.keys(previousSkills).filter((id) => !skills[id])
  if (!changed.length && !removed.length && !changedSkills.length && !removedSkills.length) return
  lastSaved = entities
  lastSavedSkills = skills
  await db.transaction('rw', db.entities, db.skills, async () => {
    if (changed.length) await db.entities.bulkPut(changed)
    if (removed.length) await db.entities.bulkDelete(removed)
    if (changedSkills.length) await db.skills.bulkPut(changedSkills)
    if (removedSkills.length) await db.skills.bulkDelete(removedSkills)
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
  if (
    state.status === 'ready' &&
    (state.entities !== previous.entities || state.skills !== previous.skills)
  )
    schedule()
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
