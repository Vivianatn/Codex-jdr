import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CodexDB } from '@/db/db'
import { SyncEngine, type SyncApi } from '@/online/server/sync'
import { ApiError } from '@/online/server/api'
import type { CampaignSummary } from '../../shared/sync.ts'
import { signUp, testServer, type Agent } from './testing.ts'

/**
 * The app's sync engine (src/online/server/sync.ts) against the real server:
 * two devices of two editors, each with its own local database.
 */

let server: Awaited<ReturnType<typeof testServer>>
const opened: CodexDB[] = []

beforeEach(async () => {
  server = await testServer()
})
afterEach(async () => {
  for (const db of opened.splice(0)) {
    db.close()
    await Dexie.delete(db.name)
  }
  await server.close()
})

function apiOf(a: Agent, device: string): SyncApi {
  const call = async <T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    body?: unknown,
  ) => {
    const { status, body: data } = await a.request<T & { error?: string }>(
      method,
      `/api${url}`,
      body,
      {
        'x-codex-device': device,
      },
    )
    if (status >= 400) throw new ApiError((data.error ?? 'server') as never, status)
    return data as T
  }
  return {
    pull: (id, since) => call('GET', `/campaigns/${id}/changes?since=${since}`),
    push: (id, changes) => call('POST', `/campaigns/${id}/changes`, { changes }),
    putCampaign: (id, name) => call('PUT', `/campaigns/${id}`, { name }),
    deleteCampaign: (id) => call('DELETE', `/campaigns/${id}`),
    leaveCampaign: (id) => call('DELETE', `/campaigns/${id}/members/me`),
    campaigns: async () =>
      (await call<{ campaigns: CampaignSummary[] }>('GET', '/campaigns')).campaigns,
  }
}

async function device(a: Agent, name: string, seed?: (db: CodexDB) => Promise<unknown>) {
  const db = new CodexDB(`codex-sync-${crypto.randomUUID()}`)
  opened.push(db)
  await db.open()
  // What the device had before its account went online.
  await seed?.(db)
  const api = apiOf(a, name)
  const refused: string[] = []
  const engine = new SyncEngine({
    db: () => db,
    api,
    self: () => ({ id: a.userId, name }),
    ingest: false,
    onRefused: (reason) => refused.push(reason),
  })
  await engine.start()
  engine.setOnline(true)
  const sync = async () => {
    await engine.reconcile()
    await engine.flush()
  }
  return { db, engine, api, sync, refused }
}

const campaign = (id: string, extra: Record<string, unknown> = {}) =>
  ({
    id,
    name: 'Ombreval',
    description: '',
    createdAt: 1,
    updatedAt: 1,
    lastOpenedAt: null,
    rules: {},
    library: { conditions: [], macros: [] },
    play: { live: null },
    ...extra,
  }) as never

const until = (check: () => unknown) => vi.waitFor(check, { timeout: 5000, interval: 20 })

describe('sync engine against the server', () => {
  it('puts the local campaigns online, a co-GM downloads them, edits flow both ways', async () => {
    const gm = await signUp(server.app, 'Gm')
    const cogm = await signUp(server.app, 'Cogm')
    const a = await device(gm, 'Gm', async (db) => {
      await db.campaigns.put(
        campaign('c1', {
          play: {
            live: {
              runId: 'r',
              planId: null,
              mode: 'local',
              startedAt: 1,
              operator: { id: 'host', name: 'Moi' },
            },
          },
        }),
      )
      await db.sessions.put({ id: 's1', campaignId: 'c1', title: 'Crypte' } as never)
      await db.activity.put({
        id: 'l1',
        campaignId: 'c1',
        at: 1,
        author: { id: 'host', name: 'Moi' },
        kind: 'do',
        label: 'Créé',
        count: 1,
      })
    })
    await a.sync()
    expect(await a.db.outbox.count()).toBe(0)
    // The GM of this device became the account.
    expect((await a.db.campaigns.get('c1'))!.play!.live!.operator).toEqual({
      id: gm.userId,
      name: 'Gm',
    })

    // The co-GM joins.
    const { body } = await gm.request<{ inviteCode: string }>('POST', '/api/campaigns/c1/invite')
    await cogm.request('POST', `/api/invites/${body.inviteCode}/request`, {})
    const { body: list } = await gm.request<{ requests: { id: string }[] }>(
      'GET',
      '/api/campaigns/c1/requests',
    )
    await gm.request('POST', `/api/campaigns/c1/requests/${list.requests[0]!.id}/accept`, {
      role: 'editor',
    })

    const b = await device(cogm, 'Cogm')
    await b.sync()
    expect((await b.db.sessions.get('s1'))?.title).toBe('Crypte')
    expect((await b.db.activity.get('l1'))?.author).toEqual({ id: gm.userId, name: 'Gm' })

    // The co-GM edits; the GM pulls.
    await b.db.sessions.put({ id: 's1', campaignId: 'c1', title: 'Crypte (v2)' } as never)
    await until(async () => expect(await b.db.outbox.count()).toBe(0))
    await a.sync()
    expect((await a.db.sessions.get('s1'))?.title).toBe('Crypte (v2)')

    // A deletion too.
    await a.db.sessions.delete('s1')
    await until(async () => expect(await a.db.outbox.count()).toBe(0))
    await b.sync()
    expect(await b.db.sessions.get('s1')).toBeUndefined()
  })

  it('keeps working off line and sends everything once back', async () => {
    const gm = await signUp(server.app, 'Gm')
    const a = await device(gm, 'Gm')
    await a.db.campaigns.put(campaign('c1'))
    await a.sync()
    expect(a.engine.isSynced('c1')).toBe(true)
    a.engine.setOnline(false)
    await a.db.sessions.put({ id: 's1', campaignId: 'c1', title: 'Hors ligne' } as never)
    await a.db.sessions.put({ id: 's1', campaignId: 'c1', title: 'Hors ligne, corrigé' } as never)
    await until(async () => expect(await a.db.outbox.count()).toBe(1))
    a.engine.setOnline(true)
    await until(async () => expect(await a.db.outbox.count()).toBe(0))
    const phone = await device(gm, 'Gm-phone')
    await phone.sync()
    expect((await phone.db.sessions.get('s1'))?.title).toBe('Hors ligne, corrigé')
  })

  it('a pending local edit is not overwritten by a pull', async () => {
    const gm = await signUp(server.app, 'Gm')
    const a = await device(gm, 'Gm')
    const other = await device(gm, 'Gm-phone')
    await a.db.campaigns.put(campaign('c1'))
    await a.sync()
    await other.sync()
    await other.db.sessions.put({ id: 's1', campaignId: 'c1', title: 'Téléphone' } as never)
    await until(async () => expect(await other.db.outbox.count()).toBe(0))
    a.engine.setOnline(false)
    await a.db.sessions.put({ id: 's1', campaignId: 'c1', title: 'Ordinateur' } as never)
    a.engine.setOnline(true)
    await a.sync()
    // Last write wins: the laptop's, sent before its pull.
    expect((await a.db.sessions.get('s1'))?.title).toBe('Ordinateur')
    await other.sync()
    expect((await other.db.sessions.get('s1'))?.title).toBe('Ordinateur')
  })

  it('a refused change is put back as the server has it', async () => {
    const gm = await signUp(server.app, 'Gm')
    const cogm = await signUp(server.app, 'Cogm')
    const a = await device(gm, 'Gm')
    await a.db.campaigns.put(campaign('c1'))
    await a.db.entities.put({ id: 'e1', campaignId: 'c1', name: 'Lyra' } as never)
    await a.sync()
    const { body } = await gm.request<{ inviteCode: string }>('POST', '/api/campaigns/c1/invite')
    await cogm.request('POST', `/api/invites/${body.inviteCode}/request`, {})
    const { body: list } = await gm.request<{ requests: { id: string }[] }>(
      'GET',
      '/api/campaigns/c1/requests',
    )
    await gm.request('POST', `/api/campaigns/c1/requests/${list.requests[0]!.id}/accept`, {
      role: 'editor',
    })
    const b = await device(cogm, 'Cogm')
    await b.sync()
    // The GM starts a game: only the operator changes characters.
    await a.db.campaigns.put(
      campaign('c1', {
        play: {
          live: {
            runId: 'r',
            planId: null,
            mode: 'online',
            startedAt: 2,
            operator: { id: gm.userId, name: 'Gm' },
          },
        },
      }),
    )
    await until(async () => expect(await a.db.outbox.count()).toBe(0))
    await b.sync()
    await b.db.entities.put({ id: 'e1', campaignId: 'c1', name: 'Lyra la Brave' } as never)
    await until(async () => expect(await b.db.outbox.count()).toBe(0))
    await until(() => expect(b.refused).toEqual(['notOperator']))
    expect((await b.db.entities.get('e1')) as unknown).toMatchObject({ name: 'Lyra' })
  })

  it("a co-GM's copy goes when access ends; the owner's stays, off line", async () => {
    const gm = await signUp(server.app, 'Gm')
    const cogm = await signUp(server.app, 'Cogm')
    const a = await device(gm, 'Gm')
    await a.db.campaigns.put(campaign('c1'))
    await a.sync()
    const { body } = await gm.request<{ inviteCode: string }>('POST', '/api/campaigns/c1/invite')
    await cogm.request('POST', `/api/invites/${body.inviteCode}/request`, {})
    const { body: list } = await gm.request<{ requests: { id: string }[] }>(
      'GET',
      '/api/campaigns/c1/requests',
    )
    await gm.request('POST', `/api/campaigns/c1/requests/${list.requests[0]!.id}/accept`, {
      role: 'editor',
    })
    const b = await device(cogm, 'Cogm')
    await b.sync()
    expect(await b.db.campaigns.get('c1')).toBeDefined()

    await gm.request('DELETE', '/api/campaigns/c1')
    await b.sync()
    expect(await b.db.campaigns.get('c1')).toBeUndefined()
    await a.sync()
    expect(await a.db.campaigns.get('c1')).toBeDefined()
    expect(a.engine.isSynced('c1')).toBe(false)
    // Put back online on request.
    await a.engine.upload('c1')
    expect((await a.api.campaigns()).map((c) => c.id)).toEqual(['c1'])
  })

  it('deleting an online campaign on the device deletes it on the server', async () => {
    const gm = await signUp(server.app, 'Gm')
    const a = await device(gm, 'Gm')
    await a.db.campaigns.put(campaign('c1'))
    await a.sync()
    await a.db.campaigns.delete('c1')
    await until(async () => expect(await a.api.campaigns()).toEqual([]))
  })
})
