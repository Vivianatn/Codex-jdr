import type { FastifyInstance } from 'fastify'
import {
  ACTIVITY_LIMIT,
  isId,
  isRecord,
  isSafeImageDataUrl,
  isValidActivity,
  liveOf,
  OPERATOR_TABLES,
  parseChanges,
  type LiveInfo,
  type MemberRole,
  type SyncTable,
  type TableChanges,
} from '../../shared/sync.ts'
import { ApiError, BODY_LIMIT, type Ctx } from './app.ts'
import { requireUser, type SessionUser } from './auth.ts'
import { isManager, roleOf } from './campaigns.ts'
import type { Queryable } from './db.ts'

/**
 * Campaign records (D-262). The owner and co-GMs each keep a full copy on their
 * device and exchange changes through the server: a device pushes what it
 * wrote, then pulls what changed since its last revision. Every record carries
 * the revision of its last write; deletions stay as empty records so that
 * every device learns about them. Last write wins, as with D-245.
 *
 * Players never read or write records: they play through the operator's device
 * (relay in hub.ts), which sends each of them only what they may see.
 */

/** Records per pull page, and bytes (pictures are big). */
const PAGE_RECORDS = 1000
const PAGE_BYTES = 16 * 1024 * 1024

/** Additional data binding a sealed record to its place (also read by the account export, D-271). */
export const aad = (table: string, id: string, campaignId: string) => `${table}|${id}|${campaignId}`

/** Pictures from a device must be raster images (D-243). */
function sanitize(table: SyncTable, record: Record<string, unknown>): Record<string, unknown> {
  const image = (v: unknown) => (isSafeImageDataUrl(v) ? v : null)
  if (table === 'entities' || table === 'bestiary') {
    const identity = isRecord(record.identity) ? record.identity : {}
    const inventory = Array.isArray(record.inventory) ? record.inventory : []
    return {
      ...record,
      identity: { ...identity, portrait: image(identity.portrait), body: image(identity.body) },
      inventory: inventory.map((i) => (isRecord(i) ? { ...i, image: image(i.image) } : i)),
    }
  }
  if (table === 'itemLibrary') return { ...record, image: image(record.image) }
  return record
}

const sameLive = (a: LiveInfo | null, b: LiveInfo | null) =>
  a?.operatorId === b?.operatorId &&
  a?.mode === b?.mode &&
  a?.startedAt === b?.startedAt &&
  a?.title === b?.title &&
  a?.listed === b?.listed

export interface Refused {
  table: SyncTable
  id: string
  reason: 'forbidden' | 'notOperator' | 'invalid'
}

export function registerRecords(app: FastifyInstance, ctx: Ctx): void {
  const authed = { preHandler: requireUser(ctx) }
  type P = { Params: { id: string }; Querystring: { since?: string } }

  async function editor(campaignId: unknown, user: SessionUser): Promise<string> {
    if (!isId(campaignId)) throw new ApiError(400, 'invalid')
    const role = await roleOf(ctx.db, campaignId, user.id)
    if (!role) throw new ApiError(404, 'notFound')
    if (!isManager(role)) throw new ApiError(403, 'forbidden')
    return campaignId
  }

  /** A record of this campaign; undefined if absent or deleted; null if it belongs elsewhere. */
  async function read(q: Queryable, table: string, id: string, campaignId: string) {
    const [row] = await q.query<{ data: Uint8Array | null; campaign_id: string }>(
      'SELECT data, campaign_id FROM records WHERE tbl = $1 AND id = $2',
      [table, id],
    )
    if (!row) return undefined
    if (row.campaign_id !== campaignId) return null
    return row.data
      ? (ctx.cipher.open(row.data, aad(table, id, campaignId)) as Record<string, unknown>)
      : undefined
  }

  /** The server's version of refused records: a record, or a deletion when it has none. */
  async function truth(campaignId: string, refused: Refused[]): Promise<TableChanges[]> {
    const byTable = new Map<SyncTable, TableChanges>()
    for (const { table, id } of refused) {
      const change = byTable.get(table) ?? { table, put: [], del: [] }
      byTable.set(table, change)
      const record = await read(ctx.db, table, id, campaignId)
      if (record) change.put.push(record)
      else if (record === undefined) change.del.push(id)
    }
    return [...byTable.values()]
  }

  /** Changes since `since`, page by page. */
  app.get<P>('/api/campaigns/:id/changes', authed, async (request) => {
    const campaignId = await editor(request.params.id, request.user!)
    const since = Number(request.query.since ?? 0)
    if (!Number.isSafeInteger(since) || since < 0) throw new ApiError(400, 'invalid')
    const device = String(request.headers['x-codex-device'] ?? '')
    const rows = await ctx.db.query<{
      tbl: SyncTable
      id: string
      data: Uint8Array | null
      rev: string | number
      updated_device: string | null
    }>(
      `SELECT tbl, id, data, rev, updated_device FROM records
       WHERE campaign_id = $1 AND rev > $2 ORDER BY rev LIMIT $3`,
      [campaignId, since, PAGE_RECORDS],
    )
    const byTable = new Map<SyncTable, TableChanges>()
    let rev = since
    let bytes = 0
    let more = rows.length === PAGE_RECORDS
    for (const row of rows) {
      if (bytes > PAGE_BYTES) {
        more = true
        break
      }
      rev = Number(row.rev)
      // What this device wrote itself, it already has.
      if (device && row.updated_device === device) continue
      const change = byTable.get(row.tbl) ?? { table: row.tbl, put: [], del: [] }
      byTable.set(row.tbl, change)
      if (row.data) {
        bytes += row.data.length
        change.put.push(
          ctx.cipher.open(row.data, aad(row.tbl, row.id, campaignId)) as Record<string, unknown>,
        )
      } else change.del.push(row.id)
    }
    return { changes: [...byTable.values()], rev, more }
  })

  /**
   * Writes a device's changes. Each record is checked on its own: the refused
   * ones are listed with the server's version (`current`), the others stored.
   */
  app.post<P>(
    '/api/campaigns/:id/changes',
    { ...authed, bodyLimit: BODY_LIMIT },
    async (request) => {
      const user = request.user!
      const campaignId = await editor(request.params.id, user)
      const changes = parseChanges(isRecord(request.body) ? request.body.changes : null)
      if (!changes) throw new ApiError(400, 'invalid')
      const device = String(request.headers['x-codex-device'] ?? '').slice(0, 100) || null
      let liveChanged = false
      const refused: Refused[] = []

      const result = await ctx.db.tx(async (q) => {
        // One writer at a time per campaign: revisions are then committed in order.
        const [campaign] = await q.query<{ live: LiveInfo | null }>(
          'SELECT live FROM campaigns WHERE id = $1 FOR UPDATE',
          [campaignId],
        )
        if (!campaign) throw new ApiError(404, 'notFound')
        const live = campaign.live
        const operating = live?.operatorId === user.id
        const players = await playerNames(q, campaignId)
        const corrected: TableChanges[] = []
        let rev = 0

        const owner = async (table: SyncTable, id: string) =>
          (
            await q.query<{ campaign_id: string }>(
              'SELECT campaign_id FROM records WHERE tbl = $1 AND id = $2',
              [table, id],
            )
          )[0]?.campaign_id

        const write = async (
          table: SyncTable,
          id: string,
          data: Record<string, unknown> | null,
        ) => {
          const [row] = await q.query<{ rev: string }>(
            `INSERT INTO records (tbl, id, campaign_id, data, rev, updated_by, updated_device, updated_at)
           VALUES ($1, $2, $3, $4, nextval('record_rev'), $5, $6, now())
           ON CONFLICT (tbl, id) DO UPDATE SET data = EXCLUDED.data, rev = EXCLUDED.rev,
             updated_by = EXCLUDED.updated_by, updated_device = EXCLUDED.updated_device,
             updated_at = EXCLUDED.updated_at
           WHERE records.campaign_id = EXCLUDED.campaign_id
           RETURNING rev`,
            [
              table,
              id,
              campaignId,
              data ? ctx.cipher.seal(data, aad(table, id, campaignId)) : null,
              user.id,
              device,
            ],
          )
          if (row) rev = Math.max(rev, Number(row.rev))
        }

        /** What to store for one record, or why it is refused. */
        const check = async (
          table: SyncTable,
          raw: Record<string, unknown>,
        ): Promise<Record<string, unknown> | Refused['reason']> => {
          const id = String(raw.id)
          if (live && !operating && OPERATOR_TABLES.includes(table)) return 'notOperator'
          let record = sanitize(table, raw)
          if (table === 'campaigns') {
            if (id !== campaignId) return 'forbidden'
            const next = liveOf(record)
            if (live && !operating) {
              // A co-GM's copy of the game may be late: the operator's stays (D-244).
              const stored = await read(q, 'campaigns', id, campaignId)
              if (stored?.play !== undefined) {
                record = { ...record, play: stored.play }
                corrected.push({ table, put: [record], del: [] })
              }
            } else if (!sameLive(live, next)) {
              // Starting a game makes oneself the operator; only the operator ends it or hands it over.
              if (!live && next && next.operatorId !== user.id) return 'notOperator'
              liveChanged = true
            }
            const name =
              typeof record.name === 'string' && record.name.trim()
                ? record.name.trim().slice(0, 200)
                : null
            await q.query(
              'UPDATE campaigns SET live = $2, name = COALESCE($3, name) WHERE id = $1',
              [campaignId, live && !operating ? live : next, name],
            )
            return record
          }
          if (record.campaignId !== campaignId) return 'forbidden'
          const where = await owner(table, id)
          if (where && where !== campaignId) return 'forbidden'
          if (table === 'assets' && !isSafeImageDataUrl(record.data)) return 'invalid'
          if (table === 'activity') {
            const author = isRecord(record.author) ? record.author : {}
            // Lines are signed by their editor, or by the operator for a player's intent (D-247).
            // The name shown is always the account's current one.
            const signer =
              author.id === user.id
                ? { id: user.id, name: user.displayName }
                : operating && typeof author.id === 'string' && players.has(author.id)
                  ? { id: author.id, name: players.get(author.id)! }
                  : null
            if (!signer) return 'forbidden'
            record = { ...record, author: signer }
            if (!isValidActivity(record, campaignId, signer)) return 'invalid'
            const existing = where ? await read(q, table, id, campaignId) : undefined
            if (existing && (!isRecord(existing.author) || existing.author.id !== signer.id))
              return 'forbidden'
          }
          return record
        }

        for (const change of changes) {
          const { table } = change
          for (const raw of change.put) {
            const outcome = await check(table, raw)
            if (typeof outcome === 'string')
              refused.push({ table, id: String(raw.id), reason: outcome })
            else await write(table, String(raw.id), outcome)
          }
          // Nobody erases the activity log: the server trims it itself.
          if (table === 'activity') continue
          for (const id of change.del) {
            const where = await owner(table, id)
            const reason =
              table === 'campaigns' || (where && where !== campaignId)
                ? 'forbidden'
                : live && !operating && OPERATOR_TABLES.includes(table)
                  ? 'notOperator'
                  : null
            if (reason) refused.push({ table, id, reason })
            else if (where) await write(table, id, null)
          }
        }

        if (changes.some((c) => c.table === 'activity' && c.put.length)) {
          const trimmed = await q.query<{ rev: string }>(
            `UPDATE records SET data = NULL, rev = nextval('record_rev'), updated_device = NULL
           WHERE tbl = 'activity' AND campaign_id = $1 AND data IS NOT NULL AND id NOT IN (
             SELECT id FROM records WHERE tbl = 'activity' AND campaign_id = $1 AND data IS NOT NULL
             ORDER BY rev DESC LIMIT $2)
           RETURNING rev`,
            [campaignId, ACTIVITY_LIMIT],
          )
          for (const row of trimmed) rev = Math.max(rev, Number(row.rev))
        }
        return { rev, corrected }
      })

      if (result.rev) ctx.hub.changed(campaignId, result.rev)
      if (liveChanged) await ctx.hub.liveChanged(campaignId)
      // What was refused comes back as the server has it, to restore the device's copy.
      return { ...result, refused, current: await truth(campaignId, refused) }
    },
  )
}

/** Players of a campaign and their names (the operator signs their intents). */
async function playerNames(q: Queryable, campaignId: string): Promise<Map<string, string>> {
  const rows = await q.query<{ user_id: string; display_name: string; role: MemberRole }>(
    `SELECT m.user_id, u.display_name, m.role FROM members m JOIN users u ON u.id = m.user_id
     WHERE m.campaign_id = $1 AND m.role = 'player'`,
    [campaignId],
  )
  return new Map(rows.map((r) => [r.user_id, r.display_name]))
}
