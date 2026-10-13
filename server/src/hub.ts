import type { FastifyInstance } from 'fastify'
import type { WebSocket } from 'ws'
import {
  parseClientFrame,
  type ClientFrame,
  type LiveInfo,
  type MemberRole,
  type PresenceUser,
  type ServerFrame,
} from '../../shared/sync.ts'
import type { Ctx } from './app.ts'
import { userFromCookie, type SessionUser } from './auth.ts'
import type { Db } from './db.ts'

/**
 * Real time (D-262), one WebSocket per open app:
 * - tells the editors of a campaign that records changed (they pull them);
 * - tells everyone when their campaigns, requests or running games change;
 * - who is connected (presence), for handing the table over;
 * - relays the live game between the players and the operator's device, which
 *   runs it (HostSession) and sends each player only what they may see.
 */

interface Conn {
  id: string
  ws: WebSocket
  user: SessionUser
  /** Campaigns whose players this device serves (operator). */
  serving: Set<string>
  /** Campaign this device entered as a player. */
  entered: string | null
  alive: boolean
  /** Frames allowed right now (a small budget refilled every second). */
  budget: number
}

const FRAMES_PER_SECOND = 200

export class Hub {
  private readonly conns = new Set<Conn>()
  /** campaignId → the operator's connection serving its players. */
  private readonly hosts = new Map<string, Conn>()
  /** campaignId → userId → player connection. */
  private readonly players = new Map<string, Map<string, Conn>>()
  private readonly db: Db

  constructor(db: Db) {
    this.db = db
  }

  // ---- connections ----------------------------------------------------------------

  async add(ws: WebSocket, user: SessionUser): Promise<Conn> {
    const conn: Conn = {
      id: crypto.randomUUID(),
      ws,
      user,
      serving: new Set(),
      entered: null,
      alive: true,
      budget: FRAMES_PER_SECOND,
    }
    const first = !this.byUser(user.id).length
    this.conns.add(conn)
    this.send(conn, { t: 'hello', userId: user.id })
    if (first) await this.presenceOfUser(user.id)
    return conn
  }

  async remove(conn: Conn): Promise<void> {
    if (!this.conns.delete(conn)) return
    for (const campaignId of conn.serving) this.dropHost(campaignId, conn)
    this.leave(conn)
    if (!this.byUser(conn.user.id).length) await this.presenceOfUser(conn.user.id)
  }

  /** Called every 30 s: connections that did not answer the last ping are closed. */
  heartbeat(): void {
    for (const conn of this.conns) {
      if (!conn.alive) {
        conn.ws.terminate()
        continue
      }
      conn.alive = false
      conn.ws.ping()
    }
  }

  refill(): void {
    for (const conn of this.conns) conn.budget = FRAMES_PER_SECOND
  }

  closeSession(tokenHash: string): void {
    for (const conn of this.conns) if (conn.user.tokenHash === tokenHash) conn.ws.close(4001)
  }

  closeUser(userId: string): void {
    for (const conn of this.byUser(userId)) conn.ws.close(4001)
  }

  closeAll(): void {
    for (const conn of this.conns) conn.ws.terminate()
    this.conns.clear()
  }

  private byUser(userId: string): Conn[] {
    return [...this.conns].filter((c) => c.user.id === userId)
  }

  private send(conn: Conn, frame: ServerFrame): void {
    if (conn.ws.readyState === conn.ws.OPEN) conn.ws.send(JSON.stringify(frame))
  }

  private sendUsers(userIds: Iterable<string>, frame: ServerFrame): void {
    const wanted = new Set(userIds)
    for (const conn of this.conns) if (wanted.has(conn.user.id)) this.send(conn, frame)
  }

  // ---- notifications --------------------------------------------------------------

  async membersOf(campaignIds: string[], roles?: MemberRole[]): Promise<string[]> {
    if (!campaignIds.length) return []
    const rows = await this.db.query<{ user_id: string; role: MemberRole }>(
      'SELECT user_id, role FROM members WHERE campaign_id = ANY($1)',
      [campaignIds],
    )
    return [...new Set(rows.filter((r) => !roles || roles.includes(r.role)).map((r) => r.user_id))]
  }

  notifyCampaigns(userIds: Iterable<string>): void {
    this.sendUsers(userIds, { t: 'campaigns' })
  }

  /** Records changed: the editors pull them. */
  changed(campaignId: string, rev: number): void {
    void this.membersOf([campaignId], ['owner', 'editor']).then((ids) =>
      this.sendUsers(ids, { t: 'changed', campaignId, rev }),
    )
  }

  async presence(campaignId: string): Promise<void> {
    const rows = await this.db.query<{ user_id: string; role: MemberRole }>(
      'SELECT user_id, role FROM members WHERE campaign_id = $1',
      [campaignId],
    )
    const users = new Map<string, PresenceUser>()
    for (const conn of this.conns) {
      const member = rows.find((r) => r.user_id === conn.user.id)
      if (member)
        users.set(conn.user.id, {
          id: conn.user.id,
          name: conn.user.displayName,
          role: member.role,
        })
    }
    this.sendUsers(
      rows.map((r) => r.user_id),
      { t: 'presence', campaignId, users: [...users.values()] },
    )
  }

  private async presenceOfUser(userId: string): Promise<void> {
    const rows = await this.db.query<{ campaign_id: string }>(
      'SELECT campaign_id FROM members WHERE user_id = $1',
      [userId],
    )
    for (const r of rows) await this.presence(r.campaign_id)
  }

  /** The running game changed (started, ended, handed over): the relay follows. */
  async liveChanged(campaignId: string): Promise<void> {
    const host = this.hosts.get(campaignId)
    if (host && !(await this.mayServe(campaignId, host.user.id))) this.dropHost(campaignId, host)
    this.notifyCampaigns(await this.membersOf([campaignId]))
  }

  /** The campaign is deleted: its game stops. */
  endCampaign(campaignId: string): void {
    const host = this.hosts.get(campaignId)
    if (host) this.dropHost(campaignId, host)
  }

  /** A player removed, or whose role or character changed, leaves the game. */
  removeFromGame(campaignId: string, userId: string): void {
    const conn = this.players.get(campaignId)?.get(userId)
    if (!conn) return
    this.send(conn, { t: 'hostGone' })
    this.leave(conn)
  }

  // ---- live-game relay ------------------------------------------------------------

  private async live(campaignId: string): Promise<LiveInfo | null> {
    const [row] = await this.db.query<{ live: LiveInfo | null }>(
      'SELECT live FROM campaigns WHERE id = $1',
      [campaignId],
    )
    return row?.live ?? null
  }

  private async mayServe(campaignId: string, userId: string): Promise<boolean> {
    const live = await this.live(campaignId)
    return live?.mode === 'online' && live.operatorId === userId
  }

  private dropHost(campaignId: string, host: Conn): void {
    host.serving.delete(campaignId)
    if (this.hosts.get(campaignId) !== host) return
    this.hosts.delete(campaignId)
    this.send(host, { t: 'serving', campaignId, ok: false })
    for (const player of this.players.get(campaignId)?.values() ?? []) {
      player.entered = null
      this.send(player, { t: 'hostGone' })
    }
    this.players.delete(campaignId)
  }

  private leave(conn: Conn): void {
    const campaignId = conn.entered
    if (!campaignId) return
    conn.entered = null
    const players = this.players.get(campaignId)
    if (players?.get(conn.user.id) !== conn) return
    players.delete(conn.user.id)
    const host = this.hosts.get(campaignId)
    if (host) this.send(host, { t: 'peerGone', campaignId, peerId: conn.user.id })
  }

  async handle(conn: Conn, raw: string): Promise<void> {
    if (--conn.budget < 0) return void conn.ws.close(4008)
    let frame: ClientFrame | null = null
    try {
      frame = parseClientFrame(JSON.parse(raw))
    } catch {
      frame = null
    }
    if (!frame) return
    switch (frame.t) {
      case 'ping':
        return this.send(conn, { t: 'pong' })
      case 'serve': {
        const { campaignId } = frame
        const ok = await this.mayServe(campaignId, conn.user.id)
        if (ok) {
          const previous = this.hosts.get(campaignId)
          if (previous && previous !== conn) this.dropHost(campaignId, previous)
          this.hosts.set(campaignId, conn)
          conn.serving.add(campaignId)
        }
        this.send(conn, { t: 'serving', campaignId, ok })
        if (ok) this.notifyCampaigns(await this.membersOf([campaignId], ['player']))
        return
      }
      case 'unserve':
        return this.dropHost(frame.campaignId, conn)
      case 'enter': {
        const { campaignId } = frame
        const [member] = await this.db.query<{ role: MemberRole; character_id: string | null }>(
          'SELECT role, character_id FROM members WHERE campaign_id = $1 AND user_id = $2',
          [campaignId, conn.user.id],
        )
        if (member?.role !== 'player')
          return this.send(conn, { t: 'enterFailed', campaignId, reason: 'forbidden' })
        const host = this.hosts.get(campaignId)
        if (!host) return this.send(conn, { t: 'enterFailed', campaignId, reason: 'notLive' })
        this.leave(conn)
        // The same player from another tab or device: the newest one plays.
        const players = this.players.get(campaignId) ?? new Map<string, Conn>()
        const older = players.get(conn.user.id)
        if (older && older !== conn) {
          this.send(older, { t: 'hostGone' })
          this.leave(older)
        }
        players.set(conn.user.id, conn)
        this.players.set(campaignId, players)
        conn.entered = campaignId
        this.send(host, {
          t: 'peer',
          campaignId,
          peerId: conn.user.id,
          name: conn.user.displayName,
          characterId: member.character_id,
        })
        return this.send(conn, { t: 'entered', campaignId })
      }
      case 'leave':
        return this.leave(conn)
      case 'up': {
        const campaignId = conn.entered
        const host = campaignId ? this.hosts.get(campaignId) : undefined
        if (campaignId && host)
          this.send(host, { t: 'up', campaignId, peerId: conn.user.id, data: frame.data })
        return
      }
      case 'down': {
        if (this.hosts.get(frame.campaignId) !== conn) return
        const player = this.players.get(frame.campaignId)?.get(frame.peerId)
        if (player) this.send(player, { t: 'down', data: frame.data })
        return
      }
      case 'kick': {
        if (this.hosts.get(frame.campaignId) !== conn) return
        this.removeFromGame(frame.campaignId, frame.peerId)
        return
      }
    }
  }
}

export function registerHub(app: FastifyInstance, ctx: Ctx): void {
  const beat = setInterval(() => ctx.hub.heartbeat(), 30_000)
  const refill = setInterval(() => ctx.hub.refill(), 1000)
  beat.unref()
  refill.unref()
  app.addHook('onClose', async () => {
    clearInterval(beat)
    clearInterval(refill)
  })

  app.get(
    '/api/ws',
    {
      websocket: true,
      preValidation: async (request, reply) => {
        const user = await userFromCookie(ctx, request)
        if (!user) return reply.status(401).send({ error: 'unauthenticated' })
        request.user = user
      },
    },
    (socket, request) => {
      // Frames that arrive while the connection registers wait their turn.
      let queue: Promise<unknown> = ctx.hub.add(socket, request.user!)
      const ready = queue as Promise<Conn>
      socket.on('pong', () => void ready.then((c) => (c.alive = true)))
      socket.on('message', (data) => {
        queue = queue
          .then(async () => ctx.hub.handle(await ready, data.toString()))
          .catch((error) => request.log.error(error))
      })
      socket.on('close', () => {
        queue = queue.then(async () => ctx.hub.remove(await ready)).catch(() => {})
      })
    },
  )
}
