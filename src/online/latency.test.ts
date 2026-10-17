import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { campaignRepository } from '@/db/campaigns'
import { activeDb, CodexDB } from '@/db/db'
import { createEntity } from '@/domain/entity'
import { newElement, newMap, type GameMap } from '@/domain/maps'
import type { RollRecord } from '@/domain/rolls'
import { HOST_ID } from '@/domain/turns'
import { getMessages } from '@/i18n'
import { defaultRules } from '@/rules'
import { randomBytes } from '@/security/crypto'
import { useCampaignStore } from '@/stores/campaignStore'
import { useRollStore } from '@/stores/rollStore'
import { GuestSession } from './guestSession'
import { HostSession } from './hostSession'
import { memoryLinkPair, type Link } from './link'
import { loadCampaignData, projectForPlayer, Replica } from './projection'
import type { HostMessage } from './protocol'

/**
 * Responsiveness of the online game (D-270): how long an operator's action
 * takes to reach the players, measured on a realistic table (6 players, 8 maps,
 * 40 characters, 300 rolls). The numbers are printed; the bounds are generous
 * so a slow machine does not fail them, but they catch a return of the old
 * 250 ms auto-save wait.
 */

const t = getMessages()
const store = () => useCampaignStore.getState()
const PLAYERS = 6
let host: HostSession | null = null
const guests: GuestSession[] = []

beforeEach(async () => {
  await store().unload()
  useRollStore.setState({ campaignId: null, rolls: [] })
  for (const table of activeDb().tables) await table.clear()
})

afterEach(async () => {
  host?.stop()
  host = null
  for (const g of guests.splice(0)) await g.leave()
})

const median = (values: number[]) =>
  values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)]!

async function bigTable(db: CodexDB = activeDb()) {
  const campaign = await campaignRepository.create({ name: 'Ombreval' })
  const rules = defaultRules()
  const players = Array.from({ length: PLAYERS }, (_, i) =>
    createEntity('player', campaign.id, rules, { identity: { pseudo: `Joueur ${i}` } }),
  )
  const enemies = Array.from({ length: 34 }, (_, i) =>
    createEntity('enemy', campaign.id, rules, { identity: { pseudo: `Goule ${i}` } }),
  )
  const maps: GameMap[] = Array.from({ length: 8 }, (_, m) => {
    const map = newMap(campaign.id, { name: `Salle ${m}`, cols: 40, rows: 30 })
    map.fog = { enabled: true, revealed: '10'.repeat(600) }
    map.elements = Array.from({ length: 30 }, (_, i) =>
      newElement(i % 5 ? 'trap' : 'note', { col: i, row: i % 30 }, { label: `Objet ${i}` }),
    )
    map.tokens = enemies.slice(m * 4, m * 4 + 4).map((e, i) => ({
      id: `tk-${e.id}`,
      entityId: e.id,
      col: 10 + i,
      row: 10,
      size: 1,
      hidden: i === 3,
    }))
    if (m === 0)
      map.tokens.push(
        ...players.map((p, i) => ({
          id: `tk-${p.id}`,
          entityId: p.id,
          col: i,
          row: 2,
          size: 1,
          hidden: false,
        })),
      )
    return map
  })
  const rolls: RollRecord[] = Array.from({ length: 300 }, (_, i) => ({
    id: crypto.randomUUID(),
    campaignId: campaign.id,
    at: 1000 + i,
    entityId: players[i % PLAYERS]!.id,
    kind: 'free',
    label: '2d6+1',
    expression: '2d6+1',
    total: 7,
    breakdown: '[3, 3] + 1',
    groups: [],
    secret: i % 10 === 0,
    check: null,
    rerollOf: null,
    note: '',
  }))
  if (db !== activeDb()) await db.campaigns.put((await activeDb().campaigns.get(campaign.id))!)
  await db.entities.bulkAdd([...players, ...enemies])
  await db.maps.bulkAdd(maps)
  await db.rolls.bulkAdd(rolls)
  await db.campaigns.update(campaign.id, {
    play: {
      groups: [],
      turn: { status: 'stopped' },
      mapId: maps[0]!.id,
      display: { mode: 'map', imageAssetId: null, gallery: [] },
      live: null,
    },
  })
  return { campaign, players, maps }
}

/** A guest whose link timestamps each sync it receives. */
function watchedGuest(h: HostSession, i: number, characterId: string) {
  const [hostEnd, guestEnd] = memoryLinkPair()
  const syncs: { at: number; message: HostMessage }[] = []
  const spy: Link = {
    ...guestEnd,
    onMessage: (handler) =>
      guestEnd.onMessage((m) => {
        if ((m as HostMessage).type === 'sync')
          syncs.push({ at: performance.now(), message: m as HostMessage })
        handler(m)
      }),
  }
  h.admit({ id: `user-${i}`, name: `Joueur ${i}`, characterId }, hostEnd)
  const guest = new GuestSession(spy, `Joueur ${i}`, {}, false)
  guests.push(guest)
  return { guest, syncs }
}

/** Actions a player would make, not a burst: each one starts on a quiet table. */
const pause = () => new Promise((r) => setTimeout(r, 300))

const until = async (check: () => boolean, timeout = 3000) => {
  const start = performance.now()
  while (!check()) {
    if (performance.now() - start > timeout) throw new Error('timeout')
    await new Promise((r) => setTimeout(r, 1))
  }
}

describe('online responsiveness (D-270)', () => {
  it('an operator move, a roll and a player move reach every player quickly', async () => {
    const { campaign, players, maps } = await bigTable()
    await store().load(campaign.id)
    await useRollStore.getState().load(campaign.id)
    store().updatePlay(
      (p) => ({
        ...p,
        live: {
          runId: 'r1',
          planId: null,
          mode: 'online',
          startedAt: 1,
          operator: { id: HOST_ID, name: 'MJ' },
          title: 'r1',
          listed: false,
        },
      }),
      'start',
    )
    host = new HostSession({
      campaignId: campaign.id,
      campaignName: campaign.name,
      hostName: 'MJ',
      t,
    })
    const table = players.map((p, i) => watchedGuest(host!, i, p.id))
    await Promise.all(table.map((g) => g.guest.ready))
    const map = maps[0]!
    const enemyToken = map.tokens[0]!

    // 1. The operator moves a token: every player gets the new position.
    const moves: number[] = []
    for (let n = 0; n < 5; n++) {
      await pause()
      const counts = table.map((g) => g.syncs.length)
      const start = performance.now()
      store().updateMap(
        map.id,
        (m) => ({
          ...m,
          tokens: m.tokens.map((tk) => (tk.id === enemyToken.id ? { ...tk, col: 20 + n } : tk)),
        }),
        'move',
      )
      await until(() => table.every((g, i) => g.syncs.length > counts[i]!))
      moves.push(Math.max(...table.map((g) => g.syncs.at(-1)!.at)) - start)
    }

    // 2. The operator rolls: every player gets the roll (it drives the dice animation).
    const rolls: number[] = []
    for (let n = 0; n < 5; n++) {
      await pause()
      const counts = table.map((g) => g.syncs.length)
      const start = performance.now()
      useRollStore.getState().add({
        entityId: null,
        kind: 'free',
        label: '1d20',
        expression: '1d20',
        total: 12,
        breakdown: '[12]',
        groups: [],
        secret: false,
        check: null,
        rerollOf: null,
        note: '',
      })
      await until(() => table.every((g, i) => g.syncs.length > counts[i]!))
      rolls.push(Math.max(...table.map((g) => g.syncs.at(-1)!.at)) - start)
    }

    // 3. A player moves their token: the round trip until the host's answer reaches them.
    const own: number[] = []
    const mine = table[0]!
    const tokenId = `tk-${players[0]!.id}`
    for (let n = 0; n < 5; n++) {
      await pause()
      const count = mine.syncs.length
      const start = performance.now()
      mine.guest.intent({ type: 'move', mapId: map.id, tokenId, col: 2 + n, row: 5 })
      await until(() => mine.syncs.length > count)
      own.push(mine.syncs.at(-1)!.at - start)
    }

    const report = { move: median(moves), roll: median(rolls), ownMove: median(own) }
    console.info('[D-270] latency to all players (ms, median):', JSON.stringify(report))
    // The old pipeline waited for the 250 ms auto-save; now it must not.
    expect(report.move).toBeLessThan(200)
    expect(report.roll).toBeLessThan(200)
    expect(report.ownMove).toBeLessThan(200)
  })

  it('the cost of one synchronisation pass (6 players, encrypted database)', async () => {
    const key = randomBytes(32)
    const db = new CodexDB(`bench-${crypto.randomUUID()}`, { key })
    await db.open()
    const { campaign, players } = await bigTable(db)
    // Before D-270, every change reloaded (and decrypted) the whole table from IndexedDB.
    let start = performance.now()
    const data = await loadCampaignData(db, campaign.id)
    const loadAll = performance.now() - start
    start = performance.now()
    await loadCampaignData(db, campaign.id, ['maps', 'rolls'], data)
    const reloadMapsRolls = performance.now() - start

    // Diffing every player's view after one token moved on the map they all see.
    const replicas = players.map(() => new Replica())
    players.forEach((p, i) => replicas[i]!.diff(projectForPlayer(data, [p.id])))
    const passes = 20
    let current = data
    const board = data.maps.find((m) => m.tokens.some((tk) => tk.entityId === players[0]!.id))!
    start = performance.now()
    for (let n = 0; n < passes; n++) {
      const moved = {
        ...board,
        tokens: board.tokens.map((tk, i) => (i === 0 ? { ...tk, col: n } : tk)),
      }
      current = { ...current, maps: current.maps.map((m) => (m.id === board.id ? moved : m)) }
      players.forEach((p, i) => {
        const changes = replicas[i]!.diff(projectForPlayer(current, [p.id]))
        expect(changes.map((c) => c.table)).toEqual(['maps'])
      })
    }
    const diffPass = (performance.now() - start) / passes
    console.info(
      '[D-270] sync cost (ms):',
      JSON.stringify({ loadAll, reloadMapsRolls, diffPass6Players: diffPass }),
    )
    db.close()
    expect(diffPass).toBeLessThan(100)
  })
})
