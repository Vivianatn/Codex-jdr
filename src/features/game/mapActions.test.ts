import { beforeEach, describe, expect, it } from 'vitest'
import { activeDb } from '@/db/db'
import { emptyLibrary, type Campaign } from '@/db/types'
import { createEntity } from '@/domain/entity'
import { isRevealed, newElement, newMap, type GameMap } from '@/domain/maps'
import { withOwner } from '@/domain/familiars'
import { addGroup, addMember } from '@/domain/turns'
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
  await activeDb().entities.clear()
  await activeDb().maps.clear()
  await activeDb().entities.bulkAdd(entities)
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

describe('passages (D-256)', () => {
  it('a token stepping on a passage goes alone to the other map, in one undo step', async () => {
    const a = character('player', 'Ayla')
    const b = character('player', 'Brann')
    const hall = newMap('c1', { name: 'Hall', cols: 10, rows: 10 })
    const cellar = newMap('c1', { name: 'Cave', cols: 10, rows: 10 })
    hall.elements = [newElement('link', { col: 5, row: 5 }, { link: { mapId: cellar.id } })]
    cellar.elements = [newElement('link', { col: 2, row: 2 }, { link: { mapId: hall.id } })]
    const actions = await setup([a, b], hall)
    store().addMap(cellar, 'map')
    store().updatePlay((p) => ({ ...p, mapId: hall.id }), 'play')
    actions.placeToken(hall.id, a.id, { col: 4, row: 5 })
    actions.placeToken(hall.id, b.id, { col: 0, row: 0 })
    campaignHistory.getState().clear()

    const token = mapOf(hall.id).tokens.find((tk) => tk.entityId === a.id)!
    actions.moveToken(hall.id, token.id, { col: 5, row: 5 })

    expect(mapOf(hall.id).tokens.map((tk) => tk.entityId)).toEqual([b.id])
    const arrived = mapOf(cellar.id).tokens.find((tk) => tk.entityId === a.id)!
    expect(Math.max(Math.abs(arrived.col - 2), Math.abs(arrived.row - 2))).toBe(1)
    // The GM's board stays on the hall.
    expect(store().play.mapId).toBe(hall.id)
    expect(campaignHistory.getState().past.map((e) => e.label)).toEqual([
      t.maps.wentThrough('Ayla', 'Cave'),
    ])

    campaignHistory.getState().undo()
    expect(mapOf(hall.id).tokens).toHaveLength(2)
    expect(mapOf(cellar.id).tokens).toHaveLength(0)
  })
})

describe('the GM’s board in play (D-269)', () => {
  function crew() {
    const lyra = character('player', 'Lyra')
    const ogre = character('enemy', 'Ogre')
    const owl = withOwner(
      createEntity('familiar', 'c1', rules, { identity: { pseudo: 'Hibou' } }),
      lyra.id,
    )
    const wolf = withOwner(
      createEntity('familiar', 'c1', rules, { identity: { pseudo: 'Loup' } }),
      ogre.id,
    )
    const map = newMap('c1', { name: 'Crypte', cols: 10, rows: 10 })
    map.tokens = [
      { id: 'tk-lyra', entityId: lyra.id, col: 2, row: 2, size: 1, hidden: false },
      { id: 'tk-owl', entityId: owl.id, col: 3, row: 2, size: 1, hidden: false },
      { id: 'tk-ogre', entityId: ogre.id, col: 7, row: 7, size: 1, hidden: false },
      { id: 'tk-wolf', entityId: wolf.id, col: 7, row: 8, size: 1, hidden: false },
    ]
    return { lyra, ogre, owl, wolf, map }
  }
  const labels = () => campaignHistory.getState().past.map((e) => e.label)

  it('takes a player character off the board with its familiar and out of the turns, never deleting it', async () => {
    const { lyra, ogre, owl, wolf, map } = crew()
    const actions = await setup([lyra, ogre, owl, wolf], map)
    store().updatePlay((p) => addMember(addGroup(p, 'Héros', 'h'), 'h', lyra.id), 'groups')
    campaignHistory.getState().clear()

    actions.removeFromBoard(lyra.id, { fromTurns: true })
    expect(mapOf(map.id).tokens.map((tk) => tk.id)).toEqual(['tk-ogre', 'tk-wolf'])
    expect(store().play.groups[0]!.memberIds).toEqual([])
    expect(store().entities[lyra.id]).toBeDefined()
    expect(labels()).toEqual([t.crew.removedFromBoard('Lyra')])

    campaignHistory.getState().undo()
    expect(mapOf(map.id).tokens).toHaveLength(4)
    expect(store().play.groups[0]!.memberIds).toEqual([lyra.id])
  })

  it('keeps the character in the turns unless asked', async () => {
    const { lyra, ogre, owl, wolf, map } = crew()
    const actions = await setup([lyra, ogre, owl, wolf], map)
    store().updatePlay((p) => addMember(addGroup(p, 'Héros', 'h'), 'h', lyra.id), 'groups')
    actions.removeFromBoard(lyra.id)
    expect(store().play.groups[0]!.memberIds).toEqual([lyra.id])
  })

  it('deletes an enemy everywhere in one undoable step, its familiar leaving the board', async () => {
    const { lyra, ogre, owl, wolf, map } = crew()
    const actions = await setup([lyra, ogre, owl, wolf], map)
    store().updatePlay((p) => addMember(addGroup(p, 'Monstres', 'm'), 'm', ogre.id), 'groups')
    campaignHistory.getState().clear()

    actions.deleteEnemy(ogre.id)
    expect(store().entities[ogre.id]).toBeUndefined()
    expect(store().entities[wolf.id]).toBeDefined()
    expect(mapOf(map.id).tokens.map((tk) => tk.id)).toEqual(['tk-lyra', 'tk-owl'])
    expect(store().play.groups[0]!.memberIds).toEqual([])
    expect(labels()).toEqual([t.crew.enemyDeleted('Ogre')])

    campaignHistory.getState().undo()
    expect(store().entities[ogre.id]).toBeDefined()
    expect(mapOf(map.id).tokens).toHaveLength(4)
    expect(store().play.groups[0]!.memberIds).toEqual([ogre.id])
  })

  it('never deletes a player character as an enemy', async () => {
    const { lyra, ogre, owl, wolf, map } = crew()
    const actions = await setup([lyra, ogre, owl, wolf], map)
    actions.deleteEnemy(lyra.id)
    expect(store().entities[lyra.id]).toBeDefined()
  })

  it('brings a familiar next to its master, sharing its turn', async () => {
    const { lyra, ogre, owl, wolf, map } = crew()
    map.tokens = map.tokens.filter((tk) => tk.id !== 'tk-owl' && tk.id !== 'tk-wolf')
    map.tokens[1] = { ...map.tokens[1]!, hidden: true } // a hidden ogre
    const actions = await setup([lyra, ogre, owl, wolf], map)
    store().updatePlay((p) => addMember(addGroup(p, 'Tous', 'g'), 'g', owl.id), 'groups')
    campaignHistory.getState().clear()

    actions.addFamiliar(map.id, owl.id)
    const placed = mapOf(map.id).tokens.find((tk) => tk.entityId === owl.id)!
    expect(Math.max(Math.abs(placed.col - 2), Math.abs(placed.row - 2))).toBe(1)
    expect(placed.hidden).toBe(false)
    expect(store().play.groups[0]!.memberIds).toEqual([])
    expect(labels()).toEqual([t.crew.familiarPlaced('Hibou', 'Lyra')])

    actions.addFamiliar(map.id, wolf.id)
    expect(mapOf(map.id).tokens.find((tk) => tk.entityId === wolf.id)!.hidden).toBe(true)

    campaignHistory.getState().undo()
    campaignHistory.getState().undo()
    expect(mapOf(map.id).tokens).toHaveLength(2)
    expect(store().play.groups[0]!.memberIds).toEqual([owl.id])
  })

  it('refuses a free familiar', async () => {
    const { lyra, map } = crew()
    const stray = createEntity('familiar', 'c1', rules)
    map.tokens = []
    const actions = await setup([lyra, stray], map)
    actions.addFamiliar(map.id, stray.id)
    expect(mapOf(map.id).tokens).toHaveLength(0)
  })
})

describe('teleportation by the GM (D-276)', () => {
  const crew = () => {
    const lyra = character('player', 'Lyra')
    const gorak = character('player', 'Gorak')
    const owl = withOwner(
      createEntity('familiar', 'c1', rules, { identity: { pseudo: 'Chouette' } }),
      lyra.id,
    )
    const hall = newMap('c1', { name: 'Hall', cols: 10, rows: 10 })
    hall.tokens = [
      { id: 'tk-lyra', entityId: lyra.id, col: 2, row: 2, size: 1, hidden: false },
      { id: 'tk-owl', entityId: owl.id, col: 3, row: 2, size: 1, hidden: false },
      { id: 'tk-gorak', entityId: gorak.id, col: 5, row: 5, size: 1, hidden: false },
    ]
    const crypt = newMap('c1', { name: 'Crypte', cols: 10, rows: 10 })
    crypt.fog.enabled = true
    crypt.vision = { autoReveal: true, radius: 2, wallsBlockSight: true }
    return { lyra, gorak, owl, hall, crypt }
  }
  const labels = () => campaignHistory.getState().past.map((e) => e.label)

  it('sends characters and their familiars in ONE undoable step, revealing the fog', async () => {
    const { lyra, gorak, owl, hall, crypt } = crew()
    const actions = await setup([lyra, gorak, owl], hall)
    store().addMap(crypt, 'map')
    campaignHistory.getState().clear()

    actions.teleportCharacters([
      { entityId: lyra.id, toMapId: crypt.id },
      { entityId: gorak.id, toMapId: crypt.id },
    ])
    expect(mapOf(hall.id).tokens).toEqual([])
    expect(mapOf(crypt.id).tokens.map((tk) => tk.id)).toEqual(['tk-lyra', 'tk-owl', 'tk-gorak'])
    const at = mapOf(crypt.id).tokens[0]!
    expect(isRevealed(mapOf(crypt.id), at)).toBe(true)
    expect(labels()).toEqual([t.teleport.done('Lyra et Gorak', 2, 'Crypte')])

    campaignHistory.getState().undo()
    expect(mapOf(hall.id).tokens).toHaveLength(3)
    expect(mapOf(crypt.id).tokens).toEqual([])
  })

  it('leaves the familiars behind when asked, and sends each to its own map', async () => {
    const { lyra, gorak, owl, hall, crypt } = crew()
    const cave = newMap('c1', { name: 'Cave', cols: 10, rows: 10 })
    const actions = await setup([lyra, gorak, owl], hall)
    store().addMap(crypt, 'map')
    store().addMap(cave, 'map')
    campaignHistory.getState().clear()

    actions.teleportCharacters(
      [
        { entityId: lyra.id, toMapId: crypt.id },
        { entityId: gorak.id, toMapId: cave.id },
      ],
      { familiarsFollow: false },
    )
    expect(mapOf(hall.id).tokens.map((tk) => tk.id)).toEqual(['tk-owl'])
    expect(mapOf(crypt.id).tokens.map((tk) => tk.id)).toEqual(['tk-lyra'])
    expect(mapOf(cave.id).tokens.map((tk) => tk.id)).toEqual(['tk-gorak'])
    expect(labels()).toEqual([t.teleport.doneMany(2)])
  })
})
