import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { sweepInactive } from './auth.ts'
import { agent, campaignWith, PASSWORD, signUp, testServer } from './testing.ts'

let server: Awaited<ReturnType<typeof testServer>>
beforeEach(async () => {
  server = await testServer()
})
afterEach(() => server.close())

describe('online accounts', () => {
  it('registers, remembers the session in an HttpOnly cookie and logs out', async () => {
    const a = agent(server.app)
    const register = await server.app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'Ayla@Exemple.fr', displayName: '  Ayla  ', password: PASSWORD },
    })
    expect(register.statusCode).toBe(200)
    const cookie = register.cookies.find((c) => c.name === 'codex_session')!
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Strict', path: '/api' })
    a.cookie = `codex_session=${cookie.value}`

    const me = await a.request<{ user: { displayName: string; email: string } }>(
      'GET',
      '/api/auth/me',
    )
    expect(me.body.user).toMatchObject({ displayName: 'Ayla', email: 'Ayla@Exemple.fr' })

    await a.request('POST', '/api/auth/logout')
    expect((await a.request('GET', '/api/auth/me')).status).toBe(401)
  })

  it('refuses a taken e-mail (any case), a weak password, bad input and the honeypot', async () => {
    await signUp(server.app, 'Ayla')
    const a = agent(server.app)
    const base = { email: 'other@exemple.fr', displayName: 'Bob', password: PASSWORD }
    expect(
      (await a.request('POST', '/api/auth/register', { ...base, email: 'AYLA@exemple.fr' })).body,
    ).toEqual({ error: 'emailTaken' })
    expect(
      (await a.request('POST', '/api/auth/register', { ...base, password: 'court' })).body,
    ).toMatchObject({ error: 'weakPassword', problem: 'passwordTooShort' })
    expect(
      (await a.request('POST', '/api/auth/register', { ...base, email: 'pas-un-email' })).status,
    ).toBe(400)
    expect(
      (await a.request('POST', '/api/auth/register', { ...base, website: 'spam.example' })).status,
    ).toBe(400)
    expect((await a.request('POST', '/api/auth/register', 'texte')).status).toBe(415)
  })

  it('never stores the password or the session token in clear', async () => {
    await signUp(server.app, 'Ayla')
    const [user] = await server.db.query<{ password_hash: string }>(
      'SELECT password_hash FROM users',
    )
    expect(user!.password_hash).toMatch(/^scrypt\$32768\$8\$1\$/)
    expect(user!.password_hash).not.toContain(PASSWORD)
    const [session] = await server.db.query<{ token_hash: string }>(
      'SELECT token_hash FROM sessions',
    )
    expect(session!.token_hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('logs in, with a generic error and a growing wait after five failures', async () => {
    await signUp(server.app, 'Ayla')
    const a = agent(server.app)
    const unknown = await a.request('POST', '/api/auth/login', {
      email: 'nobody@exemple.fr',
      password: PASSWORD,
    })
    expect(unknown).toEqual({ status: 401, body: { error: 'wrongCredentials' } })
    for (let i = 0; i < 4; i++)
      expect(
        (
          await a.request('POST', '/api/auth/login', {
            email: 'ayla@exemple.fr',
            password: 'mauvais',
          })
        ).body,
      ).toEqual({ error: 'wrongCredentials' })
    const fifth = await a.request('POST', '/api/auth/login', {
      email: 'ayla@exemple.fr',
      password: 'mauvais',
    })
    expect(fifth.body.retryAt).toBe(server.clock.now + 30_000)
    // Even the right password waits.
    expect(
      (await a.request('POST', '/api/auth/login', { email: 'ayla@exemple.fr', password: PASSWORD }))
        .body,
    ).toMatchObject({ error: 'throttled' })
    server.clock.now += 31_000
    const ok = await a.request<{ user: { displayName: string } }>('POST', '/api/auth/login', {
      email: 'AYLA@exemple.fr',
      password: PASSWORD,
    })
    expect(ok.body.user.displayName).toBe('Ayla')
    expect((await a.request('GET', '/api/auth/me')).status).toBe(200)
  })

  it('sessions expire after 30 days', async () => {
    const a = await signUp(server.app, 'Ayla')
    server.clock.now += 31 * 86_400_000
    expect((await a.request('GET', '/api/auth/me')).status).toBe(401)
  })

  it('a new password closes the other sessions', async () => {
    const a = await signUp(server.app, 'Ayla')
    const b = agent(server.app)
    await b.request('POST', '/api/auth/login', { email: 'ayla@exemple.fr', password: PASSWORD })
    expect(
      (
        await a.request('POST', '/api/auth/password', {
          current: 'faux',
          next: 'une autre phrase bien longue',
        })
      ).status,
    ).toBe(401)
    expect(
      (
        await a.request('POST', '/api/auth/password', {
          current: PASSWORD,
          next: 'une autre phrase bien longue',
        })
      ).status,
    ).toBe(200)
    expect((await a.request('GET', '/api/auth/me')).status).toBe(200)
    expect((await b.request('GET', '/api/auth/me')).status).toBe(401)
  })

  it('resets a forgotten password through a single-use link sent by e-mail', async () => {
    const old = await signUp(server.app, 'Ayla')
    const a = agent(server.app)
    // Unknown addresses get the same answer, and no e-mail.
    expect(
      (await a.request('POST', '/api/auth/reset/request', { email: 'nobody@exemple.fr' })).body,
    ).toEqual({ ok: true })
    expect(server.mailer.sent).toHaveLength(0)
    await a.request('POST', '/api/auth/reset/request', { email: 'ayla@exemple.fr' })
    expect(server.mailer.sent[0]!.to).toBe('ayla@exemple.fr')
    const token = /reinitialiser\/([\w-]+)/.exec(server.mailer.sent[0]!.text)![1]!

    const next = 'nouvelle phrase de passe secrète'
    const reset = await a.request<{ user: { displayName: string } }>(
      'POST',
      '/api/auth/reset/confirm',
      { token, password: next },
    )
    expect(reset.body.user.displayName).toBe('Ayla')
    expect((await a.request('GET', '/api/auth/me')).status).toBe(200)
    expect((await old.request('GET', '/api/auth/me')).status).toBe(401)
    expect(
      (await a.request('POST', '/api/auth/reset/confirm', { token, password: next })).body,
    ).toEqual({ error: 'tokenExpired' })
    expect(
      (
        await agent(server.app).request('POST', '/api/auth/login', {
          email: 'ayla@exemple.fr',
          password: next,
        })
      ).status,
    ).toBe(200)
  })

  it('reset links expire after an hour', async () => {
    await signUp(server.app, 'Ayla')
    const a = agent(server.app)
    await a.request('POST', '/api/auth/reset/request', { email: 'ayla@exemple.fr' })
    const token = /reinitialiser\/([\w-]+)/.exec(server.mailer.sent[0]!.text)![1]!
    server.clock.now += 61 * 60_000
    expect(
      (
        await a.request('POST', '/api/auth/reset/confirm', {
          token,
          password: 'nouvelle phrase de passe secrète',
        })
      ).body,
    ).toEqual({ error: 'tokenExpired' })
  })

  it('deleting the account erases its campaigns and memberships', async () => {
    const gm = await signUp(server.app, 'Gm')
    const player = await signUp(server.app, 'Lyra')
    await campaignWith(server.app, gm, [[player, 'player']])
    expect((await gm.request('DELETE', '/api/account', { password: 'faux' })).status).toBe(401)
    expect((await gm.request('DELETE', '/api/account', { password: PASSWORD })).status).toBe(200)
    expect(await server.db.query('SELECT * FROM campaigns')).toEqual([])
    expect(await server.db.query('SELECT * FROM members')).toEqual([])
    expect(
      (await player.request<{ campaigns: unknown[] }>('GET', '/api/campaigns')).body.campaigns,
    ).toEqual([])
  })

  it('refuses changes coming from another site', async () => {
    const a = await signUp(server.app, 'Ayla')
    const response = await a.request(
      'PATCH',
      '/api/account',
      { displayName: 'Mal' },
      { origin: 'https://evil.example', host: 'codex.fr' },
    )
    expect(response.status).toBe(403)
    expect(
      (
        await a.request(
          'PATCH',
          '/api/account',
          { displayName: 'Ayla la Brave' },
          { origin: 'http://localhost:5173', host: 'localhost:5173' },
        )
      ).body,
    ).toMatchObject({ user: { displayName: 'Ayla la Brave' } })
  })

  it('deletes accounts unused for three years, with their campaigns', async () => {
    const gm = await signUp(server.app, 'Gm')
    await campaignWith(server.app, gm)
    server.clock.now += 2 * 365 * 86_400_000
    expect(await sweepInactive({ db: server.db, now: () => server.clock.now })).toBe(0)
    server.clock.now += 366 * 86_400_000
    expect(await sweepInactive({ db: server.db, now: () => server.clock.now })).toBe(1)
    expect(await server.db.query('SELECT * FROM campaigns')).toEqual([])
  })
})
