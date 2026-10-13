import type { FastifyInstance } from 'fastify'
import type { WebSocket } from 'ws'
import type { ServerFrame, TableChanges } from '../../shared/sync.ts'
import { buildApp } from './app.ts'
import { loadConfig } from './config.ts'
import { openDb, type Db } from './db.ts'
import { memoryMailer } from './mailer.ts'

/** A server on an in-memory PostgreSQL (PGlite), with a clock the test moves. */
export async function testServer(siteDir: string | null = null) {
  const db = await openDb('pglite:memory')
  const mailer = memoryMailer()
  const clock = { now: Date.parse('2026-10-13T10:00:00Z') }
  const config = { ...loadConfig({ NODE_ENV: 'test' }), databaseUrl: 'pglite:memory', siteDir }
  const app = await buildApp({ db, config, mailer, now: () => clock.now })
  return {
    app,
    db,
    mailer,
    clock,
    async close() {
      await app.close()
      await db.close()
    },
  }
}

export const PASSWORD = 'une phrase de passe assez longue'

export interface Agent {
  userId: string
  cookie: string
  request<T = Record<string, unknown>>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: string,
    body?: unknown,
    headers?: Record<string, string>,
  ): Promise<{ status: number; body: T }>
}

/** A browser of the app: keeps its session cookie. */
export function agent(app: FastifyInstance): Agent {
  const self: Agent = {
    userId: '',
    cookie: '',
    async request(method, url, body, headers = {}) {
      const response = await app.inject({
        method,
        url,
        headers: { ...(self.cookie ? { cookie: self.cookie } : {}), ...headers },
        ...(body === undefined ? {} : { payload: body as object }),
      })
      const set = response.cookies.find((c) => c.name === 'codex_session')
      if (set) self.cookie = set.value ? `codex_session=${set.value}` : ''
      return { status: response.statusCode, body: response.json() }
    },
  }
  return self
}

/** Registers an account and returns its browser. */
export async function signUp(app: FastifyInstance, name: string): Promise<Agent> {
  const a = agent(app)
  const { status, body } = await a.request<{ user: { id: string } }>('POST', '/api/auth/register', {
    email: `${name.toLowerCase()}@exemple.fr`,
    displayName: name,
    password: PASSWORD,
  })
  if (status !== 200) throw new Error(`register ${status} ${JSON.stringify(body)}`)
  a.userId = body.user.id
  return a
}

export function campaignRecord(id: string, extra: Record<string, unknown> = {}) {
  return { id, name: 'Ombreval', play: { live: null }, ...extra }
}

export function push(a: Agent, campaignId: string, changes: TableChanges[], device = 'device-a') {
  return a.request<{
    rev: number
    corrected: TableChanges[]
    refused: { table: string; id: string; reason: string }[]
    current: TableChanges[]
    error?: string
  }>('POST', `/api/campaigns/${campaignId}/changes`, { changes }, { 'x-codex-device': device })
}

export function pull(a: Agent, campaignId: string, since = 0, device = 'device-b') {
  return a.request<{ changes: TableChanges[]; rev: number; more: boolean }>(
    'GET',
    `/api/campaigns/${campaignId}/changes?since=${since}`,
    undefined,
    { 'x-codex-device': device },
  )
}

/** A campaign owned by `owner`, with `others` joined in the given roles. */
export async function campaignWith(
  app: FastifyInstance,
  owner: Agent,
  others: [Agent, 'player' | 'editor', (string | null)?][] = [],
  id = 'camp-1',
) {
  await owner.request('PUT', `/api/campaigns/${id}`, { name: 'Ombreval' })
  const { body } = await owner.request<{ inviteCode: string }>(
    'POST',
    `/api/campaigns/${id}/invite`,
  )
  for (const [a, role, characterId] of others) {
    await a.request('POST', `/api/invites/${body.inviteCode}/request`, { message: '' })
    const { body: list } = await owner.request<{ requests: { id: string; userId: string }[] }>(
      'GET',
      `/api/campaigns/${id}/requests`,
    )
    const request = list.requests.find((r) => r.userId === a.userId)!
    await owner.request('POST', `/api/campaigns/${id}/requests/${request.id}/accept`, {
      role,
      characterId: characterId ?? null,
    })
  }
  void app
  return { id, inviteCode: body.inviteCode }
}

/** A WebSocket client that records the frames it gets. */
export async function socket(app: FastifyInstance, a: Agent) {
  const frames: ServerFrame[] = []
  const waiters: { test: (f: ServerFrame) => boolean; resolve: (f: ServerFrame) => void }[] = []
  const ws: WebSocket = await app.injectWS(
    '/api/ws',
    { headers: { cookie: a.cookie } },
    {
      onInit: (w) =>
        w.on('message', (data) => {
          const frame = JSON.parse(data.toString()) as ServerFrame
          frames.push(frame)
          for (const w of [...waiters])
            if (w.test(frame)) {
              waiters.splice(waiters.indexOf(w), 1)
              w.resolve(frame)
            }
        }),
    },
  )
  return {
    ws,
    frames,
    send: (frame: unknown) => ws.send(JSON.stringify(frame)),
    /** The next frame (or one already received and not yet awaited) matching `test`. */
    next<T extends ServerFrame['t']>(
      t: T,
      test: (f: Extract<ServerFrame, { t: T }>) => boolean = () => true,
    ) {
      const match = (f: ServerFrame) => f.t === t && test(f as Extract<ServerFrame, { t: T }>)
      const seen = frames.findIndex(match)
      if (seen >= 0)
        return Promise.resolve(frames.splice(seen, 1)[0] as Extract<ServerFrame, { t: T }>)
      return new Promise<Extract<ServerFrame, { t: T }>>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`no ${t} frame`)), 3000)
        waiters.push({
          test: match,
          resolve: (f) => {
            clearTimeout(timer)
            frames.splice(frames.indexOf(f), 1)
            resolve(f as Extract<ServerFrame, { t: T }>)
          },
        })
      })
    },
    close: () => ws.terminate(),
  }
}

export type { Db }
