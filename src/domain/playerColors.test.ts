import { describe, expect, it } from 'vitest'
import { configuredRules } from '@/test/fixtures'
import { createEntity, normalizeEntityShape } from './entity'
import {
  assignColor,
  colorIn,
  GM_COLOR,
  PLAYER_COLORS,
  playerColorOf,
  usedPlayerColors,
  type PlayerColorKey,
} from './playerColors'
import type { Entity } from './types'

const rules = configuredRules()

function player(color: PlayerColorKey | null): Entity {
  const e = createEntity('player', 'c', rules)
  return { ...e, details: { ...e.details, color } }
}
function familiarOf(owner: Entity | null): Entity {
  const f = createEntity('familiar', 'c', rules)
  return { ...f, details: { ...f.details, ownerId: owner?.id ?? null } }
}

describe('player colours (D-268)', () => {
  it('a new player has no colour yet', () => {
    expect(createEntity('player', 'c', rules).details).toEqual({ xp: 0, color: null })
  })

  it('assigns the first colour nobody wears', () => {
    expect(assignColor([])).toBe(PLAYER_COLORS[0])
    expect(assignColor(['crimson'])).toBe('azure')
    expect(assignColor(['azure', null, undefined])).toBe('crimson')
    expect(assignColor(['crimson', 'azure', 'emerald'])).toBe('copper')
  })

  it('cycles through the palette when every colour is taken', () => {
    const all = [...PLAYER_COLORS]
    expect(assignColor(all)).toBe('crimson')
    expect(assignColor([...all, 'crimson'])).toBe('azure')
  })

  it('lists the colours worn by player characters only', () => {
    const enemy = createEntity('enemy', 'c', rules)
    expect(usedPlayerColors([player('rose'), player(null), enemy])).toEqual(['rose'])
  })

  it('ignores an unknown stored colour and upgrades older saves', () => {
    const odd = { ...player(null), details: { xp: 0, color: 'neon' } } as unknown as Entity
    expect(playerColorOf(odd)).toBeNull()
    const old = { ...player(null), details: { xp: 3 } } as unknown as Entity
    expect(normalizeEntityShape(old).details).toEqual({ xp: 3, color: null })
    expect(normalizeEntityShape(player('teal')).details).toEqual({ xp: 0, color: 'teal' })
  })

  it('resolves the colour of a roll: player, their familiar, else the GM', () => {
    const lyra = player('emerald')
    const plain = player(null)
    const enemy = createEntity('enemy', 'c', rules)
    const ally = createEntity('ally', 'c', rules)
    const pet = familiarOf(lyra)
    const enemyPet = familiarOf(enemy)
    const stray = familiarOf(null)
    const all = Object.fromEntries(
      [lyra, plain, enemy, ally, pet, enemyPet, stray].map((e) => [e.id, e]),
    )
    expect(colorIn(all, lyra.id)).toBe('emerald')
    expect(colorIn(all, pet.id)).toBe('emerald')
    expect(colorIn(all, plain.id)).toBe(GM_COLOR)
    expect(colorIn(all, enemy.id)).toBe(GM_COLOR)
    expect(colorIn(all, ally.id)).toBe(GM_COLOR)
    expect(colorIn(all, enemyPet.id)).toBe(GM_COLOR)
    expect(colorIn(all, stray.id)).toBe(GM_COLOR)
    expect(colorIn(all, null)).toBe(GM_COLOR)
    expect(colorIn(all, 'gone')).toBe(GM_COLOR)
    expect(colorIn(Object.values(all), pet.id)).toBe('emerald')
  })
})
