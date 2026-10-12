import Dexie from 'dexie'
import { CodexDB } from '@/db/db'
import { markRemote, type DbChange } from '@/db/middleware'
import { isSafeImageDataUrl } from '@/db/sanitize'
import { randomBytes, wipe } from '@/security/crypto'
import { REMOTE_DB_PREFIX } from '@/security/session'
import { applyExternalChanges } from '@/stores/campaignStore'
import { applyExternalRolls } from '@/stores/rollStore'
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
  /** The host closed the session or the connection dropped. */
  onClosed?: () => void
}

/**
 * A device that joined someone else's campaign (D-245). The campaign lives in a
 * temporary copy, encrypted with a throwaway key, deleted when leaving. The
 * host stays the source of truth: its syncs overwrite the copy, except for
 * records this device changed and the host has not confirmed yet.
 */
export class GuestSession {
  readonly copy: CodexDB
  private key: Uint8Array | null = randomBytes(32)
  private welcome: Welcome | null = null
  private seq = 0
  /** "table:id" → last write not yet confirmed. */
  private readonly pending = new Map<string, number>()
  private readonly unsubscribe: () => void
  private closed = false
  readonly ready: Promise<Welcome>
  private queue: Promise<void> = Promise.resolve()
  private resolveReady!: (w: Welcome) => void
  private rejectReady!: (e: Error) => void

  constructor(
    private readonly link: Link,
    name: string,
    private readonly events: GuestEvents = {},
    /** Brings received changes into the open campaign's stores (off in tests). */
    private readonly ingest = true,
  ) {
    this.copy = new CodexDB(`${REMOTE_DB_PREFIX}${crypto.randomUUID()}`, { key: this.key! })
    this.ready = new Promise((resolve, reject) => {
      this.resolveReady = resolve
      this.rejectReady = reject
    })
    this.unsubscribe = this.copy.onChanges((changes) => this.outbound(changes))
    // Nobody may be waiting on `ready` when the connection drops early.
    this.ready.catch(() => {})
    link.onMessage((raw) => {
      const message = parseHostMessage(raw)
      // One message at a time, in order.
      if (message) this.queue = this.queue.then(() => this.handle(message)).catch(console.error)
    })
    link.onClose(() => this.finish())
    link.send({ type: 'hello', protocol: PROTOCOL_VERSION, name } satisfies GuestMessage)
  }

  get role(): GuestRole | null {
    return this.welcome?.role ?? null
  }

  /** Players: ask the host to act (move, roll). */
  intent(intent: Intent): void {
    this.send({ type: 'intent', seq: ++this.seq, intent })
  }

  choose(characterId: string | null): void {
    this.send({ type: 'choose', characterId })
  }

  /** Leaves and deletes the copy. */
  async leave(): Promise<void> {
    this.link.close()
    await this.finish()
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
        await this.copy.open()
        return
      case 'sync':
        await this.apply(message.changes)
        if (message.initial && this.welcome) this.resolveReady(this.welcome)
        return
      case 'peers':
        this.events.onPeers?.(message.peers)
        return
      case 'ack':
        for (const [key, seq] of this.pending) if (seq <= message.seq) this.pending.delete(key)
        return
      case 'rejected':
        for (const [key, seq] of this.pending) if (seq <= message.seq) this.pending.delete(key)
        this.events.onRejected?.(message.reason)
        return
      case 'bye':
        return void this.leave()
    }
  }

  /** Writes the host's changes into the copy, skipping records with an unconfirmed local write. */
  private async apply(changes: TableChanges[]): Promise<void> {
    if (!this.welcome || this.closed) return
    const fresh = changes
      .map((c) => ({
        table: c.table,
        put: c.put.filter(
          (r) =>
            !this.pending.has(`${c.table}:${String(r.id)}`) &&
            (c.table !== 'assets' || isSafeImageDataUrl(r.data)),
        ),
        del: c.del.filter((id) => !this.pending.has(`${c.table}:${id}`)),
      }))
      .filter((c) => c.put.length || c.del.length)
    if (!fresh.length) return
    await this.copy.transaction(
      'rw',
      fresh.map((c) => this.copy.table(c.table)),
      async (tx) => {
        markRemote(tx.idbtrans)
        for (const c of fresh) {
          if (c.put.length) await this.copy.table(c.table).bulkPut(c.put)
          if (c.del.length) await this.copy.table(c.table).bulkDelete(c.del)
        }
      },
    )
    if (this.ingest) {
      applyExternalChanges(fresh)
      const rolls = fresh.find((c) => c.table === 'rolls')
      if (rolls) applyExternalRolls(rolls.put, rolls.del)
    }
  }

  /** An editor's own writes go to the host. */
  private outbound(changes: DbChange[]): void {
    if (this.welcome?.role !== 'editor' || this.closed) return
    const local = changes.filter(
      (c) => !c.remote && (SYNC_TABLES as readonly string[]).includes(c.table),
    ) as unknown as TableChanges[]
    if (!local.length) return
    const seq = ++this.seq
    for (const c of local)
      for (const id of [...c.put.map((r) => String(r.id)), ...c.del])
        this.pending.set(`${c.table}:${id}`, seq)
    this.send({
      type: 'write',
      seq,
      changes: local.map(({ table, put, del }) => ({ table, put, del })),
    })
  }

  private async finish(): Promise<void> {
    if (this.closed) return
    this.closed = true
    this.unsubscribe()
    this.rejectReady(new Error('Connection closed'))
    this.copy.close()
    wipe(this.key)
    this.key = null
    await Dexie.delete(this.copy.name)
    this.events.onClosed?.()
  }
}
