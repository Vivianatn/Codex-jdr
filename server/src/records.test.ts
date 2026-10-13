import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  campaignRecord,
  campaignWith,
  pull,
  push,
  signUp,
  testServer,
  type Agent,
} from './testing.ts'

let server: Awaited<ReturnType<typeof testServer>>
let gm: Agent
let cogm: Agent
let lyra: Agent
beforeEach(async () => {
  server = await testServer()
  gm = await signUp(server.app, 'Gm')
  cogm = await signUp(server.app, 'Cogm')
  lyra = await signUp(server.app, 'Lyra')
  await campaignWith(server.app, gm, [
    [cogm, 'editor'],
    [lyra, 'player', 'char-lyra'],
  ])
})
afterEach(() => server.close())

const entity = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  campaignId: 'camp-1',
  kind: 'player',
  identity: { pseudo: id, portrait: null, body: null },
  inventory: [],
  ...extra,
})

const live = (operatorId: string, name: string, mode = 'online') => ({
  play: {
    live: { runId: 'run', planId: null, mode, startedAt: 1, operator: { id: operatorId, name } },
  },
})

const reasons = (result: Awaited<ReturnType<typeof push>>) =>
  result.body.refused.map((r) => r.reason)

describe('campaign records', () => {
  it('a GM pushes, a co-GM pulls; deletions travel too', async () => {
    const first = await push(gm, 'camp-1', [
      { table: 'campaigns', put: [campaignRecord('camp-1')], del: [] },
      { table: 'entities', put: [entity('e1'), entity('e2')], del: [] },
    ])
    expect(first.status).toBe(200)
    const pulled = await pull(cogm, 'camp-1')
    expect(pulled.body.rev).toBe(first.body.rev)
    expect(pulled.body.changes.find((c) => c.table === 'entities')!.put.map((r) => r.id)).toEqual([
      'e1',
      'e2',
    ])

    await push(gm, 'camp-1', [{ table: 'entities', put: [], del: ['e2', 'unknown'] }])
    const next = await pull(cogm, 'camp-1', pulled.body.rev)
    expect(next.body.changes).toEqual([{ table: 'entities', put: [], del: ['e2'] }])
  })

  it('a device does not get back what it wrote itself, but its revision moves on', async () => {
    const { body } = await push(
      gm,
      'camp-1',
      [{ table: 'entities', put: [entity('e1')], del: [] }],
      'gm-laptop',
    )
    const own = await pull(gm, 'camp-1', 0, 'gm-laptop')
    expect(own.body).toEqual({ changes: [], rev: body.rev, more: false })
    expect((await pull(gm, 'camp-1', 0, 'gm-phone')).body.changes).toHaveLength(1)
  })

  it('players never read or write records', async () => {
    expect((await pull(lyra, 'camp-1')).status).toBe(403)
    expect(
      (await push(lyra, 'camp-1', [{ table: 'entities', put: [entity('e1')], del: [] }])).status,
    ).toBe(403)
    const outsider = await signUp(server.app, 'Outsider')
    expect((await pull(outsider, 'camp-1')).status).toBe(404)
  })

  it('refuses records of another campaign, and gives back the truth', async () => {
    await campaignWith(server.app, cogm, [], 'camp-2')
    await push(cogm, 'camp-2', [
      { table: 'entities', put: [{ ...entity('theirs'), campaignId: 'camp-2' }], del: [] },
    ])
    // Same id, other campaign: someone trying to overwrite another GM's record.
    const stolen = await push(gm, 'camp-1', [
      { table: 'entities', put: [entity('theirs')], del: [] },
    ])
    expect(stolen.body.refused).toEqual([{ table: 'entities', id: 'theirs', reason: 'forbidden' }])
    expect(stolen.body.current).toEqual([{ table: 'entities', put: [], del: [] }])
    expect(
      reasons(
        await push(gm, 'camp-1', [
          { table: 'entities', put: [{ ...entity('x'), campaignId: 'camp-2' }], del: [] },
        ]),
      ),
    ).toEqual(['forbidden'])
    expect(
      reasons(
        await push(gm, 'camp-1', [
          { table: 'campaigns', put: [campaignRecord('camp-2')], del: [] },
        ]),
      ),
    ).toEqual(['forbidden'])
    expect(
      reasons(await push(gm, 'camp-1', [{ table: 'campaigns', put: [], del: ['camp-1'] }])),
    ).toEqual(['forbidden'])
    expect(
      reasons(await push(gm, 'camp-1', [{ table: 'entities', put: [], del: ['theirs'] }])),
    ).toEqual(['forbidden'])
  })

  it('stores the valid records of a batch and refuses the others one by one', async () => {
    const result = await push(gm, 'camp-1', [
      {
        table: 'entities',
        put: [entity('ok'), { ...entity('bad'), campaignId: 'elsewhere' }],
        del: [],
      },
    ])
    expect(result.body.refused).toEqual([{ table: 'entities', id: 'bad', reason: 'forbidden' }])
    expect((await pull(cogm, 'camp-1')).body.changes[0]!.put.map((r) => r.id)).toEqual(['ok'])
  })

  it('refuses malformed batches and non-raster pictures; strips unsafe portraits', async () => {
    expect(
      (await push(gm, 'camp-1', [{ table: 'backups' as never, put: [], del: [] }])).status,
    ).toBe(400)
    const svg = 'data:image/svg+xml;base64,PHN2Zz4='
    expect(
      (
        await push(gm, 'camp-1', [
          {
            table: 'assets',
            put: [{ id: 'a1', campaignId: 'camp-1', name: 'x', data: svg }],
            del: [],
          },
        ])
      ).body.refused[0]!.reason,
    ).toBe('invalid')
    await push(gm, 'camp-1', [
      {
        table: 'entities',
        put: [entity('e1', { identity: { portrait: svg, body: 'data:image/png;base64,AAAA' } })],
        del: [],
      },
    ])
    const [e1] = (await pull(cogm, 'camp-1')).body.changes[0]!.put
    expect(e1!.identity).toEqual({ portrait: null, body: 'data:image/png;base64,AAAA' })
  })

  it('keeps records encrypted at rest', async () => {
    await push(gm, 'camp-1', [
      { table: 'entities', put: [entity('e1', { secret: 'Le trésor est sous l’autel' })], del: [] },
    ])
    const [row] = await server.db.query<{ data: Uint8Array }>(
      "SELECT data FROM records WHERE id = 'e1'",
    )
    expect(Buffer.from(row!.data).toString('latin1')).not.toContain('autel')
    // Moved to another place in the database, a record no longer opens.
    await server.db.query("UPDATE records SET id = 'e9' WHERE id = 'e1'")
    expect((await pull(cogm, 'camp-1')).status).toBe(500)
  })

  it('during a game, only the operator changes characters, maps, rolls and skills', async () => {
    await push(gm, 'camp-1', [
      { table: 'campaigns', put: [campaignRecord('camp-1', live(gm.userId, 'Gm'))], del: [] },
    ])
    const summary = (await gm.request<{ campaigns: { live: unknown }[] }>('GET', '/api/campaigns'))
      .body.campaigns[0]!
    expect(summary.live).toEqual({
      operatorId: gm.userId,
      operatorName: 'Gm',
      mode: 'online',
      startedAt: 1,
    })

    const refused = await push(cogm, 'camp-1', [
      { table: 'entities', put: [entity('e1')], del: [] },
    ])
    expect(reasons(refused)).toEqual(['notOperator'])
    // The co-GM's copy is put back as the server has it (nothing there yet).
    expect(refused.body.current).toEqual([{ table: 'entities', put: [], del: ['e1'] }])
    expect(
      reasons(await push(gm, 'camp-1', [{ table: 'entities', put: [entity('e1')], del: [] }])),
    ).toEqual([])
    expect(
      reasons(await push(cogm, 'camp-1', [{ table: 'entities', put: [], del: ['e1'] }])),
    ).toEqual(['notOperator'])
    // Preparing the next session stays open to co-GMs.
    expect(
      (
        await push(cogm, 'camp-1', [
          { table: 'sessions', put: [{ id: 's1', campaignId: 'camp-1' }], del: [] },
        ])
      ).status,
    ).toBe(200)
  })

  it("a co-GM's campaign record keeps the operator's game", async () => {
    await push(gm, 'camp-1', [
      { table: 'campaigns', put: [campaignRecord('camp-1', live(gm.userId, 'Gm'))], del: [] },
    ])
    const stale = campaignRecord('camp-1', { name: 'Ombreval II', play: { live: null } })
    const result = await push(cogm, 'camp-1', [{ table: 'campaigns', put: [stale], del: [] }])
    expect(result.status).toBe(200)
    expect(result.body.corrected[0]!.put[0]).toMatchObject({
      name: 'Ombreval II',
      ...live(gm.userId, 'Gm'),
    })
    const [campaign] = (await pull(gm, 'camp-1', 0, 'other')).body.changes.find(
      (c) => c.table === 'campaigns',
    )!.put
    expect(campaign).toMatchObject({ name: 'Ombreval II', ...live(gm.userId, 'Gm') })
  })

  it('a game is started by its own operator, handed over or ended by the operator only', async () => {
    expect(
      reasons(
        await push(cogm, 'camp-1', [
          { table: 'campaigns', put: [campaignRecord('camp-1', live(gm.userId, 'Gm'))], del: [] },
        ]),
      ),
    ).toEqual(['notOperator'])
    await push(gm, 'camp-1', [
      { table: 'campaigns', put: [campaignRecord('camp-1', live(gm.userId, 'Gm'))], del: [] },
    ])
    await push(gm, 'camp-1', [
      { table: 'campaigns', put: [campaignRecord('camp-1', live(cogm.userId, 'Cogm'))], del: [] },
    ])
    expect(
      reasons(await push(cogm, 'camp-1', [{ table: 'entities', put: [entity('e1')], del: [] }])),
    ).toEqual([])
    await push(cogm, 'camp-1', [{ table: 'campaigns', put: [campaignRecord('camp-1')], del: [] }])
    expect(
      (await gm.request<{ campaigns: { live: unknown }[] }>('GET', '/api/campaigns')).body
        .campaigns[0]!.live,
    ).toBeNull()
  })

  it('activity lines are signed by their editor, or by the operator for a player', async () => {
    const line = (id: string, author: { id: string; name: string }) => ({
      id,
      campaignId: 'camp-1',
      at: 1,
      author,
      kind: 'do',
      label: 'Gorak −7 PV',
      count: 1,
    })
    // The name shown is the account's, whatever the device wrote.
    expect(
      reasons(
        await push(cogm, 'camp-1', [
          {
            table: 'activity',
            put: [line('l1', { id: cogm.userId, name: 'Ancien nom' })],
            del: [],
          },
        ]),
      ),
    ).toEqual([])
    expect(
      reasons(
        await push(cogm, 'camp-1', [
          { table: 'activity', put: [line('l2', { id: gm.userId, name: 'Gm' })], del: [] },
        ]),
      ),
    ).toEqual(['forbidden'])
    // Taking over someone else's line.
    expect(
      reasons(
        await push(gm, 'camp-1', [
          { table: 'activity', put: [line('l1', { id: gm.userId, name: 'Gm' })], del: [] },
        ]),
      ),
    ).toEqual(['forbidden'])
    // Players' intents, played by the operator.
    const player = line('l3', { id: lyra.userId, name: 'Lyra' })
    expect(
      reasons(await push(gm, 'camp-1', [{ table: 'activity', put: [player], del: [] }])),
    ).toEqual(['forbidden'])
    await push(gm, 'camp-1', [
      { table: 'campaigns', put: [campaignRecord('camp-1', live(gm.userId, 'Gm'))], del: [] },
    ])
    expect(
      reasons(await push(gm, 'camp-1', [{ table: 'activity', put: [player], del: [] }])),
    ).toEqual([])
    // Nobody erases the log.
    await push(gm, 'camp-1', [{ table: 'activity', put: [], del: ['l1'] }])
    const kept = (await pull(cogm, 'camp-1')).body.changes.find((c) => c.table === 'activity')!.put
    expect(kept.map((r) => r.author)).toEqual([
      { id: cogm.userId, name: 'Cogm' },
      { id: lyra.userId, name: 'Lyra' },
    ])
  })

  it('trims the activity log to the latest 300 lines', async () => {
    const lines = Array.from({ length: 305 }, (_, i) => ({
      id: `l${i}`,
      campaignId: 'camp-1',
      at: i,
      author: { id: gm.userId, name: 'Gm' },
      kind: 'do',
      label: `Action ${i}`,
      count: 1,
    }))
    await push(gm, 'camp-1', [{ table: 'activity', put: lines, del: [] }])
    const activity = (await pull(cogm, 'camp-1')).body.changes.find((c) => c.table === 'activity')!
    expect(activity.put).toHaveLength(300)
    expect(activity.put.map((r) => r.id)).not.toContain('l0')
  })

  it('pulls a big campaign page by page', async () => {
    const many = Array.from({ length: 1500 }, (_, i) => entity(`e${i}`))
    await push(gm, 'camp-1', [{ table: 'entities', put: many.slice(0, 1500), del: [] }])
    const first = await pull(cogm, 'camp-1')
    expect(first.body.more).toBe(true)
    const second = await pull(cogm, 'camp-1', first.body.rev)
    expect(second.body.more).toBe(false)
    const count = (r: typeof first) => r.body.changes.reduce((n, c) => n + c.put.length, 0)
    expect(count(first) + count(second)).toBe(1500)
  })
})
