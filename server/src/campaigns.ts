import type { FastifyInstance } from 'fastify'
import {
  isId,
  isRecord,
  type CampaignSummary,
  type InvitePreview,
  type JoinRequestInfo,
  type LiveInfo,
  type MemberInfo,
  type MemberRole,
  type OpenSession,
} from '../../shared/sync.ts'
import { ApiError, type Ctx } from './app.ts'
import { requireUser } from './auth.ts'
import type { Queryable } from './db.ts'
import { newInviteCode } from './secrets.ts'

/**
 * Campaigns on the server (D-262): who belongs to which campaign and how one
 * joins. A player asks to join (invitation link, or search when the GM lists
 * the campaign); a GM accepts, chooses the role and the character. Every GM
 * (owner or editor) has the same rights (D-274), except that only the owner
 * deletes the campaign or hands it over, and nobody demotes or removes the owner.
 */

export async function roleOf(
  q: Queryable,
  campaignId: string,
  userId: string,
): Promise<MemberRole | null> {
  const [row] = await q.query<{ role: MemberRole }>(
    'SELECT role FROM members WHERE campaign_id = $1 AND user_id = $2',
    [campaignId, userId],
  )
  return row?.role ?? null
}

export const isManager = (role: MemberRole | null): boolean => role === 'owner' || role === 'editor'

async function requireRole(
  ctx: Ctx,
  campaignId: string,
  userId: string,
  allowed: (role: MemberRole) => boolean,
): Promise<MemberRole> {
  const role = await roleOf(ctx.db, campaignId, userId)
  if (!role) throw new ApiError(404, 'notFound')
  if (!allowed(role)) throw new ApiError(403, 'forbidden')
  return role
}

function param(value: unknown): string {
  if (!isId(value)) throw new ApiError(400, 'invalid')
  return value
}

function text(body: unknown, key: string, max: number, fallback?: string): string {
  const value = isRecord(body) ? body[key] : undefined
  if (value === undefined && fallback !== undefined) return fallback
  if (typeof value !== 'string' || value.length > max) throw new ApiError(400, 'invalid')
  return value.trim()
}

const time = (v: unknown) => new Date(v as string).getTime()

export function registerCampaigns(app: FastifyInstance, ctx: Ctx): void {
  const authed = { preHandler: requireUser(ctx) }
  type P = { Params: { id: string; userId: string; requestId: string; code: string } }

  /** The campaigns this account belongs to. */
  app.get('/api/campaigns', authed, async (request): Promise<{ campaigns: CampaignSummary[] }> => {
    const rows = await ctx.db.query<{
      id: string
      name: string
      role: MemberRole
      character_id: string | null
      live: LiveInfo | null
      owner_name: string
      pending: string | number
    }>(
      `SELECT c.id, c.name, m.role, m.character_id, c.live, o.display_name AS owner_name,
         (SELECT count(*) FROM join_requests r WHERE r.campaign_id = c.id) AS pending
       FROM members m JOIN campaigns c ON c.id = m.campaign_id JOIN users o ON o.id = c.owner_id
       WHERE m.user_id = $1 ORDER BY c.name`,
      [request.user!.id],
    )
    return {
      campaigns: rows.map((r) => ({
        id: r.id,
        name: r.name,
        role: r.role,
        ownerName: r.owner_name,
        characterId: r.character_id,
        live: r.live,
        pendingRequests: isManager(r.role) ? Number(r.pending) : 0,
      })),
    }
  })

  /** Puts a campaign online (its records follow through the sync). Idempotent for its owner. */
  app.put<P>('/api/campaigns/:id', authed, async (request) => {
    const id = param(request.params.id)
    const name = text(request.body, 'name', 200) || 'Campagne'
    const user = request.user!
    await ctx.db.tx(async (q) => {
      const [existing] = await q.query<{ owner_id: string }>(
        'SELECT owner_id FROM campaigns WHERE id = $1',
        [id],
      )
      if (existing) {
        if (existing.owner_id !== user.id) throw new ApiError(409, 'conflict')
        return
      }
      await q.query('INSERT INTO campaigns (id, owner_id, name) VALUES ($1, $2, $3)', [
        id,
        user.id,
        name,
      ])
      await q.query("INSERT INTO members (campaign_id, user_id, role) VALUES ($1, $2, 'owner')", [
        id,
        user.id,
      ])
    })
    ctx.hub.notifyCampaigns([user.id])
    return { ok: true }
  })

  /** Deletes the campaign for everyone (owner only). */
  app.delete<P>('/api/campaigns/:id', authed, async (request) => {
    const id = param(request.params.id)
    await requireRole(ctx, id, request.user!.id, (r) => r === 'owner')
    const members = await ctx.hub.membersOf([id])
    ctx.hub.endCampaign(id)
    await ctx.db.query('DELETE FROM campaigns WHERE id = $1', [id])
    ctx.hub.notifyCampaigns(members)
    return { ok: true }
  })

  // ---- members ----------------------------------------------------------------

  app.get<P>('/api/campaigns/:id/members', authed, async (request) => {
    const id = param(request.params.id)
    await requireRole(ctx, id, request.user!.id, () => true)
    const rows = await ctx.db.query<{
      user_id: string
      display_name: string
      role: MemberRole
      character_id: string | null
    }>(
      `SELECT m.user_id, u.display_name, m.role, m.character_id
       FROM members m JOIN users u ON u.id = m.user_id
       WHERE m.campaign_id = $1 ORDER BY m.joined_at`,
      [id],
    )
    const members: MemberInfo[] = rows.map((r) => ({
      userId: r.user_id,
      displayName: r.display_name,
      role: r.role,
      characterId: r.character_id,
    }))
    return { members }
  })

  /** Role and character of a member. Any GM names or demotes GMs (D-274), never the owner. */
  app.patch<P>('/api/campaigns/:id/members/:userId', authed, async (request) => {
    const id = param(request.params.id)
    const target = param(request.params.userId)
    await requireRole(ctx, id, request.user!.id, isManager)
    const theirs = await roleOf(ctx.db, id, target)
    if (!theirs) throw new ApiError(404, 'notFound')
    if (theirs === 'owner') throw new ApiError(403, 'forbidden')
    const body = isRecord(request.body) ? request.body : {}
    const role = body.role === undefined ? theirs : body.role
    if (role !== 'player' && role !== 'editor') throw new ApiError(400, 'invalid')
    const characterId =
      body.characterId === undefined
        ? undefined
        : body.characterId === null
          ? null
          : param(body.characterId)
    await ctx.db.query(
      `UPDATE members SET role = $3${characterId === undefined ? '' : ', character_id = $4'}
       WHERE campaign_id = $1 AND user_id = $2`,
      characterId === undefined ? [id, target, role] : [id, target, role, characterId],
    )
    // A player who became co-GM, or changed character, enters the game again.
    ctx.hub.removeFromGame(id, target)
    // A demoted GM who was running the game stops serving it.
    if (role !== theirs) await ctx.hub.liveChanged(id)
    else ctx.hub.notifyCampaigns([target, request.user!.id])
    return { ok: true }
  })

  /** Removes a member (a GM: anyone; anyone: themselves), never the owner (D-274). */
  app.delete<P>('/api/campaigns/:id/members/:userId', authed, async (request) => {
    const id = param(request.params.id)
    const self = request.user!.id
    const target = request.params.userId === 'me' ? self : param(request.params.userId)
    const mine = await requireRole(ctx, id, self, () => true)
    const theirs = await roleOf(ctx.db, id, target)
    if (!theirs) throw new ApiError(404, 'notFound')
    const allowed = theirs !== 'owner' && (target === self || isManager(mine))
    if (!allowed) throw new ApiError(403, 'forbidden')
    const members = await ctx.hub.membersOf([id])
    await ctx.db.query('DELETE FROM members WHERE campaign_id = $1 AND user_id = $2', [id, target])
    ctx.hub.removeFromGame(id, target)
    ctx.hub.notifyCampaigns(members)
    if (theirs === 'editor') await ctx.hub.liveChanged(id)
    void ctx.hub.presence(id)
    return { ok: true }
  })

  /** The owner hands the campaign over to another GM and stays GM (D-274). */
  app.post<P>('/api/campaigns/:id/transfer', authed, async (request) => {
    const id = param(request.params.id)
    const self = request.user!.id
    const target = param(isRecord(request.body) ? request.body.userId : undefined)
    await ctx.db.tx(async (q) => {
      const [campaign] = await q.query<{ owner_id: string }>(
        'SELECT owner_id FROM campaigns WHERE id = $1 FOR UPDATE',
        [id],
      )
      const mine = campaign ? await roleOf(q, id, self) : null
      if (!campaign || !mine) throw new ApiError(404, 'notFound')
      if (mine !== 'owner' || campaign.owner_id !== self) throw new ApiError(403, 'forbidden')
      if (target === self || (await roleOf(q, id, target)) !== 'editor')
        throw new ApiError(400, 'invalid')
      await q.query(`UPDATE members SET role = 'editor' WHERE campaign_id = $1 AND user_id = $2`, [
        id,
        self,
      ])
      await q.query(`UPDATE members SET role = 'owner' WHERE campaign_id = $1 AND user_id = $2`, [
        id,
        target,
      ])
      await q.query('UPDATE campaigns SET owner_id = $2 WHERE id = $1', [id, target])
    })
    ctx.hub.notifyCampaigns(await ctx.hub.membersOf([id]))
    ctx.hub.sessionsChanged()
    return { ok: true }
  })

  // ---- sharing: invitation link, listing ----------------------------------------

  app.get<P>('/api/campaigns/:id/sharing', authed, async (request) => {
    const id = param(request.params.id)
    await requireRole(ctx, id, request.user!.id, isManager)
    const [row] = await ctx.db.query<{ invite_code: string | null; listed: boolean }>(
      'SELECT invite_code, listed FROM campaigns WHERE id = $1',
      [id],
    )
    return { inviteCode: row?.invite_code ?? null, listed: Boolean(row?.listed) }
  })

  /** New invitation code (the previous link stops working), or none. */
  app.post<P>('/api/campaigns/:id/invite', authed, async (request) => {
    const id = param(request.params.id)
    await requireRole(ctx, id, request.user!.id, isManager)
    const off = isRecord(request.body) && request.body.disable === true
    const code = off ? null : newInviteCode()
    await ctx.db.query('UPDATE campaigns SET invite_code = $2 WHERE id = $1', [id, code])
    return { inviteCode: code }
  })

  app.patch<P>('/api/campaigns/:id/sharing', authed, async (request) => {
    const id = param(request.params.id)
    await requireRole(ctx, id, request.user!.id, isManager)
    const listed = isRecord(request.body) && request.body.listed === true
    await ctx.db.query('UPDATE campaigns SET listed = $2 WHERE id = $1', [id, listed])
    return { listed }
  })

  async function preview(campaignId: string, userId: string): Promise<InvitePreview['status']> {
    if (await roleOf(ctx.db, campaignId, userId)) return 'member'
    const [asked] = await ctx.db.query(
      'SELECT 1 FROM join_requests WHERE campaign_id = $1 AND user_id = $2',
      [campaignId, userId],
    )
    return asked ? 'requested' : 'none'
  }

  async function campaignByCode(code: string) {
    if (!/^[A-Za-z0-9_-]{6,40}$/.test(code)) throw new ApiError(404, 'notFound')
    const [row] = await ctx.db.query<{ id: string; name: string; owner_name: string }>(
      `SELECT c.id, c.name, u.display_name AS owner_name FROM campaigns c
       JOIN users u ON u.id = c.owner_id WHERE c.invite_code = $1`,
      [code],
    )
    if (!row) throw new ApiError(404, 'notFound')
    return row
  }

  app.get<P>('/api/invites/:code', authed, async (request): Promise<InvitePreview> => {
    const row = await campaignByCode(request.params.code)
    return {
      campaignId: row.id,
      campaignName: row.name,
      ownerName: row.owner_name,
      status: await preview(row.id, request.user!.id),
    }
  })

  async function requestToJoin(campaignId: string, userId: string, message: string) {
    if ((await preview(campaignId, userId)) !== 'none') return
    await ctx.db.query(
      'INSERT INTO join_requests (id, campaign_id, user_id, message) VALUES ($1, $2, $3, $4)',
      [crypto.randomUUID(), campaignId, userId, message],
    )
    const managers = await ctx.db.query<{ user_id: string }>(
      "SELECT user_id FROM members WHERE campaign_id = $1 AND role IN ('owner', 'editor')",
      [campaignId],
    )
    ctx.hub.notifyCampaigns([userId, ...managers.map((m) => m.user_id)])
  }

  const joinLimit = { config: { rateLimit: { max: 30, timeWindow: '1 hour' } } }

  app.post<P>('/api/invites/:code/request', { ...authed, ...joinLimit }, async (request) => {
    const row = await campaignByCode(request.params.code)
    await requestToJoin(row.id, request.user!.id, text(request.body, 'message', 500, ''))
    return { campaignId: row.id }
  })

  /** Campaigns their GM chose to list, by name. */
  app.get<{ Querystring: { q?: string } }>('/api/search', authed, async (request) => {
    const q = (request.query.q ?? '').trim()
    if (q.length < 2 || q.length > 100) return { results: [] }
    const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
    const rows = await ctx.db.query<{ id: string; name: string; owner_name: string }>(
      `SELECT c.id, c.name, u.display_name AS owner_name FROM campaigns c
       JOIN users u ON u.id = c.owner_id
       WHERE c.listed AND c.name ILIKE $1 ORDER BY c.name LIMIT 20`,
      [pattern],
    )
    const results: InvitePreview[] = []
    for (const r of rows)
      results.push({
        campaignId: r.id,
        campaignName: r.name,
        ownerName: r.owner_name,
        status: await preview(r.id, request.user!.id),
      })
    return { results }
  })

  app.post<P>('/api/campaigns/:id/requests', { ...authed, ...joinLimit }, async (request) => {
    const id = param(request.params.id)
    const [row] = await ctx.db.query<{ listed: boolean }>(
      'SELECT listed FROM campaigns WHERE id = $1',
      [id],
    )
    if (!row?.listed) throw new ApiError(404, 'notFound')
    await requestToJoin(id, request.user!.id, text(request.body, 'message', 500, ''))
    return { campaignId: id }
  })

  // ---- catalogue of open sessions -------------------------------------------------

  /** A running online game its GM listed, whose device serves players right now. */
  async function openSession(campaignId: string) {
    const [row] = await ctx.db.query<{ live: LiveInfo | null }>(
      'SELECT live FROM campaigns WHERE id = $1',
      [campaignId],
    )
    const live = row?.live
    return live?.mode === 'online' && live.listed && ctx.hub.isServing(campaignId) ? live : null
  }

  /** Open sessions of other GMs: one click asks to join their campaign. */
  app.get('/api/sessions', authed, async (request): Promise<{ sessions: OpenSession[] }> => {
    const self = request.user!.id
    const rows = await ctx.db.query<{
      id: string
      name: string
      live: LiveInfo
      owner_id: string
      owner_name: string
      role: MemberRole | null
      requested: boolean
      friend: boolean
    }>(
      `SELECT c.id, c.name, c.live, c.owner_id, u.display_name AS owner_name, m.role,
         EXISTS (SELECT 1 FROM join_requests r WHERE r.campaign_id = c.id AND r.user_id = $1)
           AS requested,
         EXISTS (SELECT 1 FROM friendships f WHERE f.accepted_at IS NOT NULL
           AND ((f.requester = $1 AND f.addressee = c.owner_id)
             OR (f.requester = c.owner_id AND f.addressee = $1))) AS friend
       FROM campaigns c JOIN users u ON u.id = c.owner_id
       LEFT JOIN members m ON m.campaign_id = c.id AND m.user_id = $1
       WHERE c.live->>'mode' = 'online' AND c.live->>'listed' = 'true'`,
      [self],
    )
    const sessions = rows
      // A GM does not join their own table as a player.
      .filter((r) => !isManager(r.role) && ctx.hub.isServing(r.id))
      .map((r): OpenSession => ({
        campaignId: r.id,
        campaignName: r.name,
        ownerName: r.owner_name,
        title: r.live.title,
        operatorName: r.live.operatorName,
        startedAt: r.live.startedAt,
        ownerId: r.owner_id,
        byAdventurer: r.friend,
        status: r.role ? 'member' : r.requested ? 'requested' : 'none',
      }))
      // The tables of one's adventurers first (D-267), then the newest.
      .sort((a, b) => Number(b.byAdventurer) - Number(a.byAdventurer) || b.startedAt - a.startedAt)
      .slice(0, 50)
    return { sessions }
  })

  app.post<P>('/api/sessions/:id/request', { ...authed, ...joinLimit }, async (request) => {
    const id = param(request.params.id)
    if (!(await openSession(id))) throw new ApiError(404, 'notFound')
    await requestToJoin(id, request.user!.id, '')
    return { campaignId: id }
  })

  app.get<P>('/api/campaigns/:id/requests', authed, async (request) => {
    const id = param(request.params.id)
    await requireRole(ctx, id, request.user!.id, isManager)
    const rows = await ctx.db.query<{
      id: string
      user_id: string
      display_name: string
      message: string
      created_at: string
    }>(
      `SELECT r.id, r.user_id, u.display_name, r.message, r.created_at FROM join_requests r
       JOIN users u ON u.id = r.user_id WHERE r.campaign_id = $1 ORDER BY r.created_at`,
      [id],
    )
    const requests: JoinRequestInfo[] = rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      displayName: r.display_name,
      message: r.message,
      createdAt: time(r.created_at),
    }))
    return { requests }
  })

  /** My requests still waiting. */
  app.get('/api/requests', authed, async (request) => {
    const rows = await ctx.db.query<{
      id: string
      campaign_id: string
      name: string
      owner_name: string
      created_at: string
    }>(
      `SELECT r.id, r.campaign_id, c.name, u.display_name AS owner_name, r.created_at
       FROM join_requests r JOIN campaigns c ON c.id = r.campaign_id JOIN users u ON u.id = c.owner_id
       WHERE r.user_id = $1 ORDER BY r.created_at`,
      [request.user!.id],
    )
    return {
      requests: rows.map((r) => ({
        id: r.id,
        campaignId: r.campaign_id,
        campaignName: r.name,
        ownerName: r.owner_name,
        createdAt: time(r.created_at),
      })),
    }
  })

  /** Accepts a request: the GM chooses the role (player or GM) and the character. */
  app.post<P>('/api/campaigns/:id/requests/:requestId/accept', authed, async (request) => {
    const id = param(request.params.id)
    await requireRole(ctx, id, request.user!.id, isManager)
    const body = isRecord(request.body) ? request.body : {}
    const role = body.role ?? 'player'
    if (role !== 'player' && role !== 'editor') throw new ApiError(400, 'invalid')
    const characterId = body.characterId == null ? null : param(body.characterId)
    const userId = await ctx.db.tx(async (q) => {
      const [req] = await q.query<{ user_id: string }>(
        'DELETE FROM join_requests WHERE id = $1 AND campaign_id = $2 RETURNING user_id',
        [param(request.params.requestId), id],
      )
      if (!req) throw new ApiError(404, 'notFound')
      await q.query(
        `INSERT INTO members (campaign_id, user_id, role, character_id) VALUES ($1, $2, $3, $4)
         ON CONFLICT (campaign_id, user_id) DO NOTHING`,
        [id, req.user_id, role, characterId],
      )
      return req.user_id
    })
    ctx.hub.notifyCampaigns(await ctx.hub.membersOf([id]))
    void ctx.hub.presence(id)
    return { userId }
  })

  /** Declines (GM) or withdraws (the one who asked). */
  app.delete<P>('/api/campaigns/:id/requests/:requestId', authed, async (request) => {
    const id = param(request.params.id)
    const self = request.user!.id
    const [req] = await ctx.db.query<{ user_id: string }>(
      'SELECT user_id FROM join_requests WHERE id = $1 AND campaign_id = $2',
      [param(request.params.requestId), id],
    )
    if (!req) throw new ApiError(404, 'notFound')
    if (req.user_id !== self && !isManager(await roleOf(ctx.db, id, self)))
      throw new ApiError(403, 'forbidden')
    await ctx.db.query('DELETE FROM join_requests WHERE id = $1', [request.params.requestId])
    ctx.hub.notifyCampaigns([req.user_id, ...(await ctx.hub.membersOf([id]))])
    return { ok: true }
  })
}
