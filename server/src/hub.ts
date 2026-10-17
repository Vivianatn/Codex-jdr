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
  /**
   * How long the players of a game wait for the operator's device when its
   * connection drops (D-270): it reconnects and serves them again, they stay in.
   */
  static hostGrace = 30_000

  private readonly conns = new Set<Conn>()
  /** campaignId → the operator's connection serving its players. */
  private readonly hosts = new Map<string, Conn>()
  /** campaignId → operator whose connection dropped, and the end of the wait. */
  private readonly away = new Map<
    string,
    { userId: string; timer: ReturnType<typeof setTimeout> }
  >()
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
    if (first) {
      await this.presenceOfUser(user.id)
      await this.friendsSeeOnline(user.id)
    }
    return conn
  }

  async remove(conn: Conn): Promise<void> {
    if (!this.conns.delete(conn)) return
    for (const campaignId of conn.serving) this.hostAway(campaignId, conn)
    this.leave(conn)
    if (!this.byUser(conn.user.id).length) {
      await this.presenceOfUser(conn.user.id)
      await this.friendsSeeOnline(conn.user.id)
    }
  }

  /** Is this account connected right now (any device)? */
  isOnline(userId: string): boolean {
    return this.byUser(userId).length > 0
  }

  /** An account came or went: its adventurers read their lists again (D-267). */
  private async friendsSeeOnline(userId: string): Promise<void> {
    const rows = await this.db.query<{ other: string }>(
      `SELECT CASE WHEN requester = $1 THEN addressee ELSE requester END AS other
       FROM friendships WHERE (requester = $1 OR addressee = $1) AND accepted_at IS NOT NULL`,
      [userId],
    )
    this.notifyFriends(rows.map((r) => r.other))
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

  /** The operator's device sends one frame per player for each change: its budget grows with them. */
  refill(): void {
    for (const conn of this.conns) {
      let players = 0
      for (const campaignId of conn.serving) players += this.players.get(campaignId)?.size ?? 0
      conn.budget = FRAMES_PER_SECOND * (1 + players)
    }
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
    for (const { timer } of this.away.values()) clearTimeout(timer)
    this.away.clear()
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

  /** Adventurers or requests of these accounts changed (D-267). */
  notifyFriends(userIds: Iterable<string>): void {
    this.sendUsers(userIds, { t: 'friends' })
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

  /** The running game changed (started, ended, handed over, listed): the relay follows. */
  async liveChanged(campaignId: string): Promise<void> {
    const host = this.hosts.get(campaignId)
    if (host && !(await this.mayServe(campaignId, host.user.id))) this.dropHost(campaignId, host)
    const away = this.away.get(campaignId)
    if (away && !(await this.mayServe(campaignId, away.userId))) this.awayOver(campaignId)
    this.notifyCampaigns(await this.membersOf([campaignId]))
    this.sessionsChanged()
  }

  /** Is the operator's device of this campaign serving its players right now? */
  isServing(campaignId: string): boolean {
    return this.hosts.has(campaignId) || this.away.has(campaignId)
  }

  /** Everyone connected reads the catalogue of open sessions again (it is small). */
  sessionsChanged(): void {
    for (const conn of this.conns) this.send(conn, { t: 'sessions' })
  }

  /** The campaign is deleted: its game stops. */
  endCampaign(campaignId: string): void {
    const host = this.hosts.get(campaignId)
    if (host) this.dropHost(campaignId, host)
    this.awayOver(campaignId)
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
    if (live?.mode !== 'online' || live.operatorId !== userId) return false
    // A GM named back player mid-game stops serving (D-274).
    const [row] = await this.db.query<{ role: MemberRole }>(
      'SELECT role FROM members WHERE campaign_id = $1 AND user_id = $2',
      [campaignId, userId],
    )
    return row?.role === 'owner' || row?.role === 'editor'
  }

  private dropHost(campaignId: string, host: Conn): void {
    host.serving.delete(campaignId)
    if (this.hosts.get(campaignId) !== host) return
    this.hosts.delete(campaignId)
    this.send(host, { t: 'serving', campaignId, ok: false })
    this.endGame(campaignId)
  }

  /** The players are out: the game is over here. */
  private endGame(campaignId: string): void {
    for (const player of this.players.get(campaignId)?.values() ?? []) {
      player.entered = null
      this.send(player, { t: 'hostGone' })
    }
    this.players.delete(campaignId)
    this.sessionsChanged()
  }

  /** The operator's connection dropped: its players wait a little for it to come back (D-270). */
  private hostAway(campaignId: string, host: Conn): void {
    host.serving.delete(campaignId)
    if (this.hosts.get(campaignId) !== host) return
    this.hosts.delete(campaignId)
    const timer = setTimeout(() => this.awayOver(campaignId), Hub.hostGrace)
    timer.unref?.()
    this.away.set(campaignId, { userId: host.user.id, timer })
  }

  private awayOver(campaignId: string): void {
    const away = this.away.get(campaignId)
    if (!away) return
    clearTimeout(away.timer)
    this.away.delete(campaignId)
    this.endGame(campaignId)
  }

  /** The operator serves again: the players who waited are introduced to it and say hello again. */
  private async welcomeBack(campaignId: string, host: Conn): Promise<void> {
    const players = [...(this.players.get(campaignId)?.values() ?? [])]
    if (!players.length) return
    const rows = await this.db.query<{ user_id: string; character_id: string | null }>(
      'SELECT user_id, character_id FROM members WHERE campaign_id = $1',
      [campaignId],
    )
    for (const player of players) {
      if (this.hosts.get(campaignId) !== host || player.entered !== campaignId) continue
      this.send(host, {
        t: 'peer',
        campaignId,
        peerId: player.user.id,
        name: player.user.displayName,
        characterId: rows.find((r) => r.user_id === player.user.id)?.character_id ?? null,
      })
      this.send(player, { t: 'entered', campaignId })
    }
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
        const away = this.away.get(campaignId)
        if (ok) {
          const previous = this.hosts.get(campaignId)
          if (previous && previous !== conn) this.dropHost(campaignId, previous)
          this.hosts.set(campaignId, conn)
          conn.serving.add(campaignId)
          if (away) {
            clearTimeout(away.timer)
            this.away.delete(campaignId)
          }
        }
        this.send(conn, { t: 'serving', campaignId, ok })
        if (ok) {
          if (away) await this.welcomeBack(campaignId, conn)
          this.notifyCampaigns(await this.membersOf([campaignId], ['player']))
          this.sessionsChanged()
        }
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
        // While the operator's device reconnects, players enter and wait for it.
        if (!host && !this.away.has(campaignId))
          return this.send(conn, { t: 'enterFailed', campaignId, reason: 'notLive' })
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
        if (host)
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
