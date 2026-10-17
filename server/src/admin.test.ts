import type { FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AdminAuditRow, AdminReport, AdminStats, AdminUserDetail } from '../../shared/admin.ts'
import { ADMIN_FREE_ATTEMPTS, LoginGuard, sweepAdmin } from './admin.ts'
import { adminHashLine } from './adminHash.ts'
import { buildApp } from './app.ts'
import { loadConfig } from './config.ts'
import { openDb, type Db } from './db.ts'
import { memoryMailer } from './mailer.ts'
import { hashPassword } from './secrets.ts'
import { campaignWith, signUp, type Agent } from './testing.ts'

const ADMIN = 'gardien'
const SECRET = 'la clef du grimoire est sous la bougie'
let hash: string
let db: Db
let app: FastifyInstance
let mailer: ReturnType<typeof memoryMailer>
const clock = { now: Date.parse('2026-10-17T10:00:00Z') }

async function start(admin: { username: string; hash: string } | null) {
  db = await openDb('pglite:memory')
  mailer = memoryMailer()
  const config = {
    ...loadConfig({ NODE_ENV: 'test' }),
    siteDir: null,
    adminUsername: admin?.username ?? '',
    adminPasswordHash: admin?.hash ?? '',
    moderationEmail: 'contact@exemple.fr',
  }
  app = await buildApp({ db, config, mailer, now: () => clock.now })
}

/** The dashboard's browser: keeps the admin cookie, sends JSON. */
function adminAgent() {
  let cookie = ''
  return {
    get cookie() {
      return cookie
    },
    async request<T = Record<string, unknown>>(
      method: 'GET' | 'POST' | 'DELETE',
      url: string,
      body?: unknown,
      headers: Record<string, string> = {},
    ) {
      const response = await app.inject({
        method,
        url,
        headers: {
          ...(cookie ? { cookie } : {}),
          ...(method === 'GET' ? {} : { 'content-type': 'application/json' }),
          ...headers,
        },
        ...(method === 'GET' ? {} : { payload: JSON.stringify(body ?? {}) }),
      })
      const set = response.cookies.find((c) => c.name === 'codex_admin')
      if (set) cookie = set.value ? `codex_admin=${set.value}` : ''
      return { status: response.statusCode, body: response.json() as T, response }
    },
  }
}

async function signedIn() {
  const a = adminAgent()
  const { status } = await a.request('POST', '/api/admin/login', {
    username: ADMIN,
    password: SECRET,
  })
  expect(status).toBe(200)
  return a
}

const auditRows = async () =>
  db.query<{ actor: string; action: string; target_id: string | null }>(
    'SELECT actor, action, target_id FROM admin_audit ORDER BY id',
  )

beforeEach(async () => {
  hash ??= await hashPassword(SECRET)
  clock.now = Date.parse('2026-10-17T10:00:00Z')
})
afterEach(async () => {
  await app.close()
  await db.close()
})

describe('admin sign-in (D-275)', () => {
  beforeEach(() => start({ username: ADMIN, hash }))

  it('opens an HttpOnly, SameSite=Strict session on /api/admin, 8 hours, audited', async () => {
    const a = adminAgent()
    const { status, body, response } = await a.request('POST', '/api/admin/login', {
      username: ADMIN,
      password: SECRET,
    })
    expect(status).toBe(200)
    expect(body).toEqual({ username: ADMIN })
    const set = response.cookies.find((c) => c.name === 'codex_admin')!
    expect(set).toMatchObject({ httpOnly: true, sameSite: 'Strict', path: '/api/admin' })
    expect(response.headers['cache-control']).toBe('no-store')
    expect(response.headers['x-robots-tag']).toContain('noindex')
    expect((await a.request('GET', '/api/admin/me')).body).toEqual({ username: ADMIN })

    clock.now += 8 * 3_600_000 + 1000
    expect((await a.request('GET', '/api/admin/me')).status).toBe(401)
    expect((await auditRows()).map((r) => r.action)).toEqual(['login'])
  })

  it('refuses a wrong password or name, and an account session is not an admin one', async () => {
    const a = adminAgent()
    for (const body of [
      { username: ADMIN, password: 'pas le bon mot de passe' },
      { username: 'intrus', password: SECRET },
    ]) {
      const { status, body: answer } = await a.request('POST', '/api/admin/login', body)
      expect(status).toBe(401)
      expect(answer).toMatchObject({ error: 'wrongCredentials' })
    }
    // The wrong name is not kept: it could be a password typed in the wrong field.
    expect(await auditRows()).toEqual([
      { actor: ADMIN, action: 'loginFailed', target_id: null },
      { actor: '?', action: 'loginFailed', target_id: null },
    ])
    const ysolde = await signUp(app, 'Ysolde')
    const { status } = await ysolde.request('GET', '/api/admin/stats')
    expect(status).toBe(401)
  })

  it('locks an address out after repeated failures, then lets it try again', async () => {
    const a = adminAgent()
    const wrong = { username: ADMIN, password: 'toujours pas le bon' }
    for (let i = 0; i < ADMIN_FREE_ATTEMPTS; i++) await a.request('POST', '/api/admin/login', wrong)
    const locked = await a.request<{ error: string; retryAt: number }>('POST', '/api/admin/login', {
      username: ADMIN,
      password: SECRET,
    })
    expect(locked.status).toBe(429)
    expect(locked.body.retryAt).toBeGreaterThan(clock.now)
    clock.now = locked.body.retryAt + 1
    expect(
      (await a.request('POST', '/api/admin/login', { username: ADMIN, password: SECRET })).status,
    ).toBe(200)
  })

  it('accepts only JSON for changes (CSRF) and logs out', async () => {
    const a = await signedIn()
    const form = await a.request('POST', '/api/admin/logout', undefined, {
      'content-type': 'application/x-www-form-urlencoded',
    })
    expect(form.status).toBe(415)
    const foreign = await a.request(
      'POST',
      '/api/admin/logout',
      {},
      { origin: 'https://evil.example' },
    )
    expect(foreign.status).toBe(403)
    expect((await a.request('POST', '/api/admin/logout')).status).toBe(200)
    expect((await a.request('GET', '/api/admin/stats')).status).toBe(401)
    expect((await auditRows()).map((r) => r.action)).toEqual(['login', 'logout'])
  })

  it('requires the admin session on every admin route', async () => {
    const a = adminAgent()
    const id = '00000000-0000-4000-8000-000000000000'
    const routes: ['GET' | 'POST' | 'DELETE', string][] = [
      ['GET', '/api/admin/stats'],
      ['GET', '/api/admin/reports'],
      ['POST', `/api/admin/reports/${id}/dismiss`],
      ['GET', '/api/admin/users'],
      ['GET', `/api/admin/users/${id}`],
      ['POST', `/api/admin/users/${id}/hide-profile`],
      ['POST', `/api/admin/users/${id}/restore-profile`],
      ['POST', `/api/admin/users/${id}/suspend`],
      ['POST', `/api/admin/users/${id}/unsuspend`],
      ['DELETE', `/api/admin/users/${id}`],
      ['GET', '/api/admin/campaigns'],
      ['GET', '/api/admin/audit'],
    ]
    for (const [method, url] of routes) {
      const { status, response } = await a.request(method, url, { reason: 'x'.repeat(20) })
      expect(status, `${method} ${url}`).toBe(401)
      expect(response.headers['cache-control']).toBe('no-store')
    }
  })
})

describe('admin not configured', () => {
  beforeEach(() => start(null))

  it('refuses every sign-in and says so', async () => {
    const a = adminAgent()
    const { status, body } = await a.request('POST', '/api/admin/login', {
      username: '',
      password: '',
    })
    expect(status).toBe(503)
    expect(body).toMatchObject({ configured: false })
    expect((await a.request('GET', '/api/admin/me')).body).toMatchObject({ configured: false })
  })
})

describe('admin dashboard data and moderation', () => {
  let ysolde: Agent
  let bran: Agent
  beforeEach(async () => {
    await start({ username: ADMIN, hash })
    ysolde = await signUp(app, 'Ysolde')
    bran = await signUp(app, 'Bran')
    await campaignWith(app, ysolde, [[bran, 'player']])
    await ysolde.request('POST', '/api/reports', {
      targetType: 'profile',
      targetId: bran.userId,
      category: 'harassment',
      explanation: 'Sa devise insulte les autres joueurs.',
      goodFaith: true,
    })
  })

  const firstReport = async (a: ReturnType<typeof adminAgent>) =>
    (await a.request<{ reports: AdminReport[] }>('GET', '/api/admin/reports')).body.reports[0]!

  it('counts accounts, campaigns, members, reports and sign-ups per day', async () => {
    const a = await signedIn()
    const { body } = await a.request<AdminStats>('GET', '/api/admin/stats')
    expect(body.users).toEqual({ total: 2, new7: 2, new30: 2, suspended: 0, hidden: 0 })
    expect(body.campaigns).toMatchObject({ total: 1, live: 0 })
    expect(body.members).toBe(2)
    expect(body.openReports).toBe(1)
    expect(body.signups).toHaveLength(30)
    expect(body.signups.at(-1)).toEqual({ day: '2026-10-17', count: 2 })
  })

  it('lists reports with the snapshot and reporter, campaigns as metadata only', async () => {
    const a = await signedIn()
    const report = await firstReport(a)
    expect(report).toMatchObject({
      status: 'open',
      category: 'harassment',
      snapshot: { displayName: 'Bran' },
      target: { id: bran.userId, displayName: 'Bran', suspended: false },
      reporter: { id: ysolde.userId, displayName: 'Ysolde' },
    })
    const { body } = await a.request<{ campaigns: Record<string, unknown>[] }>(
      'GET',
      '/api/admin/campaigns',
    )
    expect(body.campaigns).toEqual([
      expect.objectContaining({ name: 'Ombreval', members: 2, live: null }),
    ])
    expect(Object.keys(body.campaigns[0]!).sort()).toEqual(
      ['createdAt', 'id', 'listed', 'live', 'members', 'name', 'owner'].sort(),
    )
  })

  it('finds accounts by name, e-mail or code and shows their detail', async () => {
    const a = await signedIn()
    const byName = await a.request<{ users: { id: string }[] }>('GET', '/api/admin/users?q=bra')
    expect(byName.body.users.map((u) => u.id)).toEqual([bran.userId])
    const byMail = await a.request<{ users: { id: string }[] }>(
      'GET',
      '/api/admin/users?q=ysolde%40exemple',
    )
    expect(byMail.body.users.map((u) => u.id)).toEqual([ysolde.userId])
    const { body } = await a.request<{ user: AdminUserDetail }>(
      'GET',
      `/api/admin/users/${bran.userId}`,
    )
    expect(body.user).toMatchObject({
      displayName: 'Bran',
      memberships: 1,
      campaignsOwned: 0,
      reportsAgainst: 1,
      openReportsAgainst: 1,
    })
  })

  it('suspends from a report: statement of reasons, report closed, audited', async () => {
    const a = await signedIn()
    const report = await firstReport(a)
    const short = await a.request('POST', `/api/admin/users/${bran.userId}/suspend`, {
      reason: 'court',
      illegal: false,
    })
    expect(short.status).toBe(400)
    const { status } = await a.request('POST', `/api/admin/users/${bran.userId}/suspend`, {
      reason: 'Insultes répétées dans la devise.',
      illegal: false,
      reportId: report.id,
    })
    expect(status).toBe(200)
    expect(mailer.sent.some((m) => m.to === 'bran@exemple.fr' && /suspendu/.test(m.subject))).toBe(
      true,
    )
    expect((await bran.request('GET', '/api/auth/me')).status).toBe(401)
    const all = await a.request<{ reports: AdminReport[] }>('GET', '/api/admin/reports?status=all')
    expect(all.body.reports[0]).toMatchObject({ status: 'actioned', target: { suspended: true } })

    expect((await a.request('POST', `/api/admin/users/${bran.userId}/unsuspend`)).status).toBe(200)
    const { body } = await a.request<{ entries: AdminAuditRow[] }>('GET', '/api/admin/audit')
    expect(body.entries.map((e) => e.action)).toEqual(['unsuspend', 'suspend', 'login'])
    expect(body.entries[1]).toMatchObject({ targetId: bran.userId, targetLabel: 'Bran' })
  })

  it('hides and restores a profile, dismisses a report', async () => {
    const a = await signedIn()
    await bran.request('PATCH', '/api/profile', { bio: 'devise insultante' })
    expect(
      (
        await a.request('POST', `/api/admin/users/${bran.userId}/hide-profile`, {
          reason: 'Devise contraire aux règles de conduite.',
          illegal: false,
        })
      ).status,
    ).toBe(200)
    const [row] = await db.query<{ bio: string; profile_hidden_at: unknown }>(
      'SELECT bio, profile_hidden_at FROM users WHERE id = $1',
      [bran.userId],
    )
    expect(row).toMatchObject({ bio: '' })
    expect(row!.profile_hidden_at).toBeTruthy()
    await a.request('POST', `/api/admin/users/${bran.userId}/restore-profile`)

    const report = await firstReport(a)
    const dismissed = await a.request('POST', `/api/admin/reports/${report.id}/dismiss`, {
      reason: 'Rien de contraire aux règles.',
    })
    expect(dismissed.status).toBe(200)
    expect(
      (
        await a.request('POST', `/api/admin/reports/${report.id}/dismiss`, {
          reason: 'Encore une fois.',
        })
      ).status,
    ).toBe(409)
    expect((await auditRows()).map((r) => r.action)).toEqual([
      'login',
      'hideProfile',
      'restoreProfile',
      'dismiss',
    ])
  })

  it('deletes an account only with its exact name typed again', async () => {
    const a = await signedIn()
    const decision = { reason: 'Compte créé pour harceler.', illegal: false }
    const wrong = await a.request('DELETE', `/api/admin/users/${bran.userId}`, {
      ...decision,
      confirm: 'bran',
    })
    expect(wrong.status).toBe(400)
    const { status } = await a.request('DELETE', `/api/admin/users/${bran.userId}`, {
      ...decision,
      confirm: 'Bran',
    })
    expect(status).toBe(200)
    expect(await db.query('SELECT 1 FROM users WHERE id = $1', [bran.userId])).toEqual([])
    expect(mailer.sent.some((m) => m.to === 'bran@exemple.fr' && /supprimé/.test(m.subject))).toBe(
      true,
    )
    const report = await firstReport(a)
    expect(report.target.displayName).toBeNull()
    expect((await auditRows()).at(-1)).toMatchObject({
      action: 'deleteAccount',
      target_id: bran.userId,
    })
  })
})

describe('helpers', () => {
  beforeEach(() => start(null))

  it('sweeps expired sessions and audit lines older than a year', async () => {
    await db.query(
      `INSERT INTO admin_audit (actor, action, at) VALUES ('a', 'login', $1), ('a', 'login', $2)`,
      [new Date(clock.now - 400 * 86_400_000), new Date(clock.now)],
    )
    await db.query(
      `INSERT INTO admin_sessions (token_hash, username, expires_at) VALUES ('t', 'a', $1)`,
      [new Date(clock.now - 1000)],
    )
    await sweepAdmin({ db, now: () => clock.now })
    expect(await db.query('SELECT 1 FROM admin_audit')).toHaveLength(1)
    expect(await db.query('SELECT 1 FROM admin_sessions')).toHaveLength(0)
  })

  it('closes sign-in for everyone after many failures from many addresses', () => {
    const guard = new LoginGuard()
    for (let i = 0; i < 30; i++) guard.fail(`10.0.0.${i}`, clock.now)
    expect(guard.retryAt('192.168.1.1', clock.now)).toBeGreaterThan(clock.now)
    expect(guard.retryAt('192.168.1.1', clock.now + 16 * 60_000)).toBe(0)
  })

  it('prints a hash line the server accepts', async () => {
    const line = await adminHashLine(SECRET)
    expect(line).toMatch(/^ADMIN_PASSWORD_HASH='scrypt\$32768\$8\$1\$[^']+'$/)
    const config = loadConfig({
      NODE_ENV: 'test',
      ADMIN_PASSWORD_HASH: line.slice(line.indexOf('=') + 1),
    })
    expect(config.adminPasswordHash.startsWith('scrypt$')).toBe(true)
    await expect(adminHashLine('court')).rejects.toThrow(/trop court/)
  })
})
