import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { campaignRepository } from '@/db/campaigns'
import { activeDb } from '@/db/db'
import { createEntity } from '@/domain/entity'
import { newElement, newMap } from '@/domain/maps'
import { newSessionPlan } from '@/domain/sessions'
import { HOST_ID } from '@/domain/turns'
import { getMessages } from '@/i18n'
import { defaultRules } from '@/rules'
import { flushActivity } from '@/stores/activityLog'
import { flushAutosave, useCampaignStore } from '@/stores/campaignStore'
import { useRollStore } from '@/stores/rollStore'
import { GuestSession } from './guestSession'
import { HostSession } from './hostSession'
import { memoryLinkPair, relayLink } from './link'
import { PROTOCOL_VERSION, type RejectReason } from './protocol'

const t = getMessages()
/** Leave room when the suite runs in parallel. */
const eventually = (check: () => unknown) => vi.waitFor(check, { timeout: 5000, interval: 20 })
const store = () => useCampaignStore.getState()
const sessions: { host?: HostSession; guests: GuestSession[] } = { guests: [] }

beforeEach(async () => {
  await store().unload()
  useRollStore.setState({ campaignId: null, rolls: [] })
  for (const table of activeDb().tables) await table.clear()
})

afterEach(async () => {
  sessions.host?.stop()
  for (const g of sessions.guests.splice(0)) await g.leave()
})

async function world() {
  const campaign = await campaignRepository.create({ name: 'Ombreval' })
  const rules = defaultRules()
  const lyra = createEntity('player', campaign.id, rules, { identity: { pseudo: 'Lyra' } })
  const gorak = createEntity('player', campaign.id, rules, { identity: { pseudo: 'Gorak' } })
  const goule = createEntity('enemy', campaign.id, rules, {
    identity: { pseudo: 'Goule', description: 'Secret du MJ' },
    stats: { ...lyra.stats, strength: 17 },
  })
  const boss = createEntity('enemy', campaign.id, rules, { identity: { pseudo: 'Mortecendre' } })
  await activeDb().entities.bulkAdd([lyra, gorak, goule, boss])
  const map = newMap(campaign.id, { name: 'Crypte', cols: 10, rows: 10 })
  map.tokens = [
    { id: 'tk-lyra', entityId: lyra.id, col: 1, row: 1, size: 1, hidden: false },
    { id: 'tk-gorak', entityId: gorak.id, col: 2, row: 1, size: 1, hidden: false },
    { id: 'tk-goule', entityId: goule.id, col: 5, row: 5, size: 1, hidden: false },
    { id: 'tk-boss', entityId: boss.id, col: 8, row: 8, size: 1, hidden: true },
  ]
  map.elements = [
    newElement('note', { col: 0, row: 0 }, { label: 'Note du MJ' }),
    newElement('trap', { col: 3, row: 3 }, { label: 'Piège caché' }),
  ]
  await activeDb().maps.add(map)
  const plan = { ...newSessionPlan(campaign.id, 'La crypte'), notes: 'Le boss se relève.' }
  await activeDb().sessions.add(plan)
  await activeDb().campaigns.update(campaign.id, {
    play: {
      groups: [],
      turn: { status: 'stopped' },
      mapId: map.id,
      display: { mode: 'map', imageAssetId: null, gallery: [] },
      live: null,
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
  sessions.host = host
  return { campaign, host, lyra, gorak, goule, boss, map, plan }
}

/** A player entering through the relay (D-262): the server says who they are. */
function join(host: HostSession, name: string, characterId: string | null = null) {
  const rejected: RejectReason[] = []
  const [hostEnd, guestEnd] = memoryLinkPair()
  host.admit({ id: `user-${name}`, name, characterId }, hostEnd)
  const guest = new GuestSession(guestEnd, name, { onRejected: (r) => rejected.push(r) }, false)
  sessions.guests.push(guest)
  return { guest, rejected }
}

const startGame = (mode: 'local' | 'online', operator = { id: HOST_ID, name: 'MJ' }) =>
  store().updatePlay(
    (p) => ({
      ...p,
      live: { runId: 'r1', planId: null, mode, startedAt: 1, operator, title: 'r1', listed: false },
    }),
    'start',
  )

describe('players (D-245)', () => {
  it('see only what is on the table, never the GM notes or hidden things', async () => {
    const { host, goule, boss } = await world()
    const p = join(host, 'Chloé')
    await p.guest.ready
    const copy = p.guest.copy
    expect(await copy.sessions.count()).toBe(0)
    expect(await copy.bestiary.count()).toBe(0)
    const names = (await copy.entities.toArray()).map((e) => e.identity.pseudo).sort()
    expect(names).toEqual(['Gorak', 'Goule', 'Lyra'])
    expect(await copy.entities.get(boss.id)).toBeUndefined()
    const seen = (await copy.entities.get(goule.id))!
    expect(seen.identity.description).toBe('')
    expect(seen.stats.strength).toBe(0)
    const [map] = await copy.maps.toArray()
    expect(map!.elements).toEqual([])
    expect(map!.tokens.map((t) => t.id).sort()).toEqual(['tk-gorak', 'tk-goule', 'tk-lyra'])
  })

  it('move their own token and roll their own dice, only in an online game', async () => {
    const { host, lyra, map } = await world()
    const p = join(host, 'Chloé')
    await p.guest.ready
    p.guest.choose(lyra.id)

    p.guest.intent({ type: 'move', mapId: map.id, tokenId: 'tk-lyra', col: 4, row: 2 })
    await eventually(() => expect(p.rejected).toContain('notOnline'))

    startGame('online')
    p.guest.intent({ type: 'move', mapId: map.id, tokenId: 'tk-lyra', col: 4, row: 2 })
    await eventually(async () => {
      const [copied] = await p.guest.copy.maps.toArray()
      expect(copied!.tokens.find((t) => t.id === 'tk-lyra')).toMatchObject({ col: 4, row: 2 })
    })
    expect(store().maps[map.id]!.tokens.find((t) => t.id === 'tk-lyra')).toMatchObject({
      col: 4,
      row: 2,
    })

    p.guest.intent({ type: 'move', mapId: map.id, tokenId: 'tk-gorak', col: 6, row: 6 })
    await eventually(() => expect(p.rejected).toContain('notYours'))

    p.guest.intent({ type: 'check', entityId: lyra.id, stat: 'dexterity', mode: 'normal' })
    p.guest.intent({ type: 'roll', entityId: lyra.id, expression: '2d6+1' })
    await eventually(async () => expect(await p.guest.copy.rolls.count()).toBe(2))
    const rolls = await activeDb().rolls.toArray()
    expect(rolls.every((r) => r.entityId === lyra.id)).toBe(true)

    p.guest.intent({ type: 'roll', entityId: lyra.id, expression: 'pas des dés' })
    await eventually(() => expect(p.rejected).toContain('invalid'))
  })

  it('keep the character the GM gave them (D-257)', async () => {
    const { host, lyra, gorak } = await world()
    const p = join(host, 'Chloé', lyra.id)
    const { selfId } = await p.guest.ready
    p.guest.choose(gorak.id)
    await eventually(() => expect(p.rejected).toContain('taken'))
    startGame('online')
    p.guest.intent({ type: 'roll', entityId: lyra.id, expression: '1d6' })
    await eventually(async () => expect(await p.guest.copy.rolls.count()).toBe(1))
    expect(selfId).toBe('user-Chloé')
  })

  it('a second connection of the same player replaces the first', async () => {
    const { host } = await world()
    const first = join(host, 'Chloé')
    await first.guest.ready
    const second = join(host, 'Chloé')
    await second.guest.ready
    await eventually(() => expect(first.guest.copy.isOpen()).toBe(false))
  })

  it('cannot take a character already chosen', async () => {
    const { host, lyra } = await world()
    const p1 = join(host, 'Chloé')
    const p2 = join(host, 'Dylan')
    await p1.guest.ready
    await p2.guest.ready
    p1.guest.choose(lyra.id)
    await new Promise((r) => setTimeout(r, 20))
    p2.guest.choose(lyra.id)
    await eventually(() => expect(p2.rejected).toContain('taken'))
  })
})

describe('activity log (D-247)', () => {
  it('signs a player’s move with the player’s name', async () => {
    const { host, lyra, map } = await world()
    const p = join(host, 'Chloé')
    const { selfId } = await p.guest.ready
    p.guest.choose(lyra.id)
    startGame('online')
    p.guest.intent({ type: 'move', mapId: map.id, tokenId: 'tk-lyra', col: 4, row: 2 })
    await eventually(async () => {
      await flushActivity()
      const lines = await activeDb().activity.toArray()
      expect(lines.some((l) => l.author.id === selfId && l.author.name === 'Chloé')).toBe(true)
    })
  })
})

describe('relayed link (D-262)', () => {
  it('carries messages both ways and tells the server when this side leaves', () => {
    const sent: unknown[] = []
    const left = vi.fn()
    const end = relayLink((m) => sent.push(m), left)
    const received: unknown[] = []
    const closed = vi.fn()
    end.link.onMessage((m) => received.push(m))
    end.link.onClose(closed)
    end.link.send({ type: 'hello' })
    end.deliver({ type: 'welcome' })
    expect(sent).toEqual([{ type: 'hello' }])
    expect(received).toEqual([{ type: 'welcome' }])
    end.link.close()
    expect(left).toHaveBeenCalledOnce()
    expect(closed).toHaveBeenCalledOnce()
    // Nothing goes out or comes in once closed.
    end.link.send({ type: 'late' })
    end.deliver({ type: 'late' })
    expect(sent).toHaveLength(1)
    expect(received).toHaveLength(1)
  })

  it('closes without telling the server when the other side left', () => {
    const left = vi.fn()
    const end = relayLink(() => {}, left)
    const closed = vi.fn()
    end.link.onClose(closed)
    end.end()
    expect(closed).toHaveBeenCalledOnce()
    expect(left).not.toHaveBeenCalled()
  })
})

describe('responsiveness (D-270)', () => {
  const roll = (secret: boolean) =>
    useRollStore.getState().add({
      entityId: null,
      kind: 'free',
      label: secret ? 'Secret' : 'Public',
      expression: '1d20',
      total: 12,
      breakdown: '[12]',
      groups: [],
      secret,
      check: null,
      rerollOf: null,
      note: '',
    })

  it('the operator’s changes reach players before the auto-save; secret rolls never do', async () => {
    const { host, goule } = await world()
    const p = join(host, 'Chloé')
    await p.guest.ready
    store().updateEntity(goule.id, (e) => ({ ...e, hp: { ...e.hp, current: 3 } }), 'hit')
    roll(true)
    const shown = roll(false)
    await eventually(async () => {
      expect((await p.guest.copy.entities.get(goule.id))?.hp.current).toBe(3)
      expect((await p.guest.copy.rolls.toArray()).map((r) => r.id)).toEqual([shown.id])
    })
    // The host's own database is still waiting for its auto-save.
    expect((await activeDb().entities.get(goule.id))?.hp.current).not.toBe(3)
    await flushAutosave()
    await new Promise((r) => setTimeout(r, 50))
    expect((await p.guest.copy.rolls.toArray()).every((r) => !r.secret)).toBe(true)
    // The masked enemy stays masked.
    expect((await p.guest.copy.entities.get(goule.id))?.identity.description).toBe('')
  })

  it('writes to the database reach players when the campaign is not open', async () => {
    const { host, map } = await world()
    const p = join(host, 'Chloé')
    await p.guest.ready
    await store().unload()
    await activeDb().maps.update(map.id, { name: 'Crypte inondée' })
    await eventually(async () =>
      expect((await p.guest.copy.maps.get(map.id))?.name).toBe('Crypte inondée'),
    )
  })

  /** A host end the test drives by hand, with the guest’s stores open on `campaignId`. */
  async function scripted(campaignId: string) {
    const [hostEnd, guestEnd] = memoryLinkPair()
    const received: { type: string; seq?: number }[] = []
    hostEnd.onMessage((m) => received.push(m as { type: string }))
    const welcome = {
      type: 'welcome',
      protocol: PROTOCOL_VERSION,
      selfId: 'user-Chloé',
      role: 'player',
      campaignId,
      campaignName: 'Ombreval',
      hostName: 'MJ',
    }
    return { hostEnd, guestEnd, received, welcome }
  }

  it('a player’s own move shows at once and goes back when refused', async () => {
    const { campaign, map } = await world()
    sessions.host?.stop()
    await useRollStore.getState().load(campaign.id)
    const h = await scripted(campaign.id)
    const guest = new GuestSession(h.guestEnd, 'Chloé', {})
    sessions.guests.push(guest)
    const record = (await activeDb().maps.get(map.id))!
    h.hostEnd.send(h.welcome)
    h.hostEnd.send({
      type: 'sync',
      changes: [{ table: 'maps', put: [record], del: [] }],
      initial: true,
    })
    await guest.ready
    const lyraAt = () => store().maps[map.id]!.tokens.find((t) => t.id === 'tk-lyra')
    const gorakAt = () => store().maps[map.id]!.tokens.find((t) => t.id === 'tk-gorak')

    guest.intent({ type: 'move', mapId: map.id, tokenId: 'tk-lyra', col: 6, row: 6 })
    expect(lyraAt()).toMatchObject({ col: 6, row: 6 })
    await eventually(() => expect(h.received.some((m) => m.type === 'intent')).toBe(true))
    h.hostEnd.send({ type: 'rejected', seq: 1, reason: 'blocked' })
    await eventually(() => expect(lyraAt()).toMatchObject({ col: 1, row: 1 }))

    // Another change of the map before the answer: the pending move stays on top.
    guest.intent({ type: 'move', mapId: map.id, tokenId: 'tk-lyra', col: 3, row: 4 })
    const other = {
      ...record,
      tokens: record.tokens.map((t) => (t.id === 'tk-gorak' ? { ...t, col: 9 } : t)),
    }
    h.hostEnd.send({
      type: 'sync',
      changes: [{ table: 'maps', put: [other], del: [] }],
      initial: false,
    })
    await eventually(() => expect(gorakAt()?.col).toBe(9))
    expect(lyraAt()).toMatchObject({ col: 3, row: 4 })
    h.hostEnd.send({ type: 'ack', seq: 2 })
    const played = {
      ...other,
      tokens: other.tokens.map((t) => (t.id === 'tk-lyra' ? { ...t, col: 3, row: 4 } : t)),
    }
    h.hostEnd.send({
      type: 'sync',
      changes: [{ table: 'maps', put: [played], del: [] }],
      initial: false,
    })
    await eventually(async () =>
      expect(
        (await guest.copy.maps.get(map.id))!.tokens.find((t) => t.id === 'tk-lyra'),
      ).toMatchObject({ col: 3, row: 4 }),
    )
    expect(lyraAt()).toMatchObject({ col: 3, row: 4 })
  })

  it('a dropped connection resumes: hello again, and the fresh copy replaces the old one', async () => {
    const { campaign, map, plan } = await world()
    sessions.host?.stop()
    const h = await scripted(campaign.id)
    const closed = vi.fn()
    const guest = new GuestSession(h.guestEnd, 'Chloé', { onClosed: closed }, false)
    sessions.guests.push(guest)
    const record = (await activeDb().maps.get(map.id))!
    h.hostEnd.send(h.welcome)
    h.hostEnd.send({
      type: 'sync',
      changes: [
        { table: 'maps', put: [record], del: [] },
        { table: 'sessions', put: [plan], del: [] },
      ],
      initial: true,
    })
    await guest.ready
    expect(await guest.copy.sessions.count()).toBe(1)

    guest.suspend()
    h.hostEnd.close()
    await new Promise((r) => setTimeout(r, 10))
    expect(closed).not.toHaveBeenCalled()
    expect(guest.copy.isOpen()).toBe(true)

    const again = await scripted(campaign.id)
    guest.resume(again.guestEnd)
    await eventually(() => expect(again.received.map((m) => m.type)).toContain('hello'))
    again.hostEnd.send(again.welcome)
    again.hostEnd.send({
      type: 'sync',
      changes: [{ table: 'maps', put: [record], del: [] }],
      initial: true,
    })
    await eventually(async () => expect(await guest.copy.sessions.count()).toBe(0))
    expect(await guest.copy.maps.count()).toBe(1)
  })
})
