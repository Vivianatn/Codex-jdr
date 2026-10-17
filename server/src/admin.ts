import { createHash, timingSafeEqual } from 'node:crypto'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import {
  ADMIN_REASON_MAX,
  ADMIN_REASON_MIN,
  type AdminAction,
  type AdminAuditRow,
  type AdminCampaignRow,
  type AdminDecision,
  type AdminProfile,
  type AdminReport,
  type AdminStats,
  type AdminUserDetail,
  type AdminUserRow,
} from '../../shared/admin.ts'
import { isRecord } from '../../shared/sync.ts'
import { ApiError, type Ctx } from './app.ts'
import { deleteAccount } from './auth.ts'
import { referenceOf } from './compliance.ts'
import {
  deleteAccountFor,
  dismissReport,
  getReport,
  hideProfile,
  restoreProfile,
  suspendAccount,
  unsuspendAccount,
  type ModerationCtx,
} from './moderation.ts'
import { dummyPasswordHash, hashToken, newToken, verifyPassword } from './secrets.ts'

/**
 * Administration dashboard (D-275), at /api/admin/*. One administrator whose
 * name and scrypt password hash come only from the environment
 * (ADMIN_USERNAME, ADMIN_PASSWORD_HASH); unset = nobody can sign in. Its
 * session is separate from accounts': an HttpOnly, SameSite=Strict cookie on
 * /api/admin, 8 hours, the token's hash stored in `admin_sessions`. Every
 * action, and every sign-in attempt, goes to `admin_audit`. Moderation reuses
 * moderation.ts (statement of reasons by e-mail, DSA art. 17). Campaign
 * contents stay encrypted and are never read here.
 */

export const ADMIN_COOKIE = 'codex_admin'
export const ADMIN_PATH = '/api/admin'
export const ADMIN_SESSION_HOURS = 8
/** Failed sign-ins allowed per address before waiting; the wait doubles up to 15 minutes. */
export const ADMIN_FREE_ATTEMPTS = 5
const FIRST_DELAY_MS = 30_000
const MAX_DELAY_MS = 15 * 60_000
/** Whatever the address: this many failures in 15 minutes close sign-in for 15 minutes. */
export const ADMIN_GLOBAL_FAILURES = 30
const GLOBAL_WINDOW_MS = 15 * 60_000
/** The audit log is kept one year (privacy notice: evidence of moderation decisions). */
export const ADMIN_AUDIT_DAYS = 365

declare module 'fastify' {
  interface FastifyRequest {
    admin?: { username: string; tokenHash: string }
  }
}

/** Failed sign-ins in memory, per address and overall (a restart forgets them: the 8 h session does too). */
export class LoginGuard {
  private readonly byIp = new Map<string, { failed: number; until: number; last: number }>()
  private readonly recent: number[] = []

  /** When sign-in opens again for this address (0 = now). */
  retryAt(ip: string, now: number): number {
    const own = this.byIp.get(ip)?.until ?? 0
    this.trim(now)
    const global =
      this.recent.length >= ADMIN_GLOBAL_FAILURES
        ? this.recent[this.recent.length - ADMIN_GLOBAL_FAILURES]! + GLOBAL_WINDOW_MS
        : 0
    const at = Math.max(own, global)
    return at > now ? at : 0
  }

  fail(ip: string, now: number): number {
    const entry = this.byIp.get(ip) ?? { failed: 0, until: 0, last: now }
    entry.failed++
    entry.last = now
    const extra = entry.failed - ADMIN_FREE_ATTEMPTS
    entry.until = extra >= 0 ? now + Math.min(MAX_DELAY_MS, FIRST_DELAY_MS * 2 ** extra) : 0
    this.byIp.set(ip, entry)
    this.recent.push(now)
    if (this.byIp.size > 1000)
      for (const [key, value] of this.byIp) if (value.last < now - 86_400_000) this.byIp.delete(key)
    return this.retryAt(ip, now)
  }

  succeed(ip: string): void {
    this.byIp.delete(ip)
  }

  private trim(now: number) {
    while (this.recent.length && this.recent[0]! <= now - GLOBAL_WINDOW_MS) this.recent.shift()
  }
}

const sha = (value: string) => createHash('sha256').update(value).digest()
/** Constant-time comparison of two strings of any length. */
const sameText = (a: string, b: string) => timingSafeEqual(sha(a), sha(b))

const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null)
const num = (v: unknown) => Number(v ?? 0)

function text(body: unknown, key: string, max: number): string {
  const value = isRecord(body) ? body[key] : undefined
  if (typeof value !== 'string' || value.length > max) throw new ApiError(400, 'invalid')
  return value
}

function decisionOf(body: unknown): AdminDecision {
  const reason = text(body, 'reason', ADMIN_REASON_MAX).trim()
  if (reason.length < ADMIN_REASON_MIN) throw new ApiError(400, 'invalid')
  const reportId = isRecord(body) && typeof body.reportId === 'string' ? body.reportId : undefined
  return {
    reason,
    illegal: isRecord(body) && body.illegal === true,
    ...(reportId ? { reportId } : {}),
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function idParam(request: FastifyRequest): string {
  const { id } = request.params as { id?: string }
  if (!id || !UUID.test(id)) throw new ApiError(404, 'notFound')
  return id
}

interface UserRow {
  id: string
  email: string
  display_name: string
  friend_code: string | null
  created_at: unknown
  last_login_at: unknown
  suspended_at: unknown
  profile_hidden_at: unknown
}

const USER_COLUMNS =
  'id, email, display_name, friend_code, created_at, last_login_at, suspended_at, profile_hidden_at'

const userRow = (r: UserRow): AdminUserRow => ({
  id: r.id,
  displayName: r.display_name,
  email: r.email,
  friendCode: r.friend_code,
  createdAt: iso(r.created_at)!,
  lastLoginAt: iso(r.last_login_at),
  suspended: !!r.suspended_at,
  profileHidden: !!r.profile_hidden_at,
})

const profileOf = (p: Partial<AdminProfile> | null | undefined): AdminProfile => ({
  displayName: p?.displayName ?? '',
  bio: p?.bio ?? '',
  avatar: p?.avatar ?? null,
  banner: p?.banner ?? null,
})

export function registerAdmin(app: FastifyInstance, ctx: Ctx): void {
  const guard = new LoginGuard()
  const configured = () => !!(ctx.config.adminUsername && ctx.config.adminPasswordHash)
  const moderation = (): ModerationCtx => ({
    db: ctx.db,
    mailer: ctx.mailer,
    now: ctx.now,
    contact: ctx.config.moderationEmail || ctx.config.mailFrom,
  })

  async function audit(
    request: FastifyRequest,
    actor: string,
    action: AdminAction,
    target: { type: 'user' | 'report'; id: string; label?: string | null } | null = null,
    detail: Record<string, unknown> | null = null,
  ) {
    await ctx.db.query(
      `INSERT INTO admin_audit (actor, action, target_type, target_id, target_label, detail, ip, at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        actor.slice(0, 80),
        action,
        target?.type ?? null,
        target?.id ?? null,
        target?.label ?? null,
        detail ? JSON.stringify(detail) : null,
        request.ip || null,
        new Date(ctx.now()),
      ],
    )
  }

  async function sessionOf(request: FastifyRequest) {
    const token = request.cookies[ADMIN_COOKIE]
    if (!token || !configured()) return null
    const tokenHash = hashToken(token)
    const [row] = await ctx.db.query<{ username: string }>(
      'SELECT username FROM admin_sessions WHERE token_hash = $1 AND expires_at > $2',
      [tokenHash, new Date(ctx.now())],
    )
    // A session opened under another admin name (the env changed) is void.
    if (!row || row.username !== ctx.config.adminUsername) return null
    return { username: row.username, tokenHash }
  }

  async function userOr404(id: string): Promise<UserRow> {
    const [row] = await ctx.db.query<UserRow>(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [
      id,
    ])
    if (!row) throw new ApiError(404, 'notFound')
    return row
  }

  /** The report named in a decision must exist and be about this account. */
  async function checkReport(decision: AdminDecision, userId: string) {
    if (!decision.reportId) return
    if (!UUID.test(decision.reportId)) throw new ApiError(400, 'invalid')
    const report = await getReport(ctx.db, decision.reportId)
    if (!report || report.target_id !== userId) throw new ApiError(400, 'invalid')
    if (report.status !== 'open') throw new ApiError(409, 'conflict')
  }

  void app.register(
    async (scope) => {
      // Nothing here is ever cached, kept by a proxy or indexed.
      scope.addHook('onSend', async (_request, reply) => {
        reply.header('Cache-Control', 'no-store')
        reply.header('X-Robots-Tag', 'noindex, nofollow')
      })
      // CSRF: besides SameSite=Strict and the Origin check of app.ts, every change is JSON
      // (a cross-site form cannot send application/json without a preflight).
      scope.addHook('onRequest', async (request) => {
        if (request.method === 'GET' || request.method === 'HEAD') return
        const type = request.headers['content-type'] ?? ''
        if (!/^application\/json\b/i.test(type)) throw new ApiError(415, 'invalid')
      })

      const authed = {
        preHandler: async (request: FastifyRequest) => {
          const session = await sessionOf(request)
          if (!session) throw new ApiError(401, 'unauthenticated', { configured: configured() })
          request.admin = session
        },
      }
      const loginLimit = {
        config: {
          rateLimit: { max: ctx.config.relaxLimits ? 1000 : 10, timeWindow: '15 minutes' },
        },
      }

      scope.get('/me', async (request) => {
        const session = await sessionOf(request)
        if (!session) throw new ApiError(401, 'unauthenticated', { configured: configured() })
        return { username: session.username }
      })

      scope.post('/login', loginLimit, async (request, reply) => {
        const username = text(request.body, 'username', 200)
        const password = text(request.body, 'password', 1024)
        if (!configured()) throw new ApiError(503, 'forbidden', { configured: false })
        const ip = request.ip || 'unknown'
        const waitUntil = guard.retryAt(ip, ctx.now())
        if (waitUntil) throw new ApiError(429, 'throttled', { retryAt: waitUntil })
        // Both checks always run: the answer time tells nothing about which one failed.
        const nameOk = sameText(username, ctx.config.adminUsername)
        const passwordOk = await verifyPassword(
          password,
          nameOk ? ctx.config.adminPasswordHash : await dummyPasswordHash(),
        )
        if (!nameOk || !passwordOk) {
          const retryAt = guard.fail(ip, ctx.now())
          // The name tried is kept only when it is the admin's: a password typed in the wrong field never is.
          await audit(request, nameOk ? username : '?', 'loginFailed')
          throw new ApiError(401, 'wrongCredentials', retryAt ? { retryAt } : {})
        }
        guard.succeed(ip)
        const token = newToken()
        const expires = new Date(ctx.now() + ADMIN_SESSION_HOURS * 3_600_000)
        await ctx.db.query('DELETE FROM admin_sessions WHERE expires_at < $1', [
          new Date(ctx.now()),
        ])
        await ctx.db.query(
          'INSERT INTO admin_sessions (token_hash, username, expires_at) VALUES ($1, $2, $3)',
          [hashToken(token), ctx.config.adminUsername, expires],
        )
        reply.setCookie(ADMIN_COOKIE, token, {
          path: ADMIN_PATH,
          httpOnly: true,
          sameSite: 'strict',
          secure: ctx.config.secureCookies,
          expires,
        })
        await audit(request, ctx.config.adminUsername, 'login')
        return { username: ctx.config.adminUsername }
      })

      scope.post('/logout', async (request, reply) => {
        const session = await sessionOf(request)
        if (session) {
          await ctx.db.query('DELETE FROM admin_sessions WHERE token_hash = $1', [
            session.tokenHash,
          ])
          await audit(request, session.username, 'logout')
        }
        reply.clearCookie(ADMIN_COOKIE, { path: ADMIN_PATH })
        return { ok: true }
      })

      scope.get('/stats', authed, async (): Promise<AdminStats> => {
        const now = ctx.now()
        const ago = (days: number) => new Date(now - days * 86_400_000)
        const [users] = await ctx.db.query<Record<string, unknown>>(
          `SELECT count(*) AS total,
             count(*) FILTER (WHERE created_at >= $1) AS new7,
             count(*) FILTER (WHERE created_at >= $2) AS new30,
             count(*) FILTER (WHERE suspended_at IS NOT NULL) AS suspended,
             count(*) FILTER (WHERE profile_hidden_at IS NOT NULL) AS hidden
           FROM users`,
          [ago(7), ago(30)],
        )
        const [campaigns] = await ctx.db.query<Record<string, unknown>>(
          `SELECT count(*) AS total,
             count(*) FILTER (WHERE live IS NOT NULL AND jsonb_typeof(live) = 'object') AS live,
             count(*) FILTER (WHERE live->>'mode' = 'online') AS live_online,
             count(*) FILTER (WHERE listed) AS listed
           FROM campaigns`,
        )
        const [members] = await ctx.db.query<{ count: unknown }>('SELECT count(*) FROM members')
        const [reports] = await ctx.db.query<{ count: unknown }>(
          "SELECT count(*) FROM reports WHERE status = 'open'",
        )
        // Day by day over 30 days (UTC), the empty days included.
        const start = new Date(now)
        start.setUTCHours(0, 0, 0, 0)
        start.setUTCDate(start.getUTCDate() - 29)
        const rows = await ctx.db.query<{ created_at: unknown }>(
          'SELECT created_at FROM users WHERE created_at >= $1',
          [start],
        )
        const counts = new Map<string, number>()
        for (const r of rows) {
          const day = iso(r.created_at)!.slice(0, 10)
          counts.set(day, (counts.get(day) ?? 0) + 1)
        }
        const signups = Array.from({ length: 30 }, (_, i) => {
          const day = new Date(start.getTime() + i * 86_400_000).toISOString().slice(0, 10)
          return { day, count: counts.get(day) ?? 0 }
        })
        return {
          users: {
            total: num(users?.total),
            new7: num(users?.new7),
            new30: num(users?.new30),
            suspended: num(users?.suspended),
            hidden: num(users?.hidden),
          },
          campaigns: {
            total: num(campaigns?.total),
            live: num(campaigns?.live),
            liveOnline: num(campaigns?.live_online),
            listed: num(campaigns?.listed),
          },
          members: num(members?.count),
          openReports: num(reports?.count),
          signups,
        }
      })

      scope.get('/reports', authed, async (request): Promise<{ reports: AdminReport[] }> => {
        const all = (request.query as { status?: string }).status === 'all'
        const rows = await ctx.db.query<Record<string, unknown>>(
          `SELECT r.*, t.display_name AS target_name, t.suspended_at AS target_suspended,
             t.profile_hidden_at AS target_hidden, p.display_name AS reporter_name
           FROM reports r
           LEFT JOIN users t ON t.id::text = r.target_id
           LEFT JOIN users p ON p.id = r.reporter_id
           ${all ? '' : "WHERE r.status = 'open'"}
           ORDER BY (r.status = 'open') DESC, r.created_at ${all ? 'DESC' : 'ASC'}
           LIMIT 500`,
        )
        return {
          reports: rows.map((r) => ({
            id: r.id as string,
            reference: referenceOf(r.id as string),
            category: r.category as string,
            explanation: r.explanation as string,
            status: r.status as AdminReport['status'],
            decision: (r.decision as string | null) ?? null,
            createdAt: iso(r.created_at)!,
            decidedAt: iso(r.decided_at),
            snapshot: profileOf(r.snapshot as Partial<AdminProfile>),
            target: {
              id: r.target_id as string,
              displayName: (r.target_name as string | null) ?? null,
              suspended: !!r.target_suspended,
              profileHidden: !!r.target_hidden,
            },
            reporter: r.reporter_id
              ? { id: r.reporter_id as string, displayName: (r.reporter_name as string) ?? '' }
              : null,
          })),
        }
      })

      scope.post('/reports/:id/dismiss', authed, async (request) => {
        const id = idParam(request)
        const reason = text(request.body, 'reason', ADMIN_REASON_MAX).trim()
        if (reason.length < ADMIN_REASON_MIN) throw new ApiError(400, 'invalid')
        const report = await getReport(ctx.db, id)
        if (!report) throw new ApiError(404, 'notFound')
        if (report.status !== 'open') throw new ApiError(409, 'conflict')
        await dismissReport(moderation(), id, reason)
        await audit(
          request,
          request.admin!.username,
          'dismiss',
          { type: 'report', id, label: referenceOf(id) },
          { reason },
        )
        return { ok: true }
      })

      scope.get('/users', authed, async (request): Promise<{ users: AdminUserRow[] }> => {
        const q = String((request.query as { q?: string }).q ?? '')
          .trim()
          .slice(0, 100)
        const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
        const rows = await ctx.db.query<UserRow>(
          q
            ? `SELECT ${USER_COLUMNS} FROM users
               WHERE display_name ILIKE $1 OR email_key LIKE lower($1) OR friend_code = upper($2)
                 OR id::text = lower($2)
               ORDER BY created_at DESC LIMIT 100`
            : `SELECT ${USER_COLUMNS} FROM users ORDER BY created_at DESC LIMIT 100`,
          q ? [like, q] : [],
        )
        return { users: rows.map(userRow) }
      })

      scope.get('/users/:id', authed, async (request): Promise<{ user: AdminUserDetail }> => {
        const id = idParam(request)
        const [row] = await ctx.db.query<
          UserRow & {
            bio: string
            avatar: string | null
            banner: string | null
            terms_version: string | null
            terms_accepted_at: unknown
          }
        >(
          `SELECT ${USER_COLUMNS}, bio, avatar, banner, terms_version, terms_accepted_at
           FROM users WHERE id = $1`,
          [id],
        )
        if (!row) throw new ApiError(404, 'notFound')
        const [counts] = await ctx.db.query<Record<string, unknown>>(
          `SELECT
             (SELECT count(*) FROM campaigns WHERE owner_id = $1) AS owned,
             (SELECT count(*) FROM members WHERE user_id = $1 AND role <> 'owner') AS memberships,
             (SELECT count(*) FROM reports WHERE target_id = $1::text) AS against,
             (SELECT count(*) FROM reports WHERE target_id = $1::text AND status = 'open') AS open_against,
             (SELECT count(*) FROM reports WHERE reporter_id = $1) AS filed`,
          [id],
        )
        return {
          user: {
            ...userRow(row),
            profile: profileOf({
              displayName: row.display_name,
              bio: row.bio,
              avatar: row.avatar,
              banner: row.banner,
            }),
            termsVersion: row.terms_version,
            termsAcceptedAt: iso(row.terms_accepted_at),
            campaignsOwned: num(counts?.owned),
            memberships: num(counts?.memberships),
            reportsAgainst: num(counts?.against),
            openReportsAgainst: num(counts?.open_against),
            reportsFiled: num(counts?.filed),
            online: ctx.hub.isOnline(id),
          },
        }
      })

      const target = (row: UserRow) => ({
        type: 'user' as const,
        id: row.id,
        label: row.display_name,
      })

      scope.post('/users/:id/hide-profile', authed, async (request) => {
        const row = await userOr404(idParam(request))
        const decision = decisionOf(request.body)
        await checkReport(decision, row.id)
        const rename = isRecord(request.body) ? request.body.rename : undefined
        if (typeof rename === 'string' && rename.trim())
          Object.assign(decision, { rename: rename.trim().replace(/\s+/g, ' ').slice(0, 40) })
        await hideProfile(moderation(), row.id, decision)
        await audit(request, request.admin!.username, 'hideProfile', target(row), { ...decision })
        return { ok: true }
      })

      scope.post('/users/:id/restore-profile', authed, async (request) => {
        const row = await userOr404(idParam(request))
        await restoreProfile(moderation(), row.id)
        await audit(request, request.admin!.username, 'restoreProfile', target(row))
        return { ok: true }
      })

      scope.post('/users/:id/suspend', authed, async (request) => {
        const row = await userOr404(idParam(request))
        const decision = decisionOf(request.body)
        await checkReport(decision, row.id)
        await suspendAccount(moderation(), row.id, decision)
        // Its open sockets close too (suspendAccount already removed its sessions).
        ctx.hub.closeUser(row.id)
        await audit(request, request.admin!.username, 'suspend', target(row), { ...decision })
        return { ok: true }
      })

      scope.post('/users/:id/unsuspend', authed, async (request) => {
        const row = await userOr404(idParam(request))
        await unsuspendAccount(moderation(), row.id)
        await audit(request, request.admin!.username, 'unsuspend', target(row))
        return { ok: true }
      })

      /** Strong confirmation: the exact display name, typed again. */
      scope.delete('/users/:id', authed, async (request) => {
        const row = await userOr404(idParam(request))
        const decision = decisionOf(request.body)
        if (text(request.body, 'confirm', 200) !== row.display_name)
          throw new ApiError(400, 'invalid', { confirm: true })
        await checkReport(decision, row.id)
        await deleteAccountFor(moderation(), row.id, decision, (id) => deleteAccount(ctx, id))
        await audit(request, request.admin!.username, 'deleteAccount', target(row), {
          ...decision,
        })
        return { ok: true }
      })

      scope.get(
        '/campaigns',
        authed,
        async (request): Promise<{ campaigns: AdminCampaignRow[] }> => {
          const q = String((request.query as { q?: string }).q ?? '')
            .trim()
            .slice(0, 100)
          const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
          // Metadata only: names, owner, members, game state. The records stay sealed.
          const rows = await ctx.db.query<Record<string, unknown>>(
            `SELECT c.id, c.name, c.owner_id, u.display_name AS owner_name, c.listed, c.created_at,
             c.live->>'mode' AS live_mode, jsonb_typeof(c.live) = 'object' AS is_live,
             (SELECT count(*) FROM members m WHERE m.campaign_id = c.id) AS members
           FROM campaigns c JOIN users u ON u.id = c.owner_id
           ${q ? 'WHERE c.name ILIKE $1 OR u.display_name ILIKE $1' : ''}
           ORDER BY c.created_at DESC LIMIT 200`,
            q ? [like] : [],
          )
          return {
            campaigns: rows.map((r) => ({
              id: r.id as string,
              name: r.name as string,
              owner: { id: r.owner_id as string, displayName: r.owner_name as string },
              members: num(r.members),
              live: r.is_live ? (r.live_mode === 'online' ? 'online' : 'local') : null,
              listed: !!r.listed,
              createdAt: iso(r.created_at)!,
            })),
          }
        },
      )

      scope.get('/audit', authed, async (request): Promise<{ entries: AdminAuditRow[] }> => {
        const before = Number((request.query as { before?: string }).before)
        const rows = await ctx.db.query<Record<string, unknown>>(
          `SELECT id, actor, action, target_type, target_id, target_label, detail, at
           FROM admin_audit ${Number.isSafeInteger(before) && before > 0 ? 'WHERE id < $1' : ''}
           ORDER BY id DESC LIMIT 100`,
          Number.isSafeInteger(before) && before > 0 ? [before] : [],
        )
        return {
          entries: rows.map((r) => ({
            id: String(r.id),
            actor: r.actor as string,
            action: r.action as AdminAction,
            targetType: (r.target_type as AdminAuditRow['targetType']) ?? null,
            targetId: (r.target_id as string | null) ?? null,
            targetLabel: (r.target_label as string | null) ?? null,
            detail: (r.detail as Record<string, unknown> | null) ?? null,
            at: iso(r.at)!,
          })),
        }
      })
    },
    { prefix: ADMIN_PATH },
  )
}

/** Daily: expired admin sessions and audit lines older than a year go. */
export async function sweepAdmin(ctx: Pick<Ctx, 'db' | 'now'>): Promise<void> {
  await ctx.db.query('DELETE FROM admin_sessions WHERE expires_at < $1', [new Date(ctx.now())])
  await ctx.db.query('DELETE FROM admin_audit WHERE at < $1', [
    new Date(ctx.now() - ADMIN_AUDIT_DAYS * 86_400_000),
  ])
}
