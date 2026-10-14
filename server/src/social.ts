import { randomInt } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import {
  adventurerCodeOf,
  AVATAR_MAX,
  BANNER_MAX,
  BIO_MAX,
  isId,
  isRecord,
  isSafeImageDataUrl,
  type AdventurerProfile,
  type AdventurerSummary,
  type FriendsList,
  type Relation,
} from '../../shared/sync.ts'
import { checkUsername } from '../../shared/passwords.ts'
import { ApiError, type Ctx } from './app.ts'
import { requireUser } from './auth.ts'
import type { Queryable } from './db.ts'

/**
 * Profiles and adventurers (D-267): every account has a public profile
 * (name, motto, picture, banner) seen by signed-in accounts, and an
 * adventurer code to be found by. Two accounts become adventurers (friends)
 * when one asks and the other accepts; either can end it.
 */

// No 0/O, 1/I: the code is read aloud and typed.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 8

function newAdventurerCode(): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
  return code
}

/** The account's code, made the first time it is needed. */
async function codeOf(q: Queryable, userId: string): Promise<string> {
  for (;;) {
    const [row] = await q.query<{ friend_code: string | null }>(
      'SELECT friend_code FROM users WHERE id = $1',
      [userId],
    )
    if (!row) throw new ApiError(404, 'notFound')
    if (row.friend_code) return row.friend_code
    const code = newAdventurerCode()
    const [taken] = await q.query('SELECT 1 FROM users WHERE friend_code = $1', [code])
    if (!taken)
      await q.query('UPDATE users SET friend_code = $2 WHERE id = $1 AND friend_code IS NULL', [
        userId,
        code,
      ])
  }
}

interface SummaryRow {
  id: string
  display_name: string
  bio: string
  has_avatar: boolean
  profile_rev: number
}

/** Columns of a summary, from the `users` table aliased `u`. */
const SUMMARY = 'u.id, u.display_name, u.bio, u.avatar IS NOT NULL AS has_avatar, u.profile_rev'

const picture = (id: string, kind: 'avatar' | 'banner', rev: number) =>
  `/api/users/${id}/${kind}?v=${rev}`

const summary = (row: SummaryRow): AdventurerSummary => ({
  id: row.id,
  displayName: row.display_name,
  avatar: row.has_avatar ? picture(row.id, 'avatar', row.profile_rev) : null,
  bio: row.bio,
})

const time = (v: unknown) => new Date(v as string).getTime()

/** Where `self` stands with `other`. */
async function relationOf(q: Queryable, self: string, other: string): Promise<Relation> {
  if (self === other) return 'self'
  const rows = await q.query<{ requester: string; accepted_at: unknown }>(
    `SELECT requester, accepted_at FROM friendships
     WHERE (requester = $1 AND addressee = $2) OR (requester = $2 AND addressee = $1)`,
    [self, other],
  )
  if (rows.some((r) => r.accepted_at)) return 'friend'
  if (rows.some((r) => r.requester === self)) return 'sent'
  return rows.length ? 'received' : 'none'
}

function imageField(body: Record<string, unknown>, key: string, max: number) {
  const value = body[key]
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string' || value.length > max || !isSafeImageDataUrl(value))
    throw new ApiError(400, 'invalid')
  return value
}

export function registerSocial(app: FastifyInstance, ctx: Ctx): void {
  const authed = { preHandler: requireUser(ctx) }
  type P = { Params: { id: string; kind: string; code: string } }
  const askLimit = { config: { rateLimit: { max: 60, timeWindow: '1 hour' } } }

  async function profile(viewer: string, id: string): Promise<AdventurerProfile> {
    const [row] = await ctx.db.query<
      SummaryRow & { has_banner: boolean; created_at: unknown; friends: string }
    >(
      `SELECT ${SUMMARY}, u.banner IS NOT NULL AS has_banner, u.created_at,
         (SELECT count(*) FROM friendships f
          WHERE (f.requester = u.id OR f.addressee = u.id) AND f.accepted_at IS NOT NULL) AS friends
       FROM users u WHERE u.id = $1`,
      [id],
    )
    if (!row) throw new ApiError(404, 'notFound')
    const together = await ctx.db.query<{ name: string }>(
      `SELECT c.name FROM campaigns c
       JOIN members a ON a.campaign_id = c.id AND a.user_id = $1
       JOIN members b ON b.campaign_id = c.id AND b.user_id = $2
       WHERE $1 <> $2 ORDER BY c.name LIMIT 20`,
      [viewer, id],
    )
    return {
      ...summary(row),
      banner: row.has_banner ? picture(row.id, 'banner', row.profile_rev) : null,
      since: time(row.created_at),
      relation: await relationOf(ctx.db, viewer, id),
      friendCount: Number(row.friends),
      together: together.map((c) => c.name),
      code: viewer === id ? await codeOf(ctx.db, id) : null,
    }
  }

  /** Own profile, with the adventurer code. */
  app.get('/api/profile', authed, async (request) => ({
    profile: await profile(request.user!.id, request.user!.id),
  }))

  /** Name, motto, picture, banner: each field is optional; null removes a picture. */
  app.patch('/api/profile', { ...authed, bodyLimit: 4 * 1024 * 1024 }, async (request) => {
    const body = request.body
    if (!isRecord(body)) throw new ApiError(400, 'invalid')
    const self = request.user!.id
    const sets: string[] = []
    const values: unknown[] = [self]
    const set = (column: string, value: unknown) => {
      values.push(value)
      sets.push(`${column} = $${values.length}`)
    }
    if (body.displayName !== undefined) {
      if (typeof body.displayName !== 'string') throw new ApiError(400, 'invalid')
      const name = body.displayName.trim().replace(/\s+/g, ' ')
      if (checkUsername(name)) throw new ApiError(400, 'invalid')
      set('display_name', name)
    }
    if (body.bio !== undefined) {
      if (typeof body.bio !== 'string' || body.bio.length > BIO_MAX)
        throw new ApiError(400, 'invalid')
      set('bio', body.bio.trim())
    }
    const avatar = imageField(body, 'avatar', AVATAR_MAX)
    const banner = imageField(body, 'banner', BANNER_MAX)
    if (avatar !== undefined) set('avatar', avatar)
    if (banner !== undefined) set('banner', banner)
    if (avatar !== undefined || banner !== undefined) sets.push('profile_rev = profile_rev + 1')
    if (sets.length) await ctx.db.query(`UPDATE users SET ${sets.join(', ')} WHERE id = $1`, values)
    // Friends see the new face in their lists.
    ctx.hub.notifyFriends([self, ...(await friendIds(self))])
    return { profile: await profile(self, self) }
  })

  /** Pictures are served as files, so lists stay small and the browser caches them. */
  app.get<P>('/api/users/:id/:kind', authed, async (request, reply) => {
    const { id, kind } = request.params
    if (!isId(id) || (kind !== 'avatar' && kind !== 'banner')) throw new ApiError(404, 'notFound')
    const [row] = await ctx.db.query<{ image: string | null }>(
      `SELECT ${kind === 'avatar' ? 'avatar' : 'banner'} AS image FROM users WHERE id = $1`,
      [id],
    )
    const match = row?.image?.match(/^data:(image\/[a-z]+);base64,(.*)$/)
    if (!match) throw new ApiError(404, 'notFound')
    return reply
      .header('content-type', match[1])
      .header('cache-control', 'private, max-age=31536000, immutable')
      .header('x-content-type-options', 'nosniff')
      .send(Buffer.from(match[2]!, 'base64'))
  })

  /** Someone's profile, as the viewer sees it. */
  app.get<P>('/api/adventurers/:id', authed, async (request) => {
    if (!isId(request.params.id)) throw new ApiError(400, 'invalid')
    return { profile: await profile(request.user!.id, request.params.id) }
  })

  /** An adventurer code (or the link that carries it) → that profile. */
  app.get<P>('/api/adventurers/code/:code', authed, async (request) => {
    const code = adventurerCodeOf(request.params.code)
    const [row] = await ctx.db.query<{ id: string }>(
      'SELECT id FROM users WHERE friend_code = $1',
      [code],
    )
    if (!row) throw new ApiError(404, 'notFound')
    return { profile: await profile(request.user!.id, row.id) }
  })

  /** Search by name, or by exact adventurer code. */
  app.get<{ Querystring: { q?: string } }>('/api/adventurers', authed, async (request) => {
    const q = (request.query.q ?? '').trim()
    if (q.length < 2 || q.length > 100) return { results: [] }
    const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
    const rows = await ctx.db.query<SummaryRow>(
      `SELECT ${SUMMARY} FROM users u
       WHERE u.id <> $1 AND (u.display_name ILIKE $2 OR u.friend_code = $3)
       ORDER BY u.friend_code = $3 DESC, u.display_name LIMIT 20`,
      [request.user!.id, pattern, adventurerCodeOf(q)],
    )
    const results = []
    for (const r of rows)
      results.push({ ...summary(r), relation: await relationOf(ctx.db, request.user!.id, r.id) })
    return { results }
  })

  async function friendIds(userId: string): Promise<string[]> {
    const rows = await ctx.db.query<{ other: string }>(
      `SELECT CASE WHEN requester = $1 THEN addressee ELSE requester END AS other
       FROM friendships WHERE (requester = $1 OR addressee = $1) AND accepted_at IS NOT NULL`,
      [userId],
    )
    return rows.map((r) => r.other)
  }

  /** Adventurers, requests both ways, and people met at a table. */
  app.get('/api/friends', authed, async (request): Promise<FriendsList> => {
    const self = request.user!.id
    const rows = await ctx.db.query<
      SummaryRow & { requester: string; created_at: unknown; accepted_at: unknown }
    >(
      `SELECT ${SUMMARY}, f.requester, f.created_at, f.accepted_at FROM friendships f
       JOIN users u ON u.id = CASE WHEN f.requester = $1 THEN f.addressee ELSE f.requester END
       WHERE f.requester = $1 OR f.addressee = $1
       ORDER BY u.display_name`,
      [self],
    )
    const suggestions = await ctx.db.query<SummaryRow & { campaign: string }>(
      `SELECT DISTINCT ON (u.id) ${SUMMARY}, c.name AS campaign
       FROM members me JOIN members them ON them.campaign_id = me.campaign_id
       JOIN users u ON u.id = them.user_id JOIN campaigns c ON c.id = me.campaign_id
       WHERE me.user_id = $1 AND them.user_id <> $1
         AND NOT EXISTS (SELECT 1 FROM friendships f
           WHERE (f.requester = $1 AND f.addressee = u.id) OR (f.requester = u.id AND f.addressee = $1))
       ORDER BY u.id, c.name LIMIT 20`,
      [self],
    )
    return {
      friends: rows
        .filter((r) => r.accepted_at)
        .map((r) => ({
          ...summary(r),
          since: time(r.accepted_at),
          online: ctx.hub.isOnline(r.id),
        })),
      incoming: rows
        .filter((r) => !r.accepted_at && r.requester !== self)
        .map((r) => ({ ...summary(r), at: time(r.created_at) })),
      outgoing: rows
        .filter((r) => !r.accepted_at && r.requester === self)
        .map((r) => ({ ...summary(r), at: time(r.created_at) })),
      suggestions: suggestions
        .map((r) => ({ ...summary(r), campaign: r.campaign }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    }
  })

  /** Asks someone to become adventurers, or accepts when they asked first. */
  async function befriend(self: string, other: string): Promise<Relation> {
    if (self === other) throw new ApiError(400, 'invalid')
    const [exists] = await ctx.db.query('SELECT 1 FROM users WHERE id = $1', [other])
    if (!exists) throw new ApiError(404, 'notFound')
    const relation = await relationOf(ctx.db, self, other)
    if (relation === 'received')
      await ctx.db.query(
        'UPDATE friendships SET accepted_at = $3 WHERE requester = $2 AND addressee = $1',
        [self, other, new Date(ctx.now())],
      )
    else if (relation === 'none')
      await ctx.db.query(
        'INSERT INTO friendships (requester, addressee) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [self, other],
      )
    ctx.hub.notifyFriends([self, other])
    return relationOf(ctx.db, self, other)
  }

  app.post<P>('/api/friends/:id', { ...authed, ...askLimit }, async (request) => {
    if (!isId(request.params.id)) throw new ApiError(400, 'invalid')
    return { relation: await befriend(request.user!.id, request.params.id) }
  })

  app.post<P>('/api/friends/code/:code', { ...authed, ...askLimit }, async (request) => {
    const [row] = await ctx.db.query<{ id: string }>(
      'SELECT id FROM users WHERE friend_code = $1',
      [adventurerCodeOf(request.params.code)],
    )
    if (!row) throw new ApiError(404, 'notFound')
    return { userId: row.id, relation: await befriend(request.user!.id, row.id) }
  })

  /** Declines a request, withdraws one, or parts ways. */
  app.delete<P>('/api/friends/:id', authed, async (request) => {
    const other = request.params.id
    if (!isId(other)) throw new ApiError(400, 'invalid')
    const self = request.user!.id
    await ctx.db.query(
      `DELETE FROM friendships
       WHERE (requester = $1 AND addressee = $2) OR (requester = $2 AND addressee = $1)`,
      [self, other],
    )
    ctx.hub.notifyFriends([self, other])
    return { relation: 'none' satisfies Relation }
  })
}
