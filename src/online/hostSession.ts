import { toast } from 'sonner'
import { activeDb, type CodexDB } from '@/db/db'
import type { Campaign } from '@/db/types'
import { controlledBy } from '@/domain/familiars'
import { blockingWall, inBounds, tokenCenter } from '@/domain/maps'
import { normalizePlayState, type PlayState } from '@/domain/turns'
import type { Entity } from '@/domain/types'
import { createGameActions } from '@/features/game/gameActions'
import { createMapActions } from '@/features/game/mapActions'
import { ensurePlayerColor } from '@/features/characters/playerColorActions'
import type { Messages } from '@/i18n/locales/fr'
import { withDefaultRules } from '@/rules'
import { useCampaignStore } from '@/stores/campaignStore'
import { withActivityAuthor } from '@/stores/activityLog'
import type { Link } from './link'
import { useOnlineStore, type PeerInfo } from './onlineStore'
import { HostFeed } from './hostFeed'
import { projectForPlayer, Replica, type CampaignData } from './projection'
import {
  parseGuestMessage,
  PROTOCOL_VERSION,
  type GuestMessage,
  type HostMessage,
  type Intent,
  type RejectReason,
} from './protocol'

interface Peer {
  info: PeerInfo
  link: Link | null
  replica: Replica
  welcomed: boolean
  /** The GM chose this player's character when accepting them (D-257): it cannot be changed. */
  assigned: boolean
}

/**
 * Players are synced at most this often (D-270): a lone action goes out at once,
 * a burst (painting fog, several quick moves) is grouped, and the relay's frame
 * budget is never exceeded.
 */
const SYNC_INTERVAL = 33

export interface HostOptions {
  campaignId: string
  campaignName: string
  hostName: string
  t: Messages
  db?: () => CodexDB
}

/**
 * The operator's device running an online game (D-245, D-262). Players reach it
 * through the server's relay: each gets a filtered copy of what they may see,
 * and their intents (moves, rolls) are checked then played by this device. The
 * operator's own edits reach the server like any other (sync engine). Every
 * message is handled in order, one at a time.
 */
export class HostSession {
  private readonly peers = new Map<string, Peer>()
  private readonly db: () => CodexDB
  private data: CampaignData | null = null
  private readonly feed: HostFeed
  private timer: ReturnType<typeof setTimeout> | null = null
  private lastSync = -Infinity
  private queue: Promise<void> = Promise.resolve()
  private stopped = false

  constructor(private readonly options: HostOptions) {
    this.db = options.db ?? activeDb
    this.feed = new HostFeed(this.db, options.campaignId, () => this.scheduleSync())
    this.publish()
  }

  /**
   * A player entered the game (the server checked who they are). Their peer id
   * is their account id; a second connection of the same player replaces the first.
   */
  admit(player: { id: string; name: string; characterId: string | null }, link: Link): void {
    const previous = this.peers.get(player.id)
    if (previous?.link) {
      previous.link.close()
      previous.link = null
    }
    const peer: Peer = {
      info: {
        id: player.id,
        name: player.name,
        role: 'player',
        status: 'connected',
        characterIds: player.characterId ? [player.characterId] : [],
      },
      link,
      replica: new Replica(),
      welcomed: false,
      assigned: player.characterId !== null,
    }
    this.peers.set(player.id, peer)
    // A player joining with a character gets their colour (D-268).
    if (player.characterId)
      ensurePlayerColor(this.options.t, this.options.campaignId, player.characterId)
    link.onMessage((raw) => {
      const message = parseGuestMessage(raw)
      if (message) this.enqueue(() => this.handle(peer, message))
    })
    link.onClose(() => this.drop(peer))
  }

  /** Puts a player out of the game. */
  remove(peerId: string): void {
    const peer = this.peers.get(peerId)
    if (!peer) return
    this.send(peer, { type: 'bye' })
    this.drop(peer)
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
    }
    this.peers.clear()
    this.feed.stop()
    if (this.timer) clearTimeout(this.timer)
    useOnlineStore.setState({ peers: [] })
  }

  // ---- messages -------------------------------------------------------------

  private enqueue(task: () => Promise<void>): void {
    this.queue = this.queue.then(task).catch((error) => console.error('Online host', error))
  }

  private send(peer: Peer, message: HostMessage): void {
    peer.link?.send(message)
  }

  private async handle(peer: Peer, message: GuestMessage): Promise<void> {
    if (this.stopped || this.peers.get(peer.info.id) !== peer) return
    if (message.type === 'hello') return this.welcome(peer, message.protocol)
    if (!peer.welcomed) return
    switch (message.type) {
      case 'choose':
        return this.choose(peer, message.characterId)
      case 'intent': {
        const reason = await this.play(peer, message.intent)
        if (reason) {
          if (message.intent.type === 'move') peer.replica.forget('maps', [message.intent.mapId])
          this.send(peer, { type: 'rejected', seq: message.seq, reason })
          this.scheduleSync()
          return
        }
        this.send(peer, { type: 'ack', seq: message.seq })
      }
    }
  }

  private async welcome(peer: Peer, protocol: number): Promise<void> {
    if (peer.welcomed) return
    if (protocol !== PROTOCOL_VERSION) return this.remove(peer.info.id)
    peer.welcomed = true
    this.send(peer, {
      type: 'welcome',
      protocol: PROTOCOL_VERSION,
      selfId: peer.info.id,
      role: 'player',
      campaignId: this.options.campaignId,
      campaignName: this.options.campaignName,
      hostName: this.options.hostName,
    })
    await this.refresh()
    this.send(peer, { type: 'sync', changes: peer.replica.diff(this.viewOf(peer)), initial: true })
    this.publish()
    this.broadcastPeers()
    toast(this.options.t.online.joined(peer.info.name))
    await this.noteParticipant(peer.info.name)
  }

  // ---- players ---------------------------------------------------------------

  private async campaign(): Promise<Campaign | undefined> {
    return this.db().campaigns.get(this.options.campaignId)
  }

  /** The operator's open campaign is the truth (its auto-save lags behind); otherwise the database. */
  private async currentPlay(): Promise<PlayState> {
    const store = useCampaignStore.getState()
    if (store.campaignId === this.options.campaignId && store.status === 'ready') return store.play
    return normalizePlayState((await this.campaign())?.play)
  }

  private async choose(peer: Peer, characterId: string | null): Promise<void> {
    const reject = () => this.send(peer, { type: 'rejected', seq: -1, reason: 'taken' })
    if (peer.assigned) return reject()
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
        return reject()
    }
    peer.info = { ...peer.info, characterIds: characterId ? [characterId] : [] }
    if (characterId) ensurePlayerColor(this.options.t, this.options.campaignId, characterId)
    this.publish()
    this.broadcastPeers()
    this.scheduleSync()
  }

  /** Plays a player's intent as the operator, or says why not. */
  private async play(peer: Peer, intent: Intent): Promise<RejectReason | null> {
    const record = await this.campaign()
    if (!record) return 'forbidden'
    const play = await this.currentPlay()
    if (!play.live || play.live.mode !== 'online') return 'notOnline'
    // Intents act through the operator's own store, like the GM would.
    const store = useCampaignStore.getState()
    if (store.campaignId !== this.options.campaignId) await store.load(this.options.campaignId)
    // A player acts for their character and the familiars attached to it, nothing else (D-269).
    const controlled = controlledBy(useCampaignStore.getState().entities, peer.info.characterIds)
    const own = intent.type === 'move' ? null : intent.entityId
    if (own && !controlled.has(own)) return 'notYours'
    const campaign: Campaign = { ...record, rules: withDefaultRules(record.rules) }
    const game = createGameActions(this.options.t, campaign)
    // What follows is synchronous: the activity log signs it with the player's name.
    const asPlayer = <R>(fn: () => R): R =>
      withActivityAuthor({ id: peer.info.id, name: peer.info.name }, fn)

    if (intent.type === 'move') {
      const map = useCampaignStore.getState().maps[intent.mapId]
      const token = map?.tokens.find((t) => t.id === intent.tokenId)
      // A player moves on the map where their character is (D-256), not only the GM's board.
      if (!map || !token || token.hidden) return 'invalid'
      if (!controlled.has(token.entityId)) return 'notYours'
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
      asPlayer(() =>
        createMapActions(this.options.t, campaign, game).moveToken(map.id, token.id, cell),
      )
      return null
    }
    if (intent.type === 'check') {
      asPlayer(() => game.check(intent.entityId, intent.stat, { mode: intent.mode }))
      return null
    }
    try {
      asPlayer(() => game.freeRoll(intent.expression, { entityId: intent.entityId }))
      return null
    } catch {
      return 'invalid'
    }
  }

  // ---- synchronisation -------------------------------------------------------

  private viewOf(peer: Peer): CampaignData {
    return projectForPlayer(this.data!, peer.info.characterIds)
  }

  private async refresh(): Promise<void> {
    this.data = await this.feed.current()
  }

  /** Called on every change: the whole synchronous action is done before the sync runs. */
  private scheduleSync(): void {
    if (this.timer || this.stopped) return
    const wait = this.lastSync + SYNC_INTERVAL - performance.now()
    const run = () => {
      this.timer = null
      this.lastSync = performance.now()
      this.enqueue(() => this.sync())
    }
    if (wait <= 0) run()
    else this.timer = setTimeout(run, wait)
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

  /** Lets every player know who is there and who plays whom. */
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

  private drop(peer: Peer): void {
    // A replaced connection of the same player: the new one stays.
    if (this.peers.get(peer.info.id) !== peer || peer.info.status === 'closed') return
    const wasConnected = peer.welcomed
    peer.info = { ...peer.info, status: 'closed' }
    peer.link?.close()
    peer.link = null
    peer.welcomed = false
    this.publish()
    this.broadcastPeers()
    if (wasConnected && !this.stopped) toast(this.options.t.online.left(peer.info.name))
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
