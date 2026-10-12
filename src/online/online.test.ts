import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { campaignRepository } from '@/db/campaigns'
import { activeDb } from '@/db/db'
import type { ActivityRecord } from '@/domain/activity'
import { createEntity } from '@/domain/entity'
import { newElement, newMap } from '@/domain/maps'
import { newSessionPlan } from '@/domain/sessions'
import { HOST_ID } from '@/domain/turns'
import { getMessages } from '@/i18n'
import { defaultRules } from '@/rules'
import { flushActivity } from '@/stores/activityLog'
import { useCampaignStore } from '@/stores/campaignStore'
import { useRollStore } from '@/stores/rollStore'
import { GuestSession } from './guestSession'
import { HostSession } from './hostSession'
import { memoryLinkPair } from './link'
import type { GuestRole } from './onlineStore'
import type { RejectReason } from './protocol'
import { decodeCode, encodeCode, InvalidCodeError } from './signaling'

const t = getMessages()
/** Sync goes through the host's 250 ms auto-save: leave room when the suite runs in parallel. */
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
      display: { mode: 'map', imageAssetId: null },
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
    servers: [],
  })
  sessions.host = host
  return { campaign, host, lyra, gorak, goule, boss, map, plan }
}

function join(host: HostSession, role: GuestRole, name: string) {
  const rejected: RejectReason[] = []
  const [hostEnd, guestEnd] = memoryLinkPair()
  host.attach(host.prepare(role), hostEnd)
  const guest = new GuestSession(guestEnd, name, { onRejected: (r) => rejected.push(r) }, false)
  sessions.guests.push(guest)
  return { guest, rejected }
}

const startGame = (mode: 'local' | 'online', operator = { id: HOST_ID, name: 'MJ' }) =>
  store().updatePlay(
    (p) => ({ ...p, live: { runId: 'r1', planId: null, mode, startedAt: 1, operator } }),
    'start',
  )

describe('connection codes (D-245)', () => {
  it('round-trip, survive chat formatting, and refuse anything else', async () => {
    const invite = {
      v: 1 as const,
      kind: 'invite' as const,
      peerId: 'p1',
      role: 'player' as const,
      campaignName: 'Ombreval',
      hostName: 'MJ',
      sdp: 'v=0\r\n'.repeat(200),
    }
    const code = await encodeCode(invite)
    expect(code.length).toBeLessThan(600)
    const chatty = code.replace(/(.{60})/g, '$1\n  ')
    expect(await decodeCode(chatty)).toEqual(invite)
    await expect(decodeCode('bonjour')).rejects.toThrow(InvalidCodeError)
    await expect(decodeCode('CODEX1.' + code.slice(12))).rejects.toThrow(InvalidCodeError)
  })
})

describe('editors co-edit live (D-245)', () => {
  it('get the whole campaign, and their edits reach the host and the other editors', async () => {
    const { host, lyra } = await world()
    const a = join(host, 'editor', 'Agathe')
    const b = join(host, 'editor', 'Bastien')
    const welcome = await a.guest.ready
    await b.guest.ready
    expect(welcome).toMatchObject({ role: 'editor', hostName: 'MJ', campaignName: 'Ombreval' })
    expect(await a.guest.copy.entities.count()).toBe(4)
    expect((await a.guest.copy.sessions.toArray())[0]?.notes).toBe('Le boss se relève.')

    const copy = (await a.guest.copy.entities.get(lyra.id))!
    await a.guest.copy.entities.put({
      ...copy,
      identity: { ...copy.identity, pseudo: 'Lyra la Grise' },
    })

    await eventually(async () =>
      expect((await activeDb().entities.get(lyra.id))?.identity.pseudo).toBe('Lyra la Grise'),
    )
    // The host's open campaign shows it without saving it again.
    expect(store().entities[lyra.id]?.identity.pseudo).toBe('Lyra la Grise')
    await eventually(async () =>
      expect((await b.guest.copy.entities.get(lyra.id))?.identity.pseudo).toBe('Lyra la Grise'),
    )
  })

  it('refuse writes outside the campaign, and table changes by a non-operator during a game', async () => {
    const { host, lyra, campaign } = await world()
    const other = await campaignRepository.create({ name: 'Autre' })
    const intruder = createEntity('player', other.id, defaultRules())
    await activeDb().entities.add(intruder)
    const a = join(host, 'editor', 'Agathe')
    await a.guest.ready

    await a.guest.copy.entities.put({
      ...intruder,
      campaignId: campaign.id,
      identity: { ...intruder.identity, pseudo: 'Volé' },
    })
    await eventually(() => expect(a.rejected).toContain('forbidden'))
    expect((await activeDb().entities.get(intruder.id))?.campaignId).toBe(other.id)
    // What the editor made up does not stay in its copy.
    await eventually(async () =>
      expect(await a.guest.copy.entities.get(intruder.id)).toBeUndefined(),
    )

    startGame('local')
    await eventually(async () =>
      expect((await a.guest.copy.campaigns.get(campaign.id))?.play?.live).toBeTruthy(),
    )
    const copy = (await a.guest.copy.entities.get(lyra.id))!
    await a.guest.copy.entities.put({ ...copy, level: 9 })
    await eventually(() => expect(a.rejected).toContain('notOperator'))
    expect((await activeDb().entities.get(lyra.id))?.level).toBe(lyra.level)
    // The host sends the truth back.
    await eventually(async () =>
      expect((await a.guest.copy.entities.get(lyra.id))?.level).toBe(lyra.level),
    )
  })

  it('an editor can start the game as operator; when it leaves, the host takes the table back', async () => {
    const { host, campaign } = await world()
    const a = join(host, 'editor', 'Agathe')
    const { selfId } = await a.guest.ready
    const record = (await a.guest.copy.campaigns.get(campaign.id))!
    await a.guest.copy.campaigns.put({
      ...record,
      play: {
        ...record.play!,
        live: {
          runId: 'r2',
          planId: null,
          mode: 'online',
          startedAt: 1,
          operator: { id: selfId, name: 'Agathe' },
        },
      },
    })
    await eventually(() => expect(store().play.live?.operator.id).toBe(selfId))

    await a.guest.leave()
    await eventually(() => expect(store().play.live?.operator).toEqual({ id: HOST_ID, name: 'MJ' }))
  })
})

describe('players (D-245)', () => {
  it('see only what is on the table, never the GM notes or hidden things', async () => {
    const { host, goule, boss } = await world()
    const p = join(host, 'player', 'Chloé')
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
    const p = join(host, 'player', 'Chloé')
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

  it('cannot take a character already chosen, nor write anything', async () => {
    const { host, lyra } = await world()
    const p1 = join(host, 'player', 'Chloé')
    const p2 = join(host, 'player', 'Dylan')
    await p1.guest.ready
    await p2.guest.ready
    p1.guest.choose(lyra.id)
    await new Promise((r) => setTimeout(r, 20))
    p2.guest.choose(lyra.id)
    await eventually(() => expect(p2.rejected).toContain('taken'))
  })
})

describe('activity log (D-247)', () => {
  const line = (campaignId: string, author: { id: string; name: string }): ActivityRecord => ({
    id: crypto.randomUUID(),
    campaignId,
    at: Date.now(),
    author,
    kind: 'do',
    label: 'Carte « Crypte » modifiée',
    count: 1,
  })

  it('signs the host’s changes, takes editors’ lines signed by themselves only, hides them from players', async () => {
    const { host, campaign, lyra } = await world()
    store().updateEntity(lyra.id, (e) => ({ ...e, level: 2 }), 'Modification de Lyra')
    await flushActivity()
    expect(await activeDb().activity.toArray()).toMatchObject([
      { author: { id: HOST_ID, name: 'MJ' }, label: 'Modification de Lyra', count: 1 },
    ])

    const a = join(host, 'editor', 'Agathe')
    const { selfId } = await a.guest.ready
    await eventually(async () => expect(await a.guest.copy.activity.count()).toBe(1))
    const own = line(campaign.id, { id: selfId, name: 'Agathe' })
    await a.guest.copy.activity.put(own)
    await eventually(async () =>
      expect((await activeDb().activity.get(own.id))?.author.name).toBe('Agathe'),
    )

    const forged = line(campaign.id, { id: HOST_ID, name: 'MJ' })
    await a.guest.copy.activity.put(forged)
    await eventually(() => expect(a.rejected).toContain('forbidden'))
    expect(await activeDb().activity.get(forged.id)).toBeUndefined()

    const p = join(host, 'player', 'Chloé')
    await p.guest.ready
    expect(await p.guest.copy.activity.count()).toBe(0)
  })

  it('signs a player’s move with the player’s name', async () => {
    const { host, lyra, map } = await world()
    const p = join(host, 'player', 'Chloé')
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
