import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { checkPassword, checkUsername } from '../../shared/passwords.ts'
import { isRecord, type PublicUser } from '../../shared/sync.ts'
import { ApiError, type Ctx } from './app.ts'
import type { Queryable } from './db.ts'
import { dummyPasswordHash, hashPassword, hashToken, newToken, verifyPassword } from './secrets.ts'

/**
 * Online accounts (D-262): e-mail, display name, password. The server keeps a
 * scrypt hash of the password and the hash of each session token; the session
 * travels in an HttpOnly, SameSite=Strict cookie that scripts cannot read.
 */

export const SESSION_COOKIE = 'codex_session'
const SESSION_DAYS = 30
const RESET_MINUTES = 60
/** Failed logins allowed before waiting; the wait doubles up to 15 minutes (as on the device, D-241). */
const FREE_ATTEMPTS = 5
const FIRST_DELAY_MS = 30_000
const MAX_DELAY_MS = 15 * 60_000

export interface SessionUser extends PublicUser {
  tokenHash: string
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: SessionUser
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const emailKey = (email: string) => email.trim().toLowerCase()

function str(body: unknown, key: string, max = 300): string {
  const value = isRecord(body) ? body[key] : undefined
  if (typeof value !== 'string' || value.length > max) throw new ApiError(400, 'invalid')
  return value
}

function cleanName(name: string): string {
  const clean = name.trim().replace(/\s+/g, ' ')
  if (checkUsername(clean)) throw new ApiError(400, 'invalid')
  return clean
}

function cleanEmail(email: string): string {
  const clean = email.trim()
  if (clean.length > 254 || !EMAIL.test(clean)) throw new ApiError(400, 'invalid')
  return clean
}

function assertPassword(password: string, name: string) {
  const problem = checkPassword(password, name)
  if (problem) throw new ApiError(400, 'weakPassword', { problem })
}

interface UserRow {
  id: string
  email: string
  display_name: string
  password_hash: string
  failed_logins: number
  locked_until: Date | string | null
}

const toPublic = (row: { id: string; email: string; display_name: string }): PublicUser => ({
  id: row.id,
  email: row.email,
  displayName: row.display_name,
})

export async function userFromCookie(
  ctx: Ctx,
  request: FastifyRequest,
): Promise<SessionUser | null> {
  const token = request.cookies[SESSION_COOKIE]
  if (!token) return null
  const tokenHash = hashToken(token)
  const [row] = await ctx.db.query<{ id: string; email: string; display_name: string }>(
    `SELECT u.id, u.email, u.display_name FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > $2`,
    [tokenHash, new Date(ctx.now())],
  )
  return row ? { ...toPublic(row), tokenHash } : null
}

/** preHandler: refuses requests without a valid session. */
export function requireUser(ctx: Ctx) {
  return async (request: FastifyRequest) => {
    const user = await userFromCookie(ctx, request)
    if (!user) throw new ApiError(401, 'unauthenticated')
    request.user = user
  }
}

async function openSession(ctx: Ctx, reply: FastifyReply, userId: string, q: Queryable = ctx.db) {
  const token = newToken()
  const expires = new Date(ctx.now() + SESSION_DAYS * 86_400_000)
  await q.query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [
    hashToken(token),
    userId,
    expires,
  ])
  // Old sessions of everyone are swept now and then.
  await q.query('DELETE FROM sessions WHERE expires_at < $1', [new Date(ctx.now())])
  reply.setCookie(SESSION_COOKIE, token, {
    path: '/api',
    httpOnly: true,
    sameSite: 'strict',
    secure: ctx.config.secureCookies,
    expires,
  })
}

const time = (v: Date | string | null) => (v ? new Date(v).getTime() : 0)

export function registerAuth(app: FastifyInstance, ctx: Ctx): void {
  const authed = { preHandler: requireUser(ctx) }
  const tight = (max: number, minutes: number) => ({
    config: { rateLimit: { max, timeWindow: `${minutes} minutes` } },
  })

  app.post('/api/auth/register', tight(10, 60), async (request, reply) => {
    const body = request.body
    // Honeypot: a field people never see. Bots fill it in.
    if (isRecord(body) && typeof body.website === 'string' && body.website)
      throw new ApiError(400, 'invalid')
    const email = cleanEmail(str(body, 'email'))
    const displayName = cleanName(str(body, 'displayName', 80))
    const password = str(body, 'password', 1024)
    assertPassword(password, displayName)
    const id = crypto.randomUUID()
    const hash = await hashPassword(password)
    const user = await ctx.db.tx(async (q) => {
      const [taken] = await q.query('SELECT 1 FROM users WHERE email_key = $1', [emailKey(email)])
      if (taken) throw new ApiError(409, 'emailTaken')
      await q.query(
        `INSERT INTO users (id, email, email_key, display_name, password_hash, last_login_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, email, emailKey(email), displayName, hash, new Date(ctx.now())],
      )
      await openSession(ctx, reply, id, q)
      return { id, email, displayName }
    })
    return { user }
  })

  app.post('/api/auth/login', tight(30, 15), async (request, reply) => {
    const email = str(request.body, 'email')
    const password = str(request.body, 'password', 1024)
    const [row] = await ctx.db.query<UserRow>('SELECT * FROM users WHERE email_key = $1', [
      emailKey(email),
    ])
    if (!row) {
      // Same work as a real check: the answer time tells nothing.
      await verifyPassword(password, await dummyPasswordHash())
      throw new ApiError(401, 'wrongCredentials')
    }
    const lockedUntil = time(row.locked_until)
    if (lockedUntil > ctx.now()) throw new ApiError(429, 'throttled', { retryAt: lockedUntil })
    if (!(await verifyPassword(password, row.password_hash))) {
      const failed = row.failed_logins + 1
      const extra = failed - FREE_ATTEMPTS
      const until = extra >= 0 ? ctx.now() + Math.min(MAX_DELAY_MS, FIRST_DELAY_MS * 2 ** extra) : 0
      await ctx.db.query('UPDATE users SET failed_logins = $2, locked_until = $3 WHERE id = $1', [
        row.id,
        failed,
        until ? new Date(until) : null,
      ])
      throw new ApiError(401, 'wrongCredentials', until ? { retryAt: until } : {})
    }
    await ctx.db.query(
      'UPDATE users SET failed_logins = 0, locked_until = NULL, last_login_at = $2 WHERE id = $1',
      [row.id, new Date(ctx.now())],
    )
    await openSession(ctx, reply, row.id)
    return { user: toPublic(row) }
  })

  app.post('/api/auth/logout', async (request, reply) => {
    const user = await userFromCookie(ctx, request)
    if (user) {
      await ctx.db.query('DELETE FROM sessions WHERE token_hash = $1', [user.tokenHash])
      ctx.hub.closeSession(user.tokenHash)
    }
    reply.clearCookie(SESSION_COOKIE, { path: '/api' })
    return { ok: true }
  })

  app.get('/api/auth/me', authed, async (request) => {
    const { id, email, displayName } = request.user!
    return { user: { id, email, displayName } }
  })

  app.patch('/api/account', authed, async (request) => {
    const displayName = cleanName(str(request.body, 'displayName', 80))
    await ctx.db.query('UPDATE users SET display_name = $2 WHERE id = $1', [
      request.user!.id,
      displayName,
    ])
    const { id, email } = request.user!
    return { user: { id, email, displayName } }
  })

  /** New password: every other session of the account is closed. */
  app.post('/api/auth/password', { ...authed, ...tight(10, 15) }, async (request) => {
    const current = str(request.body, 'current', 1024)
    const next = str(request.body, 'next', 1024)
    const user = request.user!
    const [row] = await ctx.db.query<UserRow>('SELECT * FROM users WHERE id = $1', [user.id])
    if (!row || !(await verifyPassword(current, row.password_hash)))
      throw new ApiError(401, 'wrongCredentials')
    assertPassword(next, row.display_name)
    await ctx.db.query('UPDATE users SET password_hash = $2 WHERE id = $1', [
      user.id,
      await hashPassword(next),
    ])
    await ctx.db.query('DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2', [
      user.id,
      user.tokenHash,
    ])
    return { ok: true }
  })

  /** Forgotten password: a single-use link by e-mail. The answer never says whether the address exists. */
  app.post('/api/auth/reset/request', tight(5, 60), async (request) => {
    const email = str(request.body, 'email')
    if (!ctx.mailer) throw new ApiError(503, 'mailUnavailable')
    const [row] = await ctx.db.query<UserRow>('SELECT * FROM users WHERE email_key = $1', [
      emailKey(email),
    ])
    if (row) {
      const token = newToken()
      await ctx.db.query('DELETE FROM password_resets WHERE user_id = $1', [row.id])
      await ctx.db.query(
        'INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
        [hashToken(token), row.id, new Date(ctx.now() + RESET_MINUTES * 60_000)],
      )
      const link = `${ctx.config.publicUrl}/app/#/reinitialiser/${token}`
      await ctx.mailer.send(
        row.email,
        'Codex : choisis un nouveau mot de passe',
        [
          `Bonjour ${row.display_name},`,
          '',
          'Quelqu’un (toi, sans doute) a demandé à changer le mot de passe de ton compte Codex.',
          `Ouvre ce lien dans l’heure pour en choisir un nouveau :`,
          link,
          '',
          'Si ce n’est pas toi, ignore ce message : ton mot de passe ne change pas.',
        ].join('\n'),
      )
    }
    return { ok: true }
  })

  app.post('/api/auth/reset/confirm', tight(10, 60), async (request, reply) => {
    const token = str(request.body, 'token', 200)
    const password = str(request.body, 'password', 1024)
    const [reset] = await ctx.db.query<{ user_id: string; expires_at: Date | string }>(
      'SELECT user_id, expires_at FROM password_resets WHERE token_hash = $1',
      [hashToken(token)],
    )
    if (!reset || time(reset.expires_at) < ctx.now()) throw new ApiError(400, 'tokenExpired')
    const [row] = await ctx.db.query<UserRow>('SELECT * FROM users WHERE id = $1', [reset.user_id])
    if (!row) throw new ApiError(400, 'tokenExpired')
    assertPassword(password, row.display_name)
    await ctx.db.tx(async (q) => {
      await q.query(
        'UPDATE users SET password_hash = $2, failed_logins = 0, locked_until = NULL WHERE id = $1',
        [row.id, await hashPassword(password)],
      )
      await q.query('DELETE FROM password_resets WHERE user_id = $1', [row.id])
      await q.query('DELETE FROM sessions WHERE user_id = $1', [row.id])
      await openSession(ctx, reply, row.id, q)
    })
    ctx.hub.closeUser(row.id)
    return { user: toPublic(row) }
  })

  /** Right to erasure: the account, its campaigns and everything in them. */
  app.delete('/api/account', { ...authed, ...tight(10, 15) }, async (request, reply) => {
    const password = str(request.body, 'password', 1024)
    const user = request.user!
    const [row] = await ctx.db.query<UserRow>('SELECT * FROM users WHERE id = $1', [user.id])
    if (!row || !(await verifyPassword(password, row.password_hash)))
      throw new ApiError(401, 'wrongCredentials')
    const owned = await ctx.db.query<{ id: string }>(
      'SELECT id FROM campaigns WHERE owner_id = $1',
      [user.id],
    )
    const affected = await ctx.hub.membersOf(owned.map((c) => c.id))
    await ctx.db.query('DELETE FROM users WHERE id = $1', [user.id])
    ctx.hub.closeUser(user.id)
    ctx.hub.notifyCampaigns(affected)
    reply.clearCookie(SESSION_COOKIE, { path: '/api' })
    return { ok: true }
  })
}

/** Accounts unused for three years are deleted, with their campaigns (privacy notice). */
export const INACTIVE_YEARS = 3

export async function sweepInactive(ctx: Pick<Ctx, 'db' | 'now'>): Promise<number> {
  const limit = new Date(ctx.now() - INACTIVE_YEARS * 365.25 * 86_400_000)
  const gone = await ctx.db.query<{ id: string }>(
    'DELETE FROM users WHERE COALESCE(last_login_at, created_at) < $1 RETURNING id',
    [limit],
  )
  return gone.length
}
