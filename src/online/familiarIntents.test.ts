import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { campaignRepository } from '@/db/campaigns'
import { activeDb } from '@/db/db'
import { createEntity } from '@/domain/entity'
import { withOwner } from '@/domain/familiars'
import { newMap } from '@/domain/maps'
import { HOST_ID } from '@/domain/turns'
import { getMessages } from '@/i18n'
import { defaultRules } from '@/rules'
import { useCampaignStore } from '@/stores/campaignStore'
import { useRollStore } from '@/stores/rollStore'
import { GuestSession } from './guestSession'
import { HostSession } from './hostSession'
import { memoryLinkPair } from './link'
import type { RejectReason } from './protocol'

const t = getMessages()
const eventually = (check: () => unknown) => vi.waitFor(check, { timeout: 5000, interval: 20 })
const store = () => useCampaignStore.getState()
const open: { host?: HostSession; guest?: GuestSession } = {}

beforeEach(async () => {
  await store().unload()
  useRollStore.setState({ campaignId: null, rolls: [] })
  for (const table of activeDb().tables) await table.clear()
})

afterEach(async () => {
  open.host?.stop()
  await open.guest?.leave()
})

describe('a player and their familiars (D-269)', () => {
  it('rolls and moves for their character’s familiar, never for anyone else’s', async () => {
    const campaign = await campaignRepository.create({ name: 'Ombreval' })
    const rules = defaultRules()
    const lyra = createEntity('player', campaign.id, rules, { identity: { pseudo: 'Lyra' } })
    const goule = createEntity('enemy', campaign.id, rules, { identity: { pseudo: 'Goule' } })
    const owl = withOwner(
      createEntity('familiar', campaign.id, rules, { identity: { pseudo: 'Hibou' } }),
      lyra.id,
    )
    const rat = withOwner(
      createEntity('familiar', campaign.id, rules, { identity: { pseudo: 'Rat' } }),
      goule.id,
    )
    await activeDb().entities.bulkAdd([lyra, goule, owl, rat])
    const map = newMap(campaign.id, { name: 'Crypte', cols: 10, rows: 10 })
    map.tokens = [
      { id: 'tk-lyra', entityId: lyra.id, col: 1, row: 1, size: 1, hidden: false },
      { id: 'tk-owl', entityId: owl.id, col: 2, row: 1, size: 1, hidden: false },
      { id: 'tk-goule', entityId: goule.id, col: 5, row: 5, size: 1, hidden: false },
      { id: 'tk-rat', entityId: rat.id, col: 6, row: 5, size: 1, hidden: false },
    ]
    await activeDb().maps.add(map)
    await activeDb().campaigns.update(campaign.id, {
      play: {
        groups: [],
        turn: { status: 'stopped' },
        mapId: map.id,
        display: { mode: 'map', imageAssetId: null, gallery: [] },
        live: {
          runId: 'r1',
          planId: null,
          mode: 'online',
          startedAt: 1,
          operator: { id: HOST_ID, name: 'MJ' },
          title: 'r1',
          listed: false,
        },
      },
    })
    await store().load(campaign.id)
    useRollStore.setState({ campaignId: campaign.id, rolls: [] })
    const host = new HostSession({
      campaignId: campaign.id,
      campaignName: campaign.name,
      hostName: 'MJ',
      t,
    })
    open.host = host
    const rejected: RejectReason[] = []
    const [hostEnd, guestEnd] = memoryLinkPair()
    host.admit({ id: 'user-chloe', name: 'Chloé', characterId: lyra.id }, hostEnd)
    const guest = new GuestSession(
      guestEnd,
      'Chloé',
      { onRejected: (r) => rejected.push(r) },
      false,
    )
    open.guest = guest
    await guest.ready

    // The familiar's data reaches the player.
    await eventually(async () => expect(await guest.copy.entities.get(owl.id)).toBeDefined())

    guest.intent({ type: 'check', entityId: owl.id, stat: 'dexterity', mode: 'normal' })
    guest.intent({ type: 'roll', entityId: owl.id, expression: '1d6' })
    await eventually(async () => expect(await activeDb().rolls.count()).toBe(2))
    expect((await activeDb().rolls.toArray()).every((r) => r.entityId === owl.id)).toBe(true)

    guest.intent({ type: 'move', mapId: map.id, tokenId: 'tk-owl', col: 3, row: 2 })
    await eventually(() =>
      expect(store().maps[map.id]!.tokens.find((tk) => tk.id === 'tk-owl')).toMatchObject({
        col: 3,
        row: 2,
      }),
    )

    guest.intent({ type: 'roll', entityId: rat.id, expression: '1d6' })
    await eventually(() => expect(rejected).toEqual(['notYours']))
    guest.intent({ type: 'move', mapId: map.id, tokenId: 'tk-rat', col: 7, row: 7 })
    await eventually(() => expect(rejected).toEqual(['notYours', 'notYours']))
    guest.intent({ type: 'check', entityId: goule.id, stat: 'strength', mode: 'normal' })
    await eventually(() => expect(rejected).toHaveLength(3))
    expect(await activeDb().rolls.count()).toBe(2)
  })
})
