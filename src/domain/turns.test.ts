import { describe, expect, it } from 'vitest'
import {
  addGroup,
  addMember,
  canStart,
  emptyPlayState,
  groupOf,
  moveGroup,
  moveMember,
  nextTurn,
  normalizePlayState,
  pruneMembers,
  removeGroup,
  removeMember,
  resumeTurns,
  startTurns,
  stopTurns,
  type PlayState,
} from './turns'

/** Two groups: Héros (lyra, gorak) then Gobelins (g1, g2), plus an empty group in between. */
function table(): PlayState {
  let s = emptyPlayState()
  s = addGroup(s, 'Héros', 'heroes')
  s = addGroup(s, 'Vide', 'empty')
  s = addGroup(s, 'Gobelins', 'goblins')
  s = addMember(s, 'heroes', 'lyra')
  s = addMember(s, 'heroes', 'gorak')
  s = addMember(s, 'goblins', 'g1')
  s = addMember(s, 'goblins', 'g2')
  return s
}

const advance = (s: PlayState) => {
  const { turn, actor } = nextTurn(s)
  return { state: { ...s, turn }, actor }
}

describe('turns by groups (D-226)', () => {
  it('groups play in order, members one after the other, then the GM, then a new round', () => {
    let s = startTurns(table())
    expect(s.turn).toEqual({ status: 'playing', round: 1, groupId: 'heroes', memberId: 'lyra' })
    const actors: (string | null)[] = []
    for (let i = 0; i < 4; i++) {
      const r = advance(s)
      s = r.state
      actors.push(r.actor)
    }
    // The empty group is skipped; after the last goblin comes the GM.
    expect(actors).toEqual(['gorak', 'g1', 'g2', 'gm'])
    expect(s.turn).toEqual({ status: 'gm', round: 1 })
    // Nothing moves during the GM's turn until the GM resumes.
    expect(advance(s).actor).toBeNull()
    s = resumeTurns(s)
    expect(s.turn).toEqual({ status: 'playing', round: 2, groupId: 'heroes', memberId: 'lyra' })
  })

  it('a character belongs to one group at most', () => {
    const s = addMember(table(), 'goblins', 'lyra')
    expect(groupOf(s, 'lyra')?.id).toBe('goblins')
    expect(s.groups[0]!.memberIds).toEqual(['gorak'])
  })

  it('reorders groups and members', () => {
    let s = moveGroup(table(), 'goblins', -1)
    expect(s.groups.map((g) => g.id)).toEqual(['heroes', 'goblins', 'empty'])
    s = moveMember(s, 'gorak', -1)
    expect(s.groups[0]!.memberIds).toEqual(['gorak', 'lyra'])
    expect(moveGroup(s, 'heroes', -1).groups[0]!.id).toBe('heroes') // already first
  })

  it('removing the playing character or group hands the turn on', () => {
    let s = startTurns(table())
    s = removeMember(s, 'lyra')
    expect(s.turn).toMatchObject({ memberId: 'gorak' })
    s = removeGroup(s, 'heroes')
    expect(s.turn).toMatchObject({ groupId: 'goblins', memberId: 'g1' })
    s = removeGroup(s, 'goblins')
    expect(s.turn).toEqual({ status: 'gm', round: 1 })
  })

  it('cannot start without anyone in a group; stopping ends the turns', () => {
    const empty = addGroup(emptyPlayState(), 'Seul')
    expect(canStart(empty)).toBe(false)
    expect(startTurns(empty)).toBe(empty)
    expect(stopTurns(startTurns(table())).turn).toEqual({ status: 'stopped' })
  })

  it('forgets deleted characters and tolerates missing saves', () => {
    const s = pruneMembers(table(), new Set(['lyra', 'g2']))
    expect(s.groups.map((g) => g.memberIds)).toEqual([['lyra'], [], ['g2']])
    expect(normalizePlayState(undefined)).toEqual(emptyPlayState())
    expect(normalizePlayState({ groups: [{ id: 1 }] }).groups).toEqual([])
  })
})
