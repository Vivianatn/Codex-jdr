import type { FastifyInstance } from 'fastify'
import {
  isAgeDeclaration,
  isReportCategory,
  REPORT_EXPLANATION_MAX,
  REPORT_EXPLANATION_MIN,
  TERMS_VERSION,
  type TermsStatus,
} from '../../shared/legal.ts'
import { isId, isRecord } from '../../shared/sync.ts'
import { ApiError, type Ctx } from './app.ts'
import { requireUser } from './auth.ts'
import { aad } from './records.ts'

/**
 * Legal duties of the online service (D-271):
 * - terms (CGU) accepted and age declared, recorded with their version;
 * - « Télécharger mes données » (GDPR art. 15 and 20): everything the server
 *   keeps about the account, and the full content of the campaigns it owns;
 * - notice and action (DSA art. 16): anyone signed in can report a profile;
 *   the reporter gets an acknowledgement, the operator decides with
 *   `moderate.ts` (docs/DEPLOIEMENT.md) and the decision is explained (art. 17);
 * - no API answer is stored by browsers or proxies (personal data).
 */

/** Reports a single account may file per day, beyond the per-address rate limit. */
export const REPORTS_PER_DAY = 20
/** Closed reports are kept one year after the decision (evidence, then erased). */
export const REPORT_RETENTION_DAYS = 365

const time = (v: unknown) => (v ? new Date(v as string).getTime() : null)

export function registerCompliance(app: FastifyInstance, ctx: Ctx): void {
  const authed = { preHandler: requireUser(ctx) }

  // Personal data: never cached (pictures set their own private cache header).
  app.addHook('onSend', async (request, reply) => {
    if (!request.url.startsWith('/api/')) return
    if (!reply.hasHeader('cache-control')) reply.header('cache-control', 'no-store')
    reply.header('x-content-type-options', 'nosniff')
  })

  async function termsOf(userId: string): Promise<TermsStatus> {
    const [row] = await ctx.db.query<{
      terms_version: string | null
      terms_accepted_at: unknown
      age_declaration: string | null
    }>('SELECT terms_version, terms_accepted_at, age_declaration FROM users WHERE id = $1', [
      userId,
    ])
    return {
      current: TERMS_VERSION,
      accepted: row?.terms_version
        ? {
            version: row.terms_version,
            at: time(row.terms_accepted_at) ?? 0,
            age: isAgeDeclaration(row.age_declaration) ? row.age_declaration : null,
          }
        : null,
    }
  }

  app.get('/api/account/terms', authed, async (request) => termsOf(request.user!.id))

  /** Accepts the current terms and declares one's age (sign-up, or after the terms changed). */
  app.post('/api/account/terms', authed, async (request) => {
    const body = request.body
    if (!isRecord(body) || body.version !== TERMS_VERSION || !isAgeDeclaration(body.age))
      throw new ApiError(400, 'invalid')
    await ctx.db.query(
      `UPDATE users SET terms_version = $2, terms_accepted_at = $3, age_declaration = $4
       WHERE id = $1`,
      [request.user!.id, TERMS_VERSION, new Date(ctx.now()), body.age],
    )
    return termsOf(request.user!.id)
  })

  /** Right of access and portability: one JSON file. */
  app.get(
    '/api/account/export',
    { ...authed, config: { rateLimit: { max: 10, timeWindow: '1 hour' } } },
    async (request, reply) => {
      const data = await exportAccount(ctx, request.user!.id)
      const day = new Date(ctx.now()).toISOString().slice(0, 10)
      return reply
        .header('content-disposition', `attachment; filename="codex-mes-donnees-${day}.json"`)
        .send(data)
    },
  )

  /** Notice and action (DSA art. 16): a report about a profile. */
  app.post(
    '/api/reports',
    { ...authed, config: { rateLimit: { max: 10, timeWindow: '1 hour' } } },
    async (request) => {
      const body = request.body
      if (!isRecord(body) || body.targetType !== 'profile' || !isId(body.targetId))
        throw new ApiError(400, 'invalid')
      const { category, explanation } = body
      if (!isReportCategory(category) || typeof explanation !== 'string')
        throw new ApiError(400, 'invalid')
      const text = explanation.trim()
      if (text.length < REPORT_EXPLANATION_MIN || text.length > REPORT_EXPLANATION_MAX)
        throw new ApiError(400, 'invalid')
      // The reporter confirms the notice is accurate and complete, in good faith (art. 16(2)(d)).
      if (body.goodFaith !== true) throw new ApiError(400, 'invalid')
      // Child sexual abuse material may be reported without one's identity (art. 16(2)(c)).
      const anonymous = body.anonymous === true
      if (anonymous && category !== 'childAbuse') throw new ApiError(400, 'invalid')
      const self = request.user!
      if (body.targetId === self.id) throw new ApiError(400, 'invalid')

      const [target] = await ctx.db.query<{
        display_name: string
        bio: string
        avatar: string | null
        banner: string | null
        profile_rev: number
      }>('SELECT display_name, bio, avatar, banner, profile_rev FROM users WHERE id = $1', [
        body.targetId,
      ])
      if (!target) throw new ApiError(404, 'notFound')
      const [recent] = await ctx.db.query<{ count: string }>(
        'SELECT count(*) FROM reports WHERE reporter_id = $1 AND created_at > $2',
        [self.id, new Date(ctx.now() - 86_400_000)],
      )
      if (Number(recent?.count ?? 0) >= REPORTS_PER_DAY) throw new ApiError(429, 'throttled')

      const id = crypto.randomUUID()
      const receivedAt = ctx.now()
      // What was reported, as it was: the profile may change before the operator looks.
      const snapshot = {
        displayName: target.display_name,
        bio: target.bio,
        avatar: target.avatar,
        banner: target.banner,
        profileRev: target.profile_rev,
      }
      await ctx.db.query(
        `INSERT INTO reports (id, reporter_id, target_type, target_id, snapshot, category, explanation, created_at)
         VALUES ($1, $2, 'profile', $3, $4, $5, $6, $7)`,
        [
          id,
          anonymous ? null : self.id,
          body.targetId,
          JSON.stringify(snapshot),
          category,
          text,
          new Date(receivedAt),
        ],
      )
      const reference = referenceOf(id)
      // Acknowledgement of receipt (art. 16(4)), when the reporter gave their identity.
      if (ctx.mailer && !anonymous)
        await ctx.mailer
          .send(
            self.email,
            `Codex : signalement reçu (${reference})`,
            acknowledgement(self.displayName, target.display_name, reference),
          )
          .catch((error: unknown) => request.log.error(error))
      if (ctx.mailer && ctx.config.moderationEmail)
        await ctx.mailer
          .send(
            ctx.config.moderationEmail,
            `Codex : nouveau signalement ${reference}`,
            [
              `Signalement ${id}`,
              `Catégorie : ${category}`,
              `Profil visé : ${body.targetId}`,
              '',
              text,
              '',
              `Pour l’examiner : node dist/server/src/moderate.js show ${id}`,
            ].join('\n'),
          )
          .catch((error: unknown) => request.log.error(error))
      return { id, reference, receivedAt }
    },
  )
}

/** Short reference shown to the reporter (first 8 characters of the id). */
export const referenceOf = (id: string) => id.slice(0, 8).toUpperCase()

function acknowledgement(reporter: string, target: string, reference: string): string {
  return [
    `Bonjour ${reporter},`,
    '',
    `Nous avons bien reçu ton signalement du profil « ${target} » (référence ${reference}).`,
    'Une personne va l’examiner, avec diligence et objectivité. Tu recevras la décision à cette adresse.',
    '',
    'Ce message est envoyé automatiquement. Pour compléter ton signalement, écris à l’adresse de contact indiquée sur le site, en rappelant la référence.',
  ].join('\n')
}

/** Everything the server keeps about an account (GDPR art. 15 and 20). */
export async function exportAccount(ctx: Pick<Ctx, 'db' | 'cipher' | 'now'>, userId: string) {
  const [user] = await ctx.db.query<Record<string, unknown>>('SELECT * FROM users WHERE id = $1', [
    userId,
  ])
  if (!user) throw new ApiError(404, 'notFound')
  const friendships = await ctx.db.query<{
    other: string
    display_name: string
    requester: string
    created_at: unknown
    accepted_at: unknown
  }>(
    `SELECT u.id AS other, u.display_name, f.requester, f.created_at, f.accepted_at
     FROM friendships f
     JOIN users u ON u.id = CASE WHEN f.requester = $1 THEN f.addressee ELSE f.requester END
     WHERE f.requester = $1 OR f.addressee = $1 ORDER BY f.created_at`,
    [userId],
  )
  const memberships = await ctx.db.query<{
    campaign_id: string
    name: string
    role: string
    character_id: string | null
    joined_at: unknown
  }>(
    `SELECT m.campaign_id, c.name, m.role, m.character_id, m.joined_at
     FROM members m JOIN campaigns c ON c.id = m.campaign_id
     WHERE m.user_id = $1 ORDER BY m.joined_at`,
    [userId],
  )
  const requests = await ctx.db.query<{
    campaign_id: string
    name: string
    message: string
    created_at: unknown
  }>(
    `SELECT r.campaign_id, c.name, r.message, r.created_at
     FROM join_requests r JOIN campaigns c ON c.id = r.campaign_id
     WHERE r.user_id = $1 ORDER BY r.created_at`,
    [userId],
  )
  const reports = await ctx.db.query<{
    id: string
    target_id: string
    category: string
    explanation: string
    status: string
    decision: string | null
    created_at: unknown
    decided_at: unknown
  }>(
    `SELECT id, target_id, category, explanation, status, decision, created_at, decided_at
     FROM reports WHERE reporter_id = $1 ORDER BY created_at`,
    [userId],
  )
  const sessions = await ctx.db.query<{ created_at: unknown; expires_at: unknown }>(
    'SELECT created_at, expires_at FROM sessions WHERE user_id = $1 ORDER BY created_at',
    [userId],
  )
  const owned = await ctx.db.query<{
    id: string
    name: string
    listed: boolean
    invite_code: string | null
    created_at: unknown
  }>(
    'SELECT id, name, listed, invite_code, created_at FROM campaigns WHERE owner_id = $1 ORDER BY created_at',
    [userId],
  )
  const campaigns = []
  for (const campaign of owned) {
    const rows = await ctx.db.query<{ tbl: string; id: string; data: Uint8Array }>(
      'SELECT tbl, id, data FROM records WHERE campaign_id = $1 AND data IS NOT NULL ORDER BY tbl, id',
      [campaign.id],
    )
    const records: Record<string, unknown[]> = {}
    for (const row of rows)
      (records[row.tbl] ??= []).push(ctx.cipher.open(row.data, aad(row.tbl, row.id, campaign.id)))
    campaigns.push({
      id: campaign.id,
      name: campaign.name,
      createdAt: time(campaign.created_at),
      listedInSearch: campaign.listed,
      inviteCode: campaign.invite_code,
      records,
    })
  }
  return {
    format: 'codex-account-export',
    version: 1,
    exportedAt: new Date(ctx.now()).toISOString(),
    account: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      createdAt: time(user.created_at),
      lastLoginAt: time(user.last_login_at),
      terms: user.terms_version
        ? {
            version: user.terms_version,
            acceptedAt: time(user.terms_accepted_at),
            age: user.age_declaration,
          }
        : null,
      profileHidden: Boolean(user.profile_hidden_at),
      suspended: Boolean(user.suspended_at),
    },
    profile: {
      bio: user.bio,
      adventurerCode: user.friend_code,
      avatar: user.avatar,
      banner: user.banner,
    },
    adventurers: friendships.map((f) => ({
      userId: f.other,
      displayName: f.display_name,
      status: f.accepted_at ? 'friend' : f.requester === userId ? 'sent' : 'received',
      requestedAt: time(f.created_at),
      acceptedAt: time(f.accepted_at),
    })),
    memberships: memberships.map((m) => ({
      campaignId: m.campaign_id,
      campaignName: m.name,
      role: m.role,
      characterId: m.character_id,
      joinedAt: time(m.joined_at),
    })),
    joinRequests: requests.map((r) => ({
      campaignId: r.campaign_id,
      campaignName: r.name,
      message: r.message,
      createdAt: time(r.created_at),
    })),
    reportsFiled: reports.map((r) => ({
      id: r.id,
      profileId: r.target_id,
      category: r.category,
      explanation: r.explanation,
      status: r.status,
      decision: r.decision,
      createdAt: time(r.created_at),
      decidedAt: time(r.decided_at),
    })),
    sessions: sessions.map((s) => ({
      openedAt: time(s.created_at),
      expiresAt: time(s.expires_at),
    })),
    campaigns,
  }
}

/** Closed reports go one year after their decision (privacy notice). */
export async function sweepReports(ctx: Pick<Ctx, 'db' | 'now'>): Promise<number> {
  const limit = new Date(ctx.now() - REPORT_RETENTION_DAYS * 86_400_000)
  const gone = await ctx.db.query<{ id: string }>(
    "DELETE FROM reports WHERE status <> 'open' AND decided_at < $1 RETURNING id",
    [limit],
  )
  return gone.length
}
