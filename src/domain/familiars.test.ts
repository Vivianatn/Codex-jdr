import { describe, expect, it } from 'vitest'
import { defaultRules } from '@/rules'
import { createEntity } from './entity'
import {
  attachedFamiliarIds,
  controlledBy,
  familiarSpot,
  masterOf,
  playableFamiliars,
  withFollowingFamiliars,
  withOwner,
} from './familiars'
import { newElement, newMap, type GameMap, type Token } from './maps'
import {
  addGroup,
  addMember,
  emptyPlayState,
  nextTurn,
  startTurns,
  turnActors,
  withoutAttachedFamiliars,
} from './turns'

const rules = defaultRules()
const named = <K extends 'player' | 'enemy' | 'ally' | 'familiar'>(kind: K, pseudo: string) =>
  createEntity(kind, 'c1', rules, { identity: { pseudo } })

function world() {
  const lyra = named('player', 'Lyra')
  const gorak = named('player', 'Gorak')
  const ogre = named('enemy', 'Ogre')
  const guard = named('ally', 'Garde')
  const owl = withOwner(named('familiar', 'Hibou'), lyra.id)
  const wolf = withOwner(named('familiar', 'Loup'), ogre.id)
  const dog = withOwner(named('familiar', 'Chien'), guard.id)
  const stray = named('familiar', 'Chat errant')
  const orphan = withOwner(named('familiar', 'Orphelin'), 'gone')
  return { lyra, gorak, ogre, guard, owl, wolf, dog, stray, orphan }
}

describe('familiars share their master’s turn (D-269)', () => {
  it('knows which familiars are attached to an existing master', () => {
    const w = world()
    const all = Object.values(w)
    expect(masterOf(all, w.owl)).toBe(w.lyra)
    expect(masterOf(all, w.stray)).toBeNull()
    expect(masterOf(all, w.orphan)).toBeNull()
    expect(masterOf(all, w.lyra)).toBeNull()
    expect([...attachedFamiliarIds(all)].sort()).toEqual([w.owl.id, w.wolf.id, w.dog.id].sort())
  })

  it('the active character acts with its familiars', () => {
    const w = world()
    const all = Object.values(w)
    let s = addGroup(emptyPlayState(), 'Héros', 'heroes')
    s = addMember(s, 'heroes', w.lyra.id)
    s = addMember(s, 'heroes', w.gorak.id)
    s = startTurns(s)
    expect(turnActors(s, all)).toEqual([w.lyra.id, w.owl.id])
    s = { ...s, turn: nextTurn(s).turn }
    expect(turnActors(s, all)).toEqual([w.gorak.id])
    expect(turnActors(emptyPlayState(), all)).toEqual([])
  })

  it('a familiar the GM set to act on its own keeps its own turn', () => {
    const w = world()
    const owl = { ...w.owl, details: { ...w.owl.details, actsOnOwnerTurn: false } }
    const all = [...Object.values(w).filter((e) => e.id !== owl.id), owl]
    expect(attachedFamiliarIds(all).has(owl.id)).toBe(false)
    let s = addGroup(emptyPlayState(), 'Tous', 'all')
    s = addMember(s, 'all', w.lyra.id)
    s = addMember(s, 'all', owl.id)
    s = startTurns(s)
    expect(turnActors(s, all)).toEqual([w.lyra.id])
    expect(withoutAttachedFamiliars(s, all)).toBe(s)
    // The player still rolls for it.
    expect(controlledBy(all, [w.lyra.id]).has(owl.id)).toBe(true)
  })

  it('drops attached familiars from the groups, handing the turn on', () => {
    const w = world()
    const all = Object.values(w)
    let s = addGroup(emptyPlayState(), 'Tous', 'all')
    s = addMember(s, 'all', w.owl.id)
    s = addMember(s, 'all', w.lyra.id)
    s = addMember(s, 'all', w.stray.id)
    s = startTurns(s) // the owl was first
    const cleaned = withoutAttachedFamiliars(s, all)
    expect(cleaned.groups[0]!.memberIds).toEqual([w.lyra.id, w.stray.id])
    expect(cleaned.turn).toMatchObject({ status: 'playing', memberId: w.lyra.id })
    // Nothing to drop: same state.
    expect(withoutAttachedFamiliars(cleaned, all)).toBe(cleaned)
  })
})

describe('who rolls the dice (D-269)', () => {
  it('a player controls their character and its familiars, nothing else', () => {
    const w = world()
    const all = Object.values(w)
    expect([...controlledBy(all, [w.lyra.id])].sort()).toEqual([w.lyra.id, w.owl.id].sort())
    expect([...controlledBy(all, [w.gorak.id])]).toEqual([w.gorak.id])
    expect([...controlledBy(all, [])]).toEqual([])
  })
})

describe('adding familiars in play (D-269)', () => {
  it('lists only the familiars of player characters and enemies, by master', () => {
    const w = world()
    const choices = playableFamiliars(Object.values(w))
    expect(choices.map((c) => c.master.id)).toEqual([w.lyra.id, w.ogre.id])
    expect(choices.map((c) => c.familiars.map((f) => f.id))).toEqual([[w.owl.id], [w.wolf.id]])
  })

  function board(): { map: GameMap; master: Token } {
    const map = newMap('c1', { name: 'Crypte', cols: 6, rows: 6 })
    const master: Token = { id: 'm', entityId: 'master', col: 2, row: 2, size: 1, hidden: false }
    return { map: { ...map, tokens: [master] }, master }
  }

  it('places a familiar on a free cell next to its master', () => {
    const { map, master } = board()
    const cell = familiarSpot(map, master, 'fam')!
    expect(Math.max(Math.abs(cell.col - 2), Math.abs(cell.row - 2))).toBe(1)
  })

  it('skips taken cells, walls, passages and the map’s edge', () => {
    const { map, master } = board()
    const size = map.grid.size
    // Master in the corner; the cell to its right holds a token, the one below a passage,
    // and a wall closes the diagonal.
    const corner = { ...master, col: 0, row: 0 }
    const crowded: GameMap = {
      ...map,
      tokens: [corner, { ...corner, id: 'o', entityId: 'other', col: 1, row: 0 }],
      elements: [{ ...newElement('link', { col: 0, row: 1 }), link: { mapId: 'x' } }],
      walls: [{ id: 'w', x1: size, y1: size * 0.75, x2: size, y2: size * 2, kind: 'wall' }],
    }
    const cell = familiarSpot(crowded, corner, 'fam')!
    expect(cell).not.toEqual({ col: 1, row: 0 })
    expect(cell).not.toEqual({ col: 0, row: 1 })
    expect(cell).not.toEqual({ col: 1, row: 1 })
    expect(cell.col >= 0 && cell.row >= 0).toBe(true)
  })

  it('finds nothing on a board with no room', () => {
    const map = newMap('c1', { name: 'Placard', cols: 1, rows: 1 })
    const master: Token = { id: 'm', entityId: 'master', col: 0, row: 0, size: 1, hidden: false }
    expect(familiarSpot({ ...map, tokens: [master] }, master, 'fam')).toBeNull()
  })
})

describe('familiars follow a teleported master (D-276)', () => {
  it('adds the attached familiars on the board right after their master', () => {
    const lyra = named('player', 'Lyra')
    const owl = withOwner(named('familiar', 'Chouette'), lyra.id)
    const cat = withOwner(named('familiar', 'Chat'), lyra.id)
    const map: GameMap = {
      ...newMap('c1', { name: 'Hall', cols: 10, rows: 10 }),
      tokens: [
        { id: 'a', entityId: lyra.id, col: 1, row: 1, size: 1, hidden: false },
        { id: 'b', entityId: owl.id, col: 2, row: 1, size: 1, hidden: false },
      ],
    }
    const moves = withFollowingFamiliars(
      [{ entityId: lyra.id, toMapId: 'crypt' }],
      [lyra, owl, cat],
      {
        [map.id]: map,
      },
    )
    // The cat is not on the board: it stays where it is.
    expect(moves).toEqual([
      { entityId: lyra.id, toMapId: 'crypt' },
      { entityId: owl.id, toMapId: 'crypt', at: undefined, kind: 'familiar' },
    ])
    // A familiar given its own destination keeps it.
    const own = withFollowingFamiliars(
      [
        { entityId: lyra.id, toMapId: 'crypt' },
        { entityId: owl.id, toMapId: 'cave' },
      ],
      [lyra, owl],
      { [map.id]: map },
    )
    expect(own.map((m) => m.toMapId)).toEqual(['crypt', 'cave'])
  })
})
