import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/db'
import { emptyLibrary, type Campaign } from '@/db/types'
import { createEntity } from '@/domain/entity'
import { isRevealed, newElement, newMap, type GameMap } from '@/domain/maps'
import type { Entity } from '@/domain/types'
import { getMessages } from '@/i18n'
import { configuredRules } from '@/test/fixtures'
import { campaignHistory, useCampaignStore } from '@/stores/campaignStore'
import { useRollStore } from '@/stores/rollStore'
import { createGameActions } from './gameActions'
import { createMapActions } from './mapActions'

const t = getMessages('fr')
const rules = configuredRules()
const campaign: Campaign = {
  id: 'c1',
  name: 'Test',
  description: '',
  rules,
  library: emptyLibrary(),
  createdAt: 0,
  updatedAt: 0,
  lastOpenedAt: null,
}

/** Loaded d20: each call shows exactly `face` (sequence repeats). */
function d20(...faces: number[]) {
  let i = 0
  return () => (faces[i++ % faces.length]! - 0.5) / 20
}

const store = () => useCampaignStore.getState()
const mapOf = (id: string) => store().maps[id]!
const hp = (id: string) => store().entities[id]!.hp.current

function character(kind: 'player' | 'enemy', name: string) {
  return createEntity(kind, 'c1', rules, {
    identity: { pseudo: name },
    hpRoll: 20,
    stats: {
      strength: 10,
      constitution: 10,
      dexterity: 10,
      intelligence: 10,
      charisma: 10,
      wisdom: 10,
      luck: 10,
    },
  })
}

async function setup(entities: Entity[], map: GameMap, faces: number[] = [10]) {
  await store().unload()
  await db.entities.clear()
  await db.maps.clear()
  await db.entities.bulkAdd(entities)
  await store().load('c1')
  useRollStore.setState({ campaignId: 'c1', rolls: [] })
  store().addMap(map, 'map')
  campaignHistory.getState().clear()
  const rng = d20(...faces)
  const game = createGameActions(t, campaign, rng)
  return createMapActions(t, campaign, game, rng)
}

beforeEach(() => campaignHistory.getState().clear())

describe('map actions', () => {
  it('places tokens without stacking them; enemies start hidden under fog', async () => {
    const a = character('player', 'Ayla')
    const b = character('player', 'Brann')
    const e = character('enemy', 'Gobelin')
    const map = newMap('c1', { name: 'Crypte', cols: 10, rows: 10 })
    map.fog.enabled = true
    const actions = await setup([a, b, e], map)
    actions.placeToken(map.id, a.id, { col: 3, row: 3 })
    actions.placeToken(map.id, b.id, { col: 3, row: 3 })
    actions.placeToken(map.id, e.id)
    const tokens = mapOf(map.id).tokens
    expect(tokens).toHaveLength(3)
    const cells = new Set(tokens.map((tk) => `${tk.col},${tk.row}`))
    expect(cells.size).toBe(3)
    expect(tokens.find((tk) => tk.entityId === a.id)).toMatchObject({ col: 3, row: 3 })
    expect(tokens.find((tk) => tk.entityId === e.id)!.hidden).toBe(true)
    expect(tokens.find((tk) => tk.entityId === a.id)!.hidden).toBe(false)
  })

  it('moving a player token reveals the fog around it (when auto-reveal is on), in one undo step', async () => {
    const a = character('player', 'Ayla')
    const map = newMap('c1', { name: 'Crypte', cols: 20, rows: 20 })
    map.fog.enabled = true
    map.vision = { autoReveal: true, radius: 2, wallsBlockSight: true }
    const actions = await setup([a], map)
    actions.placeToken(map.id, a.id, { col: 2, row: 2 })
    expect(isRevealed(mapOf(map.id), { col: 2, row: 2 })).toBe(true)
    expect(isRevealed(mapOf(map.id), { col: 15, row: 15 })).toBe(false)
    const token = mapOf(map.id).tokens[0]!
    actions.moveToken(map.id, token.id, { col: 15, row: 15 })
    expect(isRevealed(mapOf(map.id), { col: 15, row: 15 })).toBe(true)
    campaignHistory.getState().undo()
    expect(mapOf(map.id).tokens[0]).toMatchObject({ col: 2, row: 2 })
    expect(isRevealed(mapOf(map.id), { col: 15, row: 15 })).toBe(false)
  })

  it('does not reveal anything while auto-reveal is off (Codex imposes nothing)', async () => {
    const a = character('player', 'Ayla')
    const map = newMap('c1', { name: 'Crypte', cols: 10, rows: 10 })
    map.fog.enabled = true
    const actions = await setup([a], map)
    actions.placeToken(map.id, a.id, { col: 2, row: 2 })
    expect(mapOf(map.id).fog.revealed).not.toContain('1')
  })

  it('a locked door does not open; a successful lockpick unlocks it', async () => {
    const a = character('player', 'Ayla')
    const map = newMap('c1', { name: 'Crypte', cols: 10, rows: 10 })
    map.walls.push({
      id: 'door',
      x1: 64,
      y1: 0,
      x2: 64,
      y2: 64,
      kind: 'door',
      door: { open: false, locked: true, difficulty: 3 },
    })
    const actions = await setup([a], map, [1])
    actions.toggleDoor(map.id, 'door')
    expect(mapOf(map.id).walls[0]!.door!.open).toBe(false)
    const result = actions.pickLock(map.id, 'door', a.id)
    expect(result?.check.outcome.success).toBe(true)
    expect(mapOf(map.id).walls[0]!.door!.locked).toBe(false)
    actions.toggleDoor(map.id, 'door')
    expect(mapOf(map.id).walls[0]!.door!.open).toBe(true)
  })

  it('group perception spots a trap on a success, not on a failure', async () => {
    const a = character('player', 'Ayla')
    const map = newMap('c1', { name: 'Crypte', cols: 10, rows: 10 })
    map.elements.push(newElement('trap', { col: 4, row: 4 }, { id: 'trap' }))
    map.tokens.push({ id: 'tk', entityId: a.id, col: 1, row: 1, size: 1, hidden: false })
    let actions = await setup([a], map, [20])
    expect(actions.groupPerception(map.id)).toEqual([])
    expect(mapOf(map.id).elements[0]!.trap!.detected).toBe(false)
    actions = await setup([a], map, [1])
    expect(actions.groupPerception(map.id)).toEqual(['trap'])
    expect(mapOf(map.id).elements[0]).toMatchObject({ hidden: false, trap: { detected: true } })
  })

  it('a triggered trap hurts the tokens standing on it, once undoable', async () => {
    const a = character('player', 'Ayla')
    const b = character('player', 'Brann')
    const map = newMap('c1', { name: 'Crypte', cols: 10, rows: 10 })
    map.elements.push(
      newElement(
        'trap',
        { col: 4, row: 4 },
        {
          id: 'trap',
          trap: {
            difficulty: 0,
            detected: false,
            triggered: false,
            effect: { kind: 'damage', expression: '5', conditionId: null },
          },
        },
      ),
    )
    map.tokens.push({ id: 'ta', entityId: a.id, col: 4, row: 4, size: 1, hidden: false })
    map.tokens.push({ id: 'tb', entityId: b.id, col: 0, row: 0, size: 1, hidden: false })
    const actions = await setup([a, b], map)
    const before = hp(a.id)
    actions.triggerTrap(map.id, 'trap')
    expect(hp(a.id)).toBe(before - 5)
    expect(hp(b.id)).toBe(before)
    expect(mapOf(map.id).elements[0]!.trap!.triggered).toBe(true)
    campaignHistory.getState().undo()
    expect(hp(a.id)).toBe(before)
    expect(mapOf(map.id).elements[0]!.trap!.triggered).toBe(false)
  })

  it('area damage: one roll, half for those who pass the save', async () => {
    const a = character('player', 'Ayla')
    const map = newMap('c1', { name: 'Crypte', cols: 10, rows: 10 })
    map.tokens.push({ id: 'ta', entityId: a.id, col: 2, row: 2, size: 1, hidden: false })
    const actions = await setup([a], map, [1])
    const targets = actions.areaTargets(map.id, {
      kind: 'circle',
      center: { x: 160, y: 160 },
      radius: 64,
    })
    expect(targets).toEqual([a.id])
    const before = hp(a.id)
    actions.areaHp(targets, { kind: 'damage', expression: '7', save: 'dexterity', label: 'Boule' })
    expect(hp(a.id)).toBe(before - 3)
  })
})
