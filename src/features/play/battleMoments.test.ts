import { describe, expect, it } from 'vitest'
import { createEntity } from '@/domain/entity'
import type { PlayState } from '@/domain/turns'
import type { Entity } from '@/domain/types'
import { defaultRules } from '@/rules'
import { momentBetween } from './battleMoments'

const rules = defaultRules()
const hero = createEntity('player', 'c', rules)
const goblin = createEntity('enemy', 'c', rules)
const loner = createEntity('enemy', 'c', rules)
const groups: PlayState['groups'] = [
  { id: 'g1', name: 'Héros', memberIds: [hero.id] },
  { id: 'g2', name: 'Gobelins', memberIds: [goblin.id] },
]
const at = (hp: Record<string, number>, turn: PlayState['turn'] = { status: 'stopped' }) => ({
  play: { groups, turn },
  entities: Object.fromEntries(
    [hero, goblin, loner].map((e): [string, Entity] => [
      e.id,
      { ...e, hp: { ...e.hp, current: hp[e.id] ?? 10 } },
    ]),
  ),
})

describe('momentBetween', () => {
  it('announces each new round', () => {
    const playing = (round: number) =>
      ({ status: 'playing', round, groupId: 'g1', memberId: hero.id }) as const
    expect(momentBetween(at({}), at({}, playing(1)))).toEqual({ kind: 'round', round: 1 })
    expect(momentBetween(at({}, playing(1)), at({}, playing(2)))).toEqual({
      kind: 'round',
      round: 2,
    })
    expect(momentBetween(at({}, playing(2)), at({}, playing(2)))).toBeNull()
  })

  it('calls a victory when the last enemy of the groups falls, once', () => {
    expect(momentBetween(at({}), at({ [goblin.id]: 0 }))).toEqual({ kind: 'victory' })
    expect(momentBetween(at({ [goblin.id]: 0 }), at({ [goblin.id]: 0, [hero.id]: 4 }))).toBeNull()
    // An enemy outside the groups does not count.
    expect(momentBetween(at({}), at({ [loner.id]: 0 }))).toBeNull()
  })

  it('calls a defeat when every player of the groups is down', () => {
    expect(momentBetween(at({}), at({ [hero.id]: 0 }))).toEqual({ kind: 'defeat' })
  })
})
