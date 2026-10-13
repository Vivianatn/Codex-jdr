import { describe, expect, it } from 'vitest'
import { emptyLibrary, type Campaign } from '@/db/types'
import { createEntity } from '@/domain/entity'
import { newMap, type GameMap } from '@/domain/maps'
import { emptyPlayState } from '@/domain/turns'
import { defaultRules } from '@/rules'
import { emptyCampaignData, projectForPlayer } from './projection'

const rules = defaultRules()
const campaign: Campaign = {
  id: 'c1',
  name: 'Test',
  description: 'Notes du MJ',
  rules,
  library: emptyLibrary(),
  createdAt: 0,
  updatedAt: 0,
  lastOpenedAt: null,
}

const token = (entityId: string, hidden = false) => ({
  id: `t-${entityId}`,
  entityId,
  col: 1,
  row: 1,
  size: 1,
  hidden,
})

describe('players each see the map their character is on (D-256)', () => {
  const ayla = createEntity('player', 'c1', rules, { identity: { pseudo: 'Ayla' } })
  const brann = createEntity('player', 'c1', rules, { identity: { pseudo: 'Brann' } })
  const goule = createEntity('enemy', 'c1', rules, { identity: { pseudo: 'Goule' } })
  const hall: GameMap = { ...newMap('c1', { name: 'Hall' }), tokens: [token(brann.id)] }
  const cellar: GameMap = {
    ...newMap('c1', { name: 'Cave' }),
    tokens: [token(ayla.id), token(goule.id)],
  }
  const data = {
    ...emptyCampaignData(),
    campaigns: [{ ...campaign, play: { ...emptyPlayState(), mapId: hall.id } }],
    entities: [ayla, brann, goule],
    maps: [hall, cellar],
  }

  it('the one who went through gets the other map, the others keep the GM board', () => {
    const forAyla = projectForPlayer(data, [ayla.id])
    expect(forAyla.maps.map((m) => m.id)).toEqual([cellar.id])
    expect(forAyla.campaigns[0]!.play?.mapId).toBe(cellar.id)
    expect(forAyla.entities.map((e) => e.id)).toContain(goule.id)

    const forBrann = projectForPlayer(data, [brann.id])
    expect(forBrann.maps.map((m) => m.id)).toEqual([hall.id])
    // The ghoul is on a map Brann does not see.
    expect(forBrann.entities.map((e) => e.id)).not.toContain(goule.id)
  })

  it('a hidden token does not give its map away; no token falls back to the GM board', () => {
    const hidden = {
      ...data,
      maps: [hall, { ...cellar, tokens: [token(ayla.id, true)] }],
    }
    expect(projectForPlayer(hidden, [ayla.id]).maps.map((m) => m.id)).toEqual([hall.id])
    expect(projectForPlayer(data, []).maps.map((m) => m.id)).toEqual([hall.id])
  })
})
