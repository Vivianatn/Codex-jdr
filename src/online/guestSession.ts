import Dexie from 'dexie'
import { CodexDB } from '@/db/db'
import { markRemote } from '@/db/middleware'
import { isSafeImageDataUrl } from '@/db/sanitize'
import { randomBytes, wipe } from '@/security/crypto'
import { REMOTE_DB_PREFIX } from '@/security/session'
import { applyExternalChanges, useCampaignStore } from '@/stores/campaignStore'
import { applyExternalRolls, useRollStore } from '@/stores/rollStore'
import type { Link } from './link'
import type { GuestRole, PeerInfo } from './onlineStore'
import {
  parseHostMessage,
  PROTOCOL_VERSION,
  SYNC_TABLES,
  type GuestMessage,
  type HostMessage,
  type Intent,
  type RejectReason,
  type TableChanges,
} from './protocol'

export interface Welcome {
  selfId: string
  role: GuestRole
  campaignId: string
  campaignName: string
  hostName: string
}

export interface GuestEvents {
  onPeers?: (peers: PeerInfo[]) => void
  onRejected?: (reason: RejectReason) => void
  /** The host closed the game or the connection dropped. */
  onClosed?: () => void
}

type Move = Extract<Intent, { type: 'move' }>

/**
 * A player in someone else's online game (D-245, D-262). What the operator
 * lets them see lives in a temporary copy, encrypted with a throwaway key and
 * deleted when leaving; the whole interface reads it through `activeDb()`.
 * The player never writes it: moves and rolls are intents the operator plays.
 *
 * Responsiveness (D-270): what arrives goes to the open screen first, the
 * encrypted copy is written behind it; the player's own token moves at once
 * and goes back if the operator refuses the move. A dropped connection can be
 * resumed on a new link: the operator then sends a fresh full copy.
 */
export class GuestSession {
  readonly copy: CodexDB
  private key: Uint8Array | null = randomBytes(32)
  private welcome: Welcome | null = null
  private seq = 0
  private closed = false
  private suspended = false
  private link!: Link
  readonly ready: Promise<Welcome>
  private queue: Promise<void> = Promise.resolve()
  /** Writes of the copy, in order, behind what the screen already shows. */
  private writes: Promise<void> = Promise.resolve()
  private resolveReady!: (w: Welcome) => void
  private rejectReady!: (e: Error) => void
  /** Maps as the operator last sent them, under the moves still waiting for an answer. */
  private readonly confirmed = new Map<string, Record<string, unknown>>()
  private readonly moves = new Map<number, Move>()

  constructor(
    link: Link,
    private readonly name: string,
    private readonly events: GuestEvents = {},
    /** Brings received changes into the open campaign's stores (off in tests). */
    private readonly ingest = true,
  ) {
    this.copy = new CodexDB(`${REMOTE_DB_PREFIX}${crypto.randomUUID()}`, { key: this.key! })
    this.ready = new Promise((resolve, reject) => {
      this.resolveReady = resolve
      this.rejectReady = reject
    })
    // Nobody may be waiting on `ready` when the connection drops early.
    this.ready.catch(() => {})
    this.attach(link)
  }

  get role(): GuestRole | null {
    return this.welcome?.role ?? null
  }

  /** Ask the operator to act (move, roll). A move shows at once (D-270). */
  intent(intent: Intent): void {
    const seq = ++this.seq
    this.send({ type: 'intent', seq, intent })
    if (intent.type === 'move' && this.ingest && !this.closed) {
      this.moves.set(seq, intent)
      this.showMap(intent.mapId)
    }
  }

  choose(characterId: string | null): void {
    this.send({ type: 'choose', characterId })
  }

  /** The connection dropped: the copy stays, waiting for `resume` (D-270). */
  suspend(): void {
    if (!this.closed) this.suspended = true
  }

  /** Back on a new link: hello again, and the operator sends everything afresh. */
  resume(link: Link): void {
    if (this.closed) return
    this.suspended = false
    this.attach(link)
  }

  /** The operator's device came back on the same link: hello again. */
  rejoin(): void {
    this.forgetMoves()
    this.send({ type: 'hello', protocol: PROTOCOL_VERSION, name: this.name })
  }

  /** Leaves and deletes the copy. */
  async leave(): Promise<void> {
    this.link.close()
    await this.finish()
  }

  private attach(link: Link): void {
    this.link = link
    this.forgetMoves()
    link.onMessage((raw) => {
      if (this.link !== link) return
      const message = parseHostMessage(raw)
      // One message at a time, in order.
      if (message) this.queue = this.queue.then(() => this.handle(message)).catch(console.error)
    })
    link.onClose(() => {
      if (this.link === link && !this.suspended) void this.finish()
    })
    link.send({ type: 'hello', protocol: PROTOCOL_VERSION, name: this.name } satisfies GuestMessage)
  }

  private send(message: GuestMessage): void {
    if (!this.closed) this.link.send(message)
  }

  private async handle(message: HostMessage): Promise<void> {
    switch (message.type) {
      case 'welcome':
        if (message.protocol !== PROTOCOL_VERSION) return void this.leave()
        this.welcome = {
          selfId: message.selfId,
          role: message.role,
          campaignId: message.campaignId,
          campaignName: message.campaignName,
          hostName: message.hostName,
        }
        if (!this.copy.isOpen()) await this.copy.open()
        return
      case 'sync':
        await this.apply(message.changes, message.initial)
        if (message.initial && this.welcome) this.resolveReady(this.welcome)
        return
      case 'peers':
        this.events.onPeers?.(message.peers)
        return
      case 'ack':
        // The operator's next sync carries the move.
        this.moves.delete(message.seq)
        return
      case 'rejected': {
        const move = this.moves.get(message.seq)
        if (move) {
          this.moves.delete(message.seq)
          this.showMap(move.mapId)
        }
        this.events.onRejected?.(message.reason)
        return
      }
      case 'bye':
        return void this.leave()
    }
  }

  /**
   * Brings the operator's changes into the screen and the copy. An initial
   * sync is the whole table: what the copy has beyond it is gone (a resumed game).
   */
  private async apply(changes: TableChanges[], initial: boolean): Promise<void> {
    if (!this.welcome || this.closed) return
    const fresh = changes
      .map((c) => ({
        table: c.table,
        put: c.put.filter((r) => c.table !== 'assets' || isSafeImageDataUrl(r.data)),
        del: c.del,
      }))
      .filter((c) => c.put.length || c.del.length)
    if (initial) await this.dropMissing(fresh)
    if (!fresh.length) return
    for (const c of fresh)
      if (c.table === 'maps') {
        for (const r of c.put) this.confirmed.set(String(r.id), r)
        for (const id of c.del) this.confirmed.delete(id)
      }
    const write = () => this.write(fresh)
    if (this.ingest && this.storesReady()) {
      this.show(fresh)
      this.writes = this.writes.then(write).catch((error) => console.error('Guest copy', error))
      return
    }
    // The screen is still loading from the copy: write first, then show.
    const written = this.writes.then(write)
    this.writes = written.catch((error) => console.error('Guest copy', error))
    await written
    if (this.ingest) this.show(fresh)
  }

  private async write(changes: TableChanges[]): Promise<void> {
    if (this.closed) return
    await this.copy.transaction(
      'rw',
      changes.map((c) => this.copy.table(c.table)),
      async (tx) => {
        markRemote(tx.idbtrans)
        for (const c of changes) {
          if (c.put.length) await this.copy.table(c.table).bulkPut(c.put)
          if (c.del.length) await this.copy.table(c.table).bulkDelete(c.del)
        }
      },
    )
  }

  /** Adds to `changes` the deletion of every record of the copy the full sync does not list. */
  private async dropMissing(changes: TableChanges[]): Promise<void> {
    await this.writes
    if (this.closed) return
    for (const table of SYNC_TABLES) {
      const keys = (await this.copy.table(table).toCollection().primaryKeys()).map(String)
      if (!keys.length) continue
      let change = changes.find((c) => c.table === table)
      const listed = new Set(change?.put.map((r) => String(r.id)) ?? [])
      const gone = keys.filter((k) => !listed.has(k))
      if (!gone.length) continue
      if (!change) {
        change = { table, put: [], del: [] }
        changes.push(change)
      }
      change.del = [...new Set([...change.del, ...gone])]
    }
  }

  private storesReady(): boolean {
    const id = this.welcome?.campaignId
    const s = useCampaignStore.getState()
    return s.campaignId === id && s.status === 'ready' && useRollStore.getState().campaignId === id
  }

  /** Into the open campaign's stores, with the player's pending moves on top. */
  private show(changes: TableChanges[]): void {
    applyExternalChanges(
      changes.map((c) =>
        c.table === 'maps' && this.moves.size
          ? { ...c, put: c.put.map((r) => this.withMoves(r)) }
          : c,
      ),
    )
    const rolls = changes.find((c) => c.table === 'rolls')
    if (rolls) applyExternalRolls(rolls.put, rolls.del)
  }

  /** Shows a map as the operator sent it, with the moves still waiting on top. */
  private showMap(mapId: string): void {
    if (!this.storesReady()) return
    const base =
      this.confirmed.get(mapId) ??
      (useCampaignStore.getState().maps[mapId] as unknown as Record<string, unknown> | undefined)
    if (base) applyExternalChanges([{ table: 'maps', put: [this.withMoves(base)], del: [] }])
  }

  private withMoves(map: Record<string, unknown>): Record<string, unknown> {
    const moves = [...this.moves.values()].filter((m) => m.mapId === map.id)
    if (!moves.length || !Array.isArray(map.tokens)) return map
    const tokens = (map.tokens as Record<string, unknown>[]).map((token) => {
      const move = moves.findLast((m) => m.tokenId === token.id)
      return move ? { ...token, col: move.col, row: move.row } : token
    })
    return { ...map, tokens }
  }

  private forgetMoves(): void {
    const maps = new Set([...this.moves.values()].map((m) => m.mapId))
    this.moves.clear()
    for (const id of maps) this.showMap(id)
  }

  private async finish(): Promise<void> {
    if (this.closed) return
    this.closed = true
    this.rejectReady(new Error('Connection closed'))
    await this.writes
    this.copy.close()
    wipe(this.key)
    this.key = null
    await Dexie.delete(this.copy.name)
    this.events.onClosed?.()
  }
}
