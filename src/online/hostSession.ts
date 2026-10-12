import { toast } from 'sonner'
import { activeDb, type CodexDB } from '@/db/db'
import { markRemote } from '@/db/middleware'
import { isSafeImageDataUrl, safeImage } from '@/db/sanitize'
import type { Campaign } from '@/db/types'
import { blockingWall, inBounds, tokenCenter } from '@/domain/maps'
import { HOST_ID, normalizePlayState, type LiveGame, type PlayState } from '@/domain/turns'
import type { Entity } from '@/domain/types'
import { createGameActions } from '@/features/game/gameActions'
import { createMapActions } from '@/features/game/mapActions'
import type { Messages } from '@/i18n/locales/fr'
import { withDefaultRules } from '@/rules'
import { applyExternalChanges, useCampaignStore } from '@/stores/campaignStore'
import { applyExternalRolls } from '@/stores/rollStore'
import { channelLink, type Link } from './link'
import { useOnlineStore, type GuestRole, type PeerInfo } from './onlineStore'
import { loadCampaignData, projectForPlayer, Replica, type CampaignData } from './projection'
import {
  parseGuestMessage,
  PROTOCOL_VERSION,
  SYNC_TABLES,
  type GuestMessage,
  type HostMessage,
  type Intent,
  type RejectReason,
  type SyncTable,
  type TableChanges,
} from './protocol'
import { acceptGuestAnswer, channelOpen, createHostOffer } from './rtc'
import { decodeCode, encodeCode, InvalidCodeError } from './signaling'

interface Peer {
  info: PeerInfo
  link: Link | null
  pc: RTCPeerConnection | null
  channel: RTCDataChannel | null
  replica: Replica
  welcomed: boolean
}

/** Tables only the operator may change while a game is running (D-244). */
const OPERATOR_TABLES = new Set<SyncTable>(['entities', 'maps', 'rolls', 'skills'])
const SYNC_DELAY = 50

export interface HostOptions {
  campaignId: string
  campaignName: string
  hostName: string
  t: Messages
  servers: RTCIceServer[]
  db?: () => CodexDB
}

/**
 * The GM's device sharing a campaign (D-245). It owns the data: guests get a
 * filtered copy (editors everything, players what they may see), editors'
 * writes are checked then applied, players' intents are checked then played
 * by the host itself. Every message is handled in order, one at a time.
 */
export class HostSession {
  private readonly peers = new Map<string, Peer>()
  private readonly db: () => CodexDB
  private data: CampaignData | null = null
  private readonly dirty = new Set<SyncTable>(SYNC_TABLES)
  private timer: ReturnType<typeof setTimeout> | null = null
  private queue: Promise<void> = Promise.resolve()
  private readonly unsubscribe: () => void
  private stopped = false

  constructor(private readonly options: HostOptions) {
    this.db = options.db ?? activeDb
    this.unsubscribe = this.db().onChanges((changes) => {
      let relevant = false
      for (const c of changes)
        if ((SYNC_TABLES as readonly string[]).includes(c.table)) {
          this.dirty.add(c.table as SyncTable)
          relevant = true
        }
      if (relevant) this.scheduleSync()
    })
    this.publish()
  }

  // ---- invitations ----------------------------------------------------------

  /** Registers a guest to come; the RTC part is separate so tests can plug a memory link. */
  prepare(role: GuestRole): string {
    const id = crypto.randomUUID()
    this.peers.set(id, {
      info: { id, name: '', role, status: 'inviting', characterIds: [] },
      link: null,
      pc: null,
      channel: null,
      replica: new Replica(),
      welcomed: false,
    })
    this.publish()
    return id
  }

  /** Invitation code for one guest (single use). */
  async invite(role: GuestRole): Promise<{ peerId: string; code: string }> {
    const peerId = this.prepare(role)
    const offer = await createHostOffer(this.options.servers)
    const peer = this.peers.get(peerId)!
    peer.pc = offer.pc
    peer.channel = offer.channel
    offer.pc.addEventListener('connectionstatechange', () => {
      if (['failed', 'closed'].includes(offer.pc.connectionState)) this.drop(peerId)
    })
    const code = await encodeCode({
      v: 1,
      kind: 'invite',
      peerId,
      role,
      campaignName: this.options.campaignName,
      hostName: this.options.hostName,
      sdp: offer.sdp,
    })
    return { peerId, code }
  }

  /** The guest's reply code: completes the connection. */
  async accept(replyText: string): Promise<void> {
    const reply = await decodeCode(replyText)
    if (reply.kind !== 'reply') throw new InvalidCodeError()
    const peer = this.peers.get(reply.peerId)
    if (!peer?.pc || !peer.channel || peer.link) throw new InvalidCodeError()
    await acceptGuestAnswer(peer.pc, reply.sdp)
    const channel = await channelOpen(peer.channel)
    this.attach(reply.peerId, channelLink(channel))
  }

  /** Plugs a connected link to a prepared guest. */
  attach(peerId: string, link: Link): void {
    const peer = this.peers.get(peerId)
    if (!peer || peer.link) {
      link.close()
      return
    }
    peer.link = link
    link.onMessage((raw) => {
      const message = parseGuestMessage(raw)
      if (message) this.enqueue(() => this.handle(peer, message))
    })
    link.onClose(() => this.drop(peerId))
  }

  /** Disconnects a guest (also used when one leaves). */
  remove(peerId: string): void {
    const peer = this.peers.get(peerId)
    if (!peer) return
    this.send(peer, { type: 'bye' })
    this.drop(peerId)
    this.peers.delete(peerId)
    this.publish()
    this.broadcastPeers()
  }

  stop(): void {
    if (this.stopped) return
    this.stopped = true
    for (const peer of this.peers.values()) {
      this.send(peer, { type: 'bye' })
      peer.link?.close()
      peer.pc?.close()
    }
    this.peers.clear()
    this.unsubscribe()
    if (this.timer) clearTimeout(this.timer)
  }

  // ---- messages -------------------------------------------------------------

  private enqueue(task: () => Promise<void>): void {
    this.queue = this.queue.then(task).catch((error) => console.error('Online host', error))
  }

  private send(peer: Peer, message: HostMessage): void {
    peer.link?.send(message)
  }

  private async handle(peer: Peer, message: GuestMessage): Promise<void> {
    if (this.stopped) return
    if (message.type === 'hello') return this.welcome(peer, message.name, message.protocol)
    if (!peer.welcomed) return
    switch (message.type) {
      case 'write': {
        const reason =
          peer.info.role === 'editor' ? await this.checkWrite(peer, message.changes) : 'forbidden'
        if (reason) return this.reject(peer, message.seq, reason, message.changes)
        await this.applyWrite(message.changes)
        this.send(peer, { type: 'ack', seq: message.seq })
        return
      }
      case 'choose':
        return this.choose(peer, message.characterId)
      case 'intent': {
        const reason =
          peer.info.role === 'player' ? await this.play(peer, message.intent) : 'forbidden'
        if (reason) {
          if (message.intent.type === 'move') peer.replica.forget('maps', [message.intent.mapId])
          return this.reject(peer, message.seq, reason, [])
        }
        this.send(peer, { type: 'ack', seq: message.seq })
      }
    }
  }

  private async welcome(peer: Peer, name: string, protocol: number): Promise<void> {
    if (peer.welcomed || protocol !== PROTOCOL_VERSION) {
      if (protocol !== PROTOCOL_VERSION) this.remove(peer.info.id)
      return
    }
    peer.welcomed = true
    peer.info = { ...peer.info, name, status: 'connected' }
    this.send(peer, {
      type: 'welcome',
      protocol: PROTOCOL_VERSION,
      selfId: peer.info.id,
      role: peer.info.role,
      campaignId: this.options.campaignId,
      campaignName: this.options.campaignName,
      hostName: this.options.hostName,
    })
    await this.refresh()
    this.send(peer, { type: 'sync', changes: peer.replica.diff(this.viewOf(peer)), initial: true })
    this.publish()
    this.broadcastPeers()
    toast(this.options.t.online.joined(name))
    await this.noteParticipant(name)
  }

  private async reject(
    peer: Peer,
    seq: number,
    reason: RejectReason,
    changes: TableChanges[],
  ): Promise<void> {
    // The guest gets the truth back for what it tried to change…
    for (const c of changes)
      peer.replica.forget(c.table, [...c.put.map((r) => String(r.id)), ...c.del])
    this.send(peer, { type: 'rejected', seq, reason })
    // …and records it made up disappear from its copy (after "rejected", which
    // ends their pending state on the guest).
    await this.refresh()
    const view = this.viewOf(peer)
    const stray = changes
      .map((c) => {
        const known = new Set(
          (view[c.table] as unknown as { id: string }[]).map((r) => String(r.id)),
        )
        return {
          table: c.table,
          put: [],
          del: c.put.map((r) => String(r.id)).filter((id) => !known.has(id)),
        }
      })
      .filter((c) => c.del.length)
    if (stray.length) this.send(peer, { type: 'sync', changes: stray, initial: false })
    this.scheduleSync()
  }

  // ---- editors' writes ------------------------------------------------------

  private async campaign(): Promise<Campaign | undefined> {
    return this.db().campaigns.get(this.options.campaignId)
  }

  /** The host's open campaign is the truth (its auto-save lags behind); otherwise the database. */
  private async currentPlay(): Promise<PlayState> {
    const store = useCampaignStore.getState()
    if (store.campaignId === this.options.campaignId && store.status === 'ready') return store.play
    return normalizePlayState((await this.campaign())?.play)
  }

  /** Why a write is refused, or null (D-245). Never trust a peer. */
  private async checkWrite(peer: Peer, changes: TableChanges[]): Promise<RejectReason | null> {
    const campaignId = this.options.campaignId
    const campaign = await this.campaign()
    if (!campaign) return 'forbidden'
    const current = await this.currentPlay()
    const live = current.live
    const operating = live?.operator.id === peer.info.id
    for (const change of changes) {
      const table = this.db().table(change.table)
      if (live && !operating && OPERATOR_TABLES.has(change.table)) return 'notOperator'
      for (const record of change.put) {
        const id = String(record.id)
        if (change.table === 'campaigns') {
          if (id !== campaignId) return 'forbidden'
          const next = normalizePlayState(record.play)
          if (!sameLive(live, next.live)) {
            const allowed = live ? operating : next.live?.operator.id === peer.info.id
            if (!allowed) return 'notOperator'
          } else if (
            live &&
            !operating &&
            JSON.stringify(normalizePlayState(record.play)) !== JSON.stringify(current)
          )
            return 'notOperator'
          continue
        }
        if (record.campaignId !== campaignId) return 'forbidden'
        const existing = (await table.get(id)) as Record<string, unknown> | undefined
        if (existing && existing.campaignId !== campaignId) return 'forbidden'
        if (change.table === 'assets' && !isSafeImageDataUrl(record.data)) return 'invalid'
      }
      for (const id of change.del) {
        if (change.table === 'campaigns') return 'forbidden'
        const existing = (await table.get(id)) as Record<string, unknown> | undefined
        if (existing && existing.campaignId !== campaignId) return 'forbidden'
      }
    }
    return null
  }

  private async applyWrite(changes: TableChanges[]): Promise<void> {
    const clean = changes.map((c) => ({ ...c, put: c.put.map((r) => sanitize(c.table, r)) }))
    const db = this.db()
    await db.transaction(
      'rw',
      clean.map((c) => db.table(c.table)),
      async (tx) => {
        markRemote(tx.idbtrans)
        for (const c of clean) {
          if (c.put.length) await db.table(c.table).bulkPut(c.put)
          if (c.del.length) await db.table(c.table).bulkDelete(c.del)
        }
      },
    )
    if (useCampaignStore.getState().campaignId === this.options.campaignId) {
      applyExternalChanges(clean)
      const rolls = clean.find((c) => c.table === 'rolls')
      if (rolls) applyExternalRolls(rolls.put, rolls.del)
    }
  }

  // ---- players ---------------------------------------------------------------

  private async choose(peer: Peer, characterId: string | null): Promise<void> {
    if (peer.info.role !== 'player') return
    if (characterId) {
      const entity = (await this.db().entities.get(characterId)) as Entity | undefined
      const taken = [...this.peers.values()].some(
        (p) => p !== peer && p.info.characterIds.includes(characterId),
      )
      if (
        !entity ||
        entity.campaignId !== this.options.campaignId ||
        entity.kind !== 'player' ||
        taken
      )
        return this.reject(peer, -1, 'taken', [])
    }
    peer.info = { ...peer.info, characterIds: characterId ? [characterId] : [] }
    this.publish()
    this.broadcastPeers()
    this.scheduleSync()
  }

  /** Plays a player's intent as the host, or says why not. */
  private async play(peer: Peer, intent: Intent): Promise<RejectReason | null> {
    const record = await this.campaign()
    if (!record) return 'forbidden'
    const play = await this.currentPlay()
    if (!play.live || play.live.mode !== 'online') return 'notOnline'
    const own = intent.type === 'move' ? null : intent.entityId
    if (own && !peer.info.characterIds.includes(own)) return 'notYours'

    // Intents act through the host's own store, like the GM would.
    const store = useCampaignStore.getState()
    if (store.campaignId !== this.options.campaignId) await store.load(this.options.campaignId)
    const campaign: Campaign = { ...record, rules: withDefaultRules(record.rules) }
    const game = createGameActions(this.options.t, campaign)

    if (intent.type === 'move') {
      const map = useCampaignStore.getState().maps[intent.mapId]
      const token = map?.tokens.find((t) => t.id === intent.tokenId)
      if (!map || map.id !== play.mapId || !token || token.hidden) return 'invalid'
      if (!peer.info.characterIds.includes(token.entityId)) return 'notYours'
      const cell = { col: intent.col, row: intent.row }
      if (!inBounds(map, cell)) return 'invalid'
      if (
        blockingWall(
          map.walls,
          tokenCenter(map.grid, token),
          tokenCenter(map.grid, { ...token, ...cell }),
        )
      )
        return 'blocked'
      createMapActions(this.options.t, campaign, game).moveToken(map.id, token.id, cell)
      return null
    }
    if (intent.type === 'check') {
      game.check(intent.entityId, intent.stat, { mode: intent.mode })
      return null
    }
    try {
      game.freeRoll(intent.expression, { entityId: intent.entityId })
      return null
    } catch {
      return 'invalid'
    }
  }

  // ---- synchronisation -------------------------------------------------------

  private viewOf(peer: Peer): CampaignData {
    return peer.info.role === 'editor' ? this.data! : projectForPlayer(this.data!)
  }

  private async refresh(): Promise<void> {
    if (!this.dirty.size && this.data) return
    const tables = [...this.dirty]
    this.dirty.clear()
    this.data = await loadCampaignData(
      this.db(),
      this.options.campaignId,
      tables,
      this.data ?? undefined,
    )
  }

  private scheduleSync(): void {
    if (this.timer || this.stopped) return
    this.timer = setTimeout(() => {
      this.timer = null
      this.enqueue(() => this.sync())
    }, SYNC_DELAY)
  }

  private async sync(): Promise<void> {
    if (this.stopped) return
    await this.refresh()
    for (const peer of this.peers.values()) {
      if (!peer.welcomed || !peer.link) continue
      const changes = peer.replica.diff(this.viewOf(peer))
      if (changes.length) this.send(peer, { type: 'sync', changes, initial: false })
    }
  }

  /** Lets every guest know who is there (handover, chosen characters). */
  private broadcastPeers(): void {
    const peers = this.list()
    for (const peer of this.peers.values())
      if (peer.welcomed) this.send(peer, { type: 'peers', peers })
  }

  private list(): PeerInfo[] {
    return [...this.peers.values()].map((p) => p.info)
  }

  private publish(): void {
    if (this.stopped) return
    useOnlineStore.setState({ peers: this.list() })
  }

  private drop(peerId: string): void {
    const peer = this.peers.get(peerId)
    if (!peer || peer.info.status === 'closed') return
    const wasConnected = peer.info.status === 'connected'
    peer.info = { ...peer.info, status: 'closed', characterIds: [] }
    peer.link?.close()
    peer.pc?.close()
    peer.link = null
    peer.welcomed = false
    this.publish()
    this.broadcastPeers()
    if (wasConnected) toast(this.options.t.online.left(peer.info.name))
    // An operator who leaves hands the table back to the host.
    this.enqueue(async () => {
      const live = (await this.currentPlay()).live
      if (live?.operator.id !== peerId) return
      const store = useCampaignStore.getState()
      if (store.campaignId === this.options.campaignId)
        store.updatePlay(
          (play) =>
            play.live
              ? {
                  ...play,
                  live: { ...play.live, operator: { id: HOST_ID, name: this.options.hostName } },
                }
              : play,
          this.options.t.sessions.handedOver(this.options.hostName),
        )
    })
  }

  private async noteParticipant(name: string): Promise<void> {
    const live = (await this.currentPlay()).live
    if (!live) return
    await this.db().transaction('rw', this.db().sessionRuns, async () => {
      const run = await this.db().sessionRuns.get(live.runId)
      if (run && !run.participants.includes(name))
        await this.db().sessionRuns.put({ ...run, participants: [...run.participants, name] })
    })
  }
}

function sameLive(a: LiveGame | null, b: LiveGame | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** Pictures from a peer must be raster images (D-243). */
function sanitize(table: SyncTable, record: Record<string, unknown>): Record<string, unknown> {
  if (table === 'entities' || table === 'bestiary') {
    const e = record as unknown as Entity
    return {
      ...record,
      identity: {
        ...e.identity,
        portrait: safeImage(e.identity?.portrait),
        body: safeImage(e.identity?.body),
      },
      inventory: (e.inventory ?? []).map((i) => ({ ...i, image: safeImage(i.image) })),
    }
  }
  if (table === 'itemLibrary') return { ...record, image: safeImage(record.image) }
  return record
}
