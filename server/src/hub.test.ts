import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  campaignRecord,
  campaignWith,
  push,
  signUp,
  socket,
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

const startGame = (operator: Agent, name: string, mode = 'online', extra = {}) =>
  push(operator, 'camp-1', [
    {
      table: 'campaigns',
      put: [
        campaignRecord('camp-1', {
          play: {
            live: {
              runId: 'r',
              planId: null,
              mode,
              startedAt: 1,
              operator: { id: operator.userId, name },
              ...extra,
            },
          },
        }),
      ],
      del: [],
    },
  ])

describe('real time', () => {
  it('refuses a socket without a session', async () => {
    await expect(server.app.injectWS('/api/ws')).rejects.toThrow(/401/)
  })

  it('shows who is connected to each campaign', async () => {
    const g = await socket(server.app, gm)
    expect((await g.next('hello')).userId).toBe(gm.userId)
    await g.next('presence', (f) => f.users.length === 1)
    const l = await socket(server.app, lyra)
    const both = await g.next('presence', (f) => f.users.length === 2)
    expect(both.users).toEqual([
      { id: gm.userId, name: 'Gm', role: 'owner' },
      { id: lyra.userId, name: 'Lyra', role: 'player' },
    ])
    l.close()
    await g.next('presence', (f) => f.users.length === 1)
    g.close()
  })

  it('tells the editors when records change, and members when campaigns do', async () => {
    const c = await socket(server.app, cogm)
    const l = await socket(server.app, lyra)
    const { body } = await push(gm, 'camp-1', [
      { table: 'entities', put: [{ id: 'e1', campaignId: 'camp-1' }], del: [] },
    ])
    expect(await c.next('changed')).toEqual({ t: 'changed', campaignId: 'camp-1', rev: body.rev })
    await startGame(gm, 'Gm')
    await l.next('campaigns')
    // Players are not told about records they cannot read.
    expect(l.frames.some((f) => f.t === 'changed')).toBe(false)
    c.close()
    l.close()
  })

  it('relays the live game between a player and the operator', async () => {
    const g = await socket(server.app, gm)
    const l = await socket(server.app, lyra)
    // No game yet: nobody serves, nobody enters.
    g.send({ t: 'serve', campaignId: 'camp-1' })
    expect((await g.next('serving')).ok).toBe(false)
    l.send({ t: 'enter', campaignId: 'camp-1' })
    expect((await l.next('enterFailed')).reason).toBe('notLive')

    await startGame(gm, 'Gm')
    g.send({ t: 'serve', campaignId: 'camp-1' })
    expect((await g.next('serving')).ok).toBe(true)
    l.send({ t: 'enter', campaignId: 'camp-1' })
    await l.next('entered')
    expect(await g.next('peer')).toEqual({
      t: 'peer',
      campaignId: 'camp-1',
      peerId: lyra.userId,
      name: 'Lyra',
      characterId: 'char-lyra',
    })

    l.send({ t: 'up', data: { type: 'hello', protocol: 3, name: 'Lyra' } })
    expect((await g.next('up')).data).toEqual({ type: 'hello', protocol: 3, name: 'Lyra' })
    g.send({ t: 'down', campaignId: 'camp-1', peerId: lyra.userId, data: { type: 'bye' } })
    expect((await l.next('down')).data).toEqual({ type: 'bye' })

    // Someone else cannot speak as the host.
    const c = await socket(server.app, cogm)
    c.send({ t: 'down', campaignId: 'camp-1', peerId: lyra.userId, data: { type: 'forged' } })
    c.send({ t: 'serve', campaignId: 'camp-1' })
    expect((await c.next('serving')).ok).toBe(false)

    l.send({ t: 'leave' })
    expect((await g.next('peerGone')).peerId).toBe(lyra.userId)
    expect(
      l.frames.some((f) => f.t === 'down' && (f.data as { type: string }).type === 'forged'),
    ).toBe(false)
    g.close()
    l.close()
    c.close()
  })

  it('co-GMs do not enter as players', async () => {
    await startGame(gm, 'Gm')
    const c = await socket(server.app, cogm)
    c.send({ t: 'enter', campaignId: 'camp-1' })
    expect((await c.next('enterFailed')).reason).toBe('forbidden')
    c.close()
  })

  it('players leave when the game ends or changes hands', async () => {
    await startGame(gm, 'Gm')
    const g = await socket(server.app, gm)
    const l = await socket(server.app, lyra)
    g.send({ t: 'serve', campaignId: 'camp-1' })
    await g.next('serving')
    l.send({ t: 'enter', campaignId: 'camp-1' })
    await l.next('entered')

    await startGame(cogm, 'Cogm').catch(() => null)
    // The co-GM could not take over: still in the game.
    expect(l.frames.some((f) => f.t === 'hostGone')).toBe(false)
    await push(gm, 'camp-1', [
      {
        table: 'campaigns',
        put: [
          campaignRecord('camp-1', {
            play: {
              live: {
                runId: 'r',
                planId: null,
                mode: 'online',
                startedAt: 1,
                operator: { id: cogm.userId, name: 'Cogm' },
              },
            },
          }),
        ],
        del: [],
      },
    ])
    await l.next('hostGone')
    expect((await g.next('serving', (f) => !f.ok)).ok).toBe(false)
    g.close()
    l.close()
  })

  it('a removed player is put out of the game', async () => {
    await startGame(gm, 'Gm')
    const g = await socket(server.app, gm)
    const l = await socket(server.app, lyra)
    g.send({ t: 'serve', campaignId: 'camp-1' })
    await g.next('serving')
    l.send({ t: 'enter', campaignId: 'camp-1' })
    await l.next('entered')
    await gm.request('DELETE', `/api/campaigns/camp-1/members/${lyra.userId}`)
    await l.next('hostGone')
    await g.next('peerGone')
    g.close()
    l.close()
  })

  it('logging out closes the sockets of that session', async () => {
    const l = await socket(server.app, lyra)
    const closed = new Promise<number>((resolve) => l.ws.on('close', (code) => resolve(code)))
    await lyra.request('POST', '/api/auth/logout')
    expect(await closed).toBe(4001)
  })

  it('lists open sessions; a stranger asks in one click, then enters and picks a character', async () => {
    const bran = await signUp(server.app, 'Bran')
    const catalogue = async (a: Agent) =>
      (await a.request<{ sessions: Record<string, unknown>[] }>('GET', '/api/sessions')).body
        .sessions
    const g = await socket(server.app, gm)
    const b = await socket(server.app, bran)

    // A game the GM did not list stays out of the catalogue.
    await startGame(gm, 'Gm', 'online', { title: 'La crypte' })
    g.send({ t: 'serve', campaignId: 'camp-1' })
    await g.next('serving')
    expect(await catalogue(bran)).toEqual([])
    expect((await bran.request('POST', '/api/sessions/camp-1/request')).status).toBe(404)

    await startGame(gm, 'Gm', 'online', { title: 'La crypte', listed: true })
    await b.next('sessions')
    expect(await catalogue(bran)).toEqual([
      {
        campaignId: 'camp-1',
        campaignName: 'Ombreval',
        ownerName: 'Gm',
        title: 'La crypte',
        operatorName: 'Gm',
        startedAt: 1,
        status: 'none',
      },
    ])
    expect((await catalogue(lyra))[0]?.status).toBe('member')
    // The GM does not see their own table.
    expect(await catalogue(gm)).toEqual([])

    expect((await bran.request('POST', '/api/sessions/camp-1/request')).status).toBe(200)
    expect((await catalogue(bran))[0]?.status).toBe('requested')
    const { body } = await gm.request<{ requests: { id: string; displayName: string }[] }>(
      'GET',
      '/api/campaigns/camp-1/requests',
    )
    expect(body.requests.map((r) => r.displayName)).toEqual(['Bran'])
    await gm.request('POST', `/api/campaigns/camp-1/requests/${body.requests[0]!.id}/accept`, {
      role: 'player',
      characterId: null,
    })
    expect((await catalogue(bran))[0]?.status).toBe('member')

    // No character given: the player picks a free one once in the game.
    b.send({ t: 'enter', campaignId: 'camp-1' })
    await b.next('entered')
    expect((await g.next('peer')).characterId).toBeNull()

    // The operator's device stops serving: the session leaves the catalogue.
    g.send({ t: 'unserve', campaignId: 'camp-1' })
    await b.next('hostGone')
    expect(await catalogue(bran)).toEqual([])
    g.close()
    b.close()
  })
})
