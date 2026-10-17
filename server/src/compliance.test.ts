import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TERMS_VERSION, type TermsStatus } from '../../shared/legal.ts'
import { sweepReports } from './compliance.ts'
import { parseArgs } from './moderate.ts'
import {
  dismissReport,
  hideProfile,
  listReports,
  restoreProfile,
  suspendAccount,
  unsuspendAccount,
  type ModerationCtx,
} from './moderation.ts'
import {
  campaignRecord,
  campaignWith,
  PASSWORD,
  push,
  signUp,
  testServer,
  type Agent,
} from './testing.ts'

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

let server: Awaited<ReturnType<typeof testServer>>
let ysolde: Agent
let bran: Agent
let moderation: ModerationCtx
beforeEach(async () => {
  server = await testServer()
  ysolde = await signUp(server.app, 'Ysolde')
  bran = await signUp(server.app, 'Bran')
  moderation = {
    db: server.db,
    mailer: server.mailer,
    now: () => server.clock.now,
    contact: 'contact@exemple.fr',
  }
})
afterEach(() => server.close())

const report = (a: Agent, body: Record<string, unknown>) =>
  a.request<{ id: string; reference: string; error?: string }>('POST', '/api/reports', {
    targetType: 'profile',
    targetId: bran.userId,
    category: 'harassment',
    explanation: 'Sa devise insulte les autres joueurs.',
    goodFaith: true,
    ...body,
  })

describe('terms and age (D-271)', () => {
  it('records the accepted version and the declared age', async () => {
    const before = await ysolde.request<TermsStatus>('GET', '/api/account/terms')
    expect(before.body).toEqual({ current: TERMS_VERSION, accepted: null })

    expect(
      (await ysolde.request('POST', '/api/account/terms', { version: 'old', age: '15+' })).status,
    ).toBe(400)
    expect(
      (await ysolde.request('POST', '/api/account/terms', { version: TERMS_VERSION, age: '12' }))
        .status,
    ).toBe(400)
    const { body } = await ysolde.request<TermsStatus>('POST', '/api/account/terms', {
      version: TERMS_VERSION,
      age: 'parental',
    })
    expect(body.accepted).toEqual({ version: TERMS_VERSION, at: server.clock.now, age: 'parental' })
  })

  it('never lets browsers or proxies keep an API answer', async () => {
    const response = await server.app.inject({
      method: 'GET',
      url: '/api/account/terms',
      headers: { cookie: ysolde.cookie },
    })
    expect(response.headers['cache-control']).toBe('no-store')
    expect(response.headers['x-content-type-options']).toBe('nosniff')
  })
})

describe('data export (GDPR art. 15 and 20)', () => {
  it('gives the account, profile, adventurers, memberships, requests and owned campaigns', async () => {
    await ysolde.request('PATCH', '/api/profile', { bio: 'Toujours un pas devant.', avatar: PNG })
    await ysolde.request('POST', `/api/friends/${bran.userId}`)
    await ysolde.request('POST', '/api/account/terms', { version: TERMS_VERSION, age: '15+' })
    const { id } = await campaignWith(server.app, ysolde, [[bran, 'player']])
    await push(ysolde, id, [{ table: 'campaigns', put: [campaignRecord(id)], del: [] }])
    const other = await campaignWith(server.app, bran, [], 'camp-bran')
    await ysolde.request('POST', `/api/invites/${other.inviteCode}/request`, {
      message: 'Une place ?',
    })

    const response = await server.app.inject({
      method: 'GET',
      url: '/api/account/export',
      headers: { cookie: ysolde.cookie },
    })
    expect(response.statusCode).toBe(200)
    expect(response.headers['content-disposition']).toMatch(
      /attachment; filename="codex-mes-donnees-/,
    )
    const data = response.json()
    expect(data).toMatchObject({
      format: 'codex-account-export',
      account: {
        id: ysolde.userId,
        email: 'ysolde@exemple.fr',
        displayName: 'Ysolde',
        terms: { version: TERMS_VERSION, age: '15+' },
      },
      profile: { bio: 'Toujours un pas devant.', avatar: PNG },
      adventurers: [{ userId: bran.userId, displayName: 'Bran', status: 'sent' }],
      memberships: [{ campaignId: id, role: 'owner' }],
      joinRequests: [{ campaignId: 'camp-bran', message: 'Une place ?' }],
    })
    expect(data.campaigns).toHaveLength(1)
    expect(data.campaigns[0].records.campaigns[0]).toMatchObject({ id, name: 'Ombreval' })
    // Never a password hash or a session token.
    expect(JSON.stringify(data)).not.toMatch(/scrypt|token/)
  })

  it('needs a session', async () => {
    const response = await server.app.inject({ method: 'GET', url: '/api/account/export' })
    expect(response.statusCode).toBe(401)
  })
})

describe('account deletion (GDPR art. 17)', () => {
  it('erases profile, adventurers, memberships, requests, owned campaigns and their records', async () => {
    await ysolde.request('POST', `/api/friends/${bran.userId}`)
    const { id } = await campaignWith(server.app, ysolde, [[bran, 'player']])
    await push(ysolde, id, [{ table: 'campaigns', put: [campaignRecord(id)], del: [] }])
    const other = await campaignWith(server.app, bran, [], 'camp-bran')
    await ysolde.request('POST', `/api/invites/${other.inviteCode}/request`, { message: '' })
    await report(ysolde, {})

    expect((await ysolde.request('DELETE', '/api/account', { password: PASSWORD })).status).toBe(
      200,
    )
    const count = async (sql: string, param = ysolde.userId) =>
      Number((await server.db.query<{ n: string }>(sql, [param]))[0]!.n)
    expect(await count('SELECT count(*) AS n FROM users WHERE id = $1')).toBe(0)
    expect(
      await count('SELECT count(*) AS n FROM friendships WHERE requester = $1 OR addressee = $1'),
    ).toBe(0)
    expect(await count('SELECT count(*) AS n FROM members WHERE user_id = $1')).toBe(0)
    expect(await count('SELECT count(*) AS n FROM join_requests WHERE user_id = $1')).toBe(0)
    expect(await count('SELECT count(*) AS n FROM sessions WHERE user_id = $1')).toBe(0)
    expect(await count('SELECT count(*) AS n FROM records WHERE campaign_id = $1', id)).toBe(0)
    // The report stays (evidence about the reported profile) without its author.
    const [kept] = await listReports(server.db)
    expect(kept!.reporter_id).toBeNull()
  })
})

describe('reports (DSA notice and action)', () => {
  it('stores what was reported, acknowledges receipt and checks the notice', async () => {
    await bran.request('PATCH', '/api/profile', { bio: 'Une devise insultante' })
    const { status, body } = await report(ysolde, {})
    expect(status).toBe(200)
    expect(body.reference).toMatch(/^[0-9A-F]{8}$/)
    const [stored] = await listReports(server.db)
    expect(stored).toMatchObject({
      reporter_id: ysolde.userId,
      target_id: bran.userId,
      category: 'harassment',
      status: 'open',
      snapshot: { displayName: 'Bran', bio: 'Une devise insultante' },
    })
    expect(server.mailer.sent.at(-1)).toMatchObject({
      to: 'ysolde@exemple.fr',
      subject: `Codex : signalement reçu (${body.reference})`,
    })

    expect((await report(ysolde, { category: 'nope' })).status).toBe(400)
    expect((await report(ysolde, { explanation: 'court' })).status).toBe(400)
    expect((await report(ysolde, { goodFaith: false })).status).toBe(400)
    expect((await report(ysolde, { targetId: ysolde.userId })).status).toBe(400)
    // Only child sexual abuse may be reported without one's identity (art. 16(2)(c)).
    expect((await report(ysolde, { anonymous: true })).status).toBe(400)
  })

  it('lets child sexual abuse be reported anonymously, without an acknowledgement e-mail', async () => {
    const sent = server.mailer.sent.length
    expect((await report(ysolde, { category: 'childAbuse', anonymous: true })).status).toBe(200)
    const [stored] = await listReports(server.db)
    expect(stored!.reporter_id).toBeNull()
    expect(server.mailer.sent).toHaveLength(sent)
  })

  it('limits how many reports an account files in a day', async () => {
    for (let i = 0; i < 20; i++)
      await server.db.query(
        `INSERT INTO reports (id, reporter_id, target_type, target_id, snapshot, category, explanation, created_at)
         VALUES ($1, $2, 'profile', $3, '{}', 'terms', 'x', $4)`,
        [crypto.randomUUID(), ysolde.userId, bran.userId, new Date(server.clock.now)],
      )
    expect((await report(ysolde, {})).status).toBe(429)
  })
})

describe('moderation (DSA art. 17)', () => {
  it('hides a profile, explains why, tells the reporter and locks the profile', async () => {
    await bran.request('PATCH', '/api/profile', { bio: 'Une devise insultante', avatar: PNG })
    const { body } = await report(ysolde, {})
    const [open] = await listReports(server.db)
    await hideProfile(moderation, bran.userId, {
      reason: 'Ta devise insultait des joueurs.',
      illegal: false,
      reportId: open!.id,
      rename: 'Aventurier',
    })
    type Seen = { profile: { bio: string; avatar: string | null; displayName: string } }
    const seen = await ysolde.request<Seen>('GET', `/api/adventurers/${bran.userId}`)
    expect(seen.body.profile).toMatchObject({ bio: '', avatar: null, displayName: 'Aventurier' })
    const toBran = server.mailer.sent.find((m) => m.to === 'bran@exemple.fr')!
    expect(toBran.text).toContain('Ta devise insultait')
    expect(toBran.text).toContain(body.reference)
    expect(toBran.text).toContain('sans outil automatisé')
    expect(toBran.text).toContain('contester')
    expect(server.mailer.sent.at(-1)).toMatchObject({ to: 'ysolde@exemple.fr' })
    expect(await listReports(server.db)).toHaveLength(0)

    expect((await bran.request('PATCH', '/api/profile', { bio: 'Encore' })).status).toBe(403)
    expect((await bran.request('PATCH', '/api/profile', { displayName: 'Bran' })).status).toBe(200)
    await restoreProfile(moderation, bran.userId)
    expect((await bran.request('PATCH', '/api/profile', { bio: 'Pardon' })).status).toBe(200)
  })

  it('suspends an account: sessions closed, sign-in refused until lifted', async () => {
    await suspendAccount(moderation, bran.userId, { reason: 'Harcèlement répété.', illegal: true })
    expect((await bran.request('GET', '/api/auth/me')).status).toBe(401)
    const credentials = { email: 'bran@exemple.fr', password: PASSWORD }
    const login = await bran.request<{ suspended?: boolean }>(
      'POST',
      '/api/auth/login',
      credentials,
    )
    expect(login.status).toBe(403)
    expect(login.body.suspended).toBe(true)
    // A wrong password says nothing about the suspension.
    const wrong = await bran.request('POST', '/api/auth/login', {
      email: 'bran@exemple.fr',
      password: 'pas le bon mot de passe du tout',
    })
    expect(wrong.status).toBe(401)
    await unsuspendAccount(moderation, bran.userId)
    expect((await bran.request('POST', '/api/auth/login', credentials)).status).toBe(200)
  })

  it('dismisses a report with its reason, then forgets it after a year', async () => {
    await report(ysolde, {})
    const [open] = await listReports(server.db)
    await dismissReport(moderation, open!.id, 'La devise ne contrevient pas aux règles.')
    expect(server.mailer.sent.at(-1)!.text).toContain('aucune mesure')
    expect(await listReports(server.db, true)).toHaveLength(1)
    server.clock.now += 366 * 86_400_000
    expect(await sweepReports({ db: server.db, now: () => server.clock.now })).toBe(1)
  })

  it('reads the command line', () => {
    const args = ['hide-profile', 'u1', '--reason', 'Insultes', '--illegal', '--report', 'r1']
    expect(parseArgs(args)).toEqual({
      command: 'hide-profile',
      target: 'u1',
      flags: { reason: 'Insultes', illegal: true, report: 'r1' },
    })
  })
})

describe('password changes (CNIL 2022-100)', () => {
  it('tells the owner by e-mail', async () => {
    await ysolde.request('POST', '/api/auth/password', {
      current: PASSWORD,
      next: 'une toute nouvelle phrase secrète',
    })
    expect(server.mailer.sent.at(-1)).toMatchObject({
      to: 'ysolde@exemple.fr',
      subject: 'Codex : ton mot de passe a changé',
    })
  })
})
