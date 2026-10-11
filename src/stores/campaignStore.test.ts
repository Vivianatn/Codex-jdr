import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/db'
import { createEntity } from '@/domain/entity'
import { defaultRules } from '@/rules'
import { campaignHistory, flushAutosave, useCampaignStore } from './campaignStore'

const rules = defaultRules()
const store = () => useCampaignStore.getState()

beforeEach(async () => {
  await store().unload()
  await db.entities.clear()
})

afterEach(async () => {
  await store().unload()
})

describe('campaign store', () => {
  it('loads only the entities of the campaign', async () => {
    await db.entities.bulkAdd([
      createEntity('player', 'c1', rules, { identity: { pseudo: 'A' } }),
      createEntity('player', 'c2', rules, { identity: { pseudo: 'B' } }),
    ])
    await store().load('c1')
    expect(store().status).toBe('ready')
    expect(Object.values(store().entities).map((e) => e.identity.pseudo)).toEqual(['A'])
    expect(campaignHistory.getState().canUndo).toBe(false)
  })

  it('auto-saves additions, updates and removals', async () => {
    await store().load('c1')
    const e = createEntity('player', 'c1', rules, { identity: { pseudo: 'Gorak' } })
    store().addEntities([e], 'Création')
    await flushAutosave()
    expect(await db.entities.get(e.id)).toMatchObject({ identity: { pseudo: 'Gorak' } })

    store().updateEntity(e.id, (x) => ({ ...x, level: 3 }), 'Niveau')
    await flushAutosave()
    expect((await db.entities.get(e.id))?.level).toBe(3)

    store().removeEntity(e.id, 'Suppression')
    await flushAutosave()
    expect(await db.entities.get(e.id)).toBeUndefined()
  })

  it('undo restores the previous entity and saves it', async () => {
    await store().load('c1')
    const e = createEntity('enemy', 'c1', rules)
    store().addEntities([e], 'Création')
    store().updateEntity(e.id, (x) => ({ ...x, level: 5 }), 'Niveau 5')
    expect(campaignHistory.getState().past.at(-1)?.label).toBe('Niveau 5')

    campaignHistory.getState().undo()
    expect(store().entities[e.id]?.level).toBe(1)
    await flushAutosave()
    expect((await db.entities.get(e.id))?.level).toBe(1)

    campaignHistory.getState().undo()
    expect(store().entities[e.id]).toBeUndefined()
    await flushAutosave()
    expect(await db.entities.get(e.id)).toBeUndefined()
  })

  it('ignores recipes that return the same entity', async () => {
    await store().load('c1')
    const e = createEntity('ally', 'c1', rules)
    store().addEntities([e], 'Création')
    store().updateEntity(e.id, (x) => x, 'Rien')
    expect(campaignHistory.getState().past).toHaveLength(1)
  })

  it('flushes pending changes before switching campaign', async () => {
    await store().load('c1')
    const e = createEntity('player', 'c1', rules)
    store().addEntities([e], 'Création')
    await store().load('c2')
    expect(await db.entities.get(e.id)).toBeDefined()
    expect(store().entities).toEqual({})
  })
})
