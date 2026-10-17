import type { CodexDB } from '@/db/db'
import { markRemote, type DbChange } from '@/db/middleware'
import type { Campaign, OutboxEntry, SyncState } from '@/db/types'
import { HOST_ID, type Participant } from '@/domain/turns'
import { applyExternalChanges } from '@/stores/campaignStore'
import { applyExternalRolls } from '@/stores/rollStore'
import {
  isSafeImageDataUrl,
  isSyncTable,
  MAX_RECORDS,
  SYNC_TABLES,
  type CampaignSummary,
  type SyncTable,
  type TableChanges,
} from '@shared/sync'
import { ApiError } from './api'

/**
 * Keeps the online campaigns of this device in step with the server (D-262).
 *
 * The device works on its own (encrypted) copy, connected or not. Every local
 * write to an online campaign lands in the outbox, one entry per record (a
 * newer write replaces an older one), and is pushed when the server can be
 * reached. Then the device pulls what the others changed since its last
 * revision. A record with a change still in the outbox is never overwritten by
 * a pull: the device's own edit wins until the server has taken it.
 */

export interface SyncApi {
  pull(
    campaignId: string,
    since: number,
  ): Promise<{ changes: TableChanges[]; rev: number; more: boolean }>
  push(
    campaignId: string,
    changes: TableChanges[],
  ): Promise<{
    rev: number
    corrected: TableChanges[]
    refused: { table: string; id: string; reason: string }[]
    current: TableChanges[]
  }>
  /** This account's campaigns. */
  campaigns(): Promise<CampaignSummary[]>
  putCampaign(campaignId: string, name: string): Promise<unknown>
  deleteCampaign(campaignId: string): Promise<unknown>
  leaveCampaign(campaignId: string): Promise<unknown>
}

export interface SyncOptions {
  db: () => CodexDB
  api: SyncApi
  /** Who acts from this device online (the account). */
  self: () => Participant
  /** Some changes were refused by the server and put back as it has them. */
  onRefused?: (reason: string, count: number) => void
  /** The server's list of this account's campaigns, as read by `reconcile`. */
  onCampaigns?: (campaigns: CampaignSummary[]) => void
  /** How many local changes wait for the server. */
  onPending?: (count: number) => void
  /** The campaigns following the server changed. */
  onSynced?: (campaignIds: string[]) => void
  /** The server cannot be reached (a network error stopped the work). */
  onOffline?: () => void
  /** Brings received changes into the open campaign's stores (off in tests). */
  ingest?: boolean
}

/** Largest push: records, and bytes (pictures). */
const BATCH_RECORDS = Math.min(2000, MAX_RECORDS)
const BATCH_BYTES = 16 * 1024 * 1024

const keyOf = (table: string, id: string) => `${table}:${id}`

function sizeOf(entry: OutboxEntry): number {
  const data = entry.record?.data
  return typeof data === 'string' ? data.length : 1000
}

function toChanges(entries: OutboxEntry[]): TableChanges[] {
  const byTable = new Map<SyncTable, TableChanges>()
  for (const e of entries) {
    if (!isSyncTable(e.table)) continue
    const change = byTable.get(e.table) ?? { table: e.table, put: [], del: [] }
    byTable.set(e.table, change)
    if (e.record) change.put.push(e.record)
    else change.del.push(e.recordId)
  }
  return [...byTable.values()]
}

export class SyncEngine {
  private readonly states = new Map<string, SyncState>()
  /** key → version of the outbox entry not yet accepted (also covers writes not yet stored). */
  private readonly pending = new Map<string, string>()
  private unsubscribe: (() => void) | null = null
  private queue: Promise<void> = Promise.resolve()
  private pushing = false
  /** Campaigns with a pull waiting in the queue. */
  private readonly pulls = new Set<string>()
  private online = false
  private stopped = false
  private readonly db: () => CodexDB

  constructor(private readonly options: SyncOptions) {
    this.db = options.db
  }

  async start(): Promise<void> {
    for (const state of await this.db().syncState.toArray()) this.states.set(state.id, state)
    for (const entry of await this.db().outbox.toArray()) this.pending.set(entry.id, entry.version)
    this.unsubscribe = this.db().onChanges((changes) => this.capture(changes))
    this.reportPending()
    this.reportSynced()
  }

  stop(): void {
    this.stopped = true
    this.unsubscribe?.()
    this.unsubscribe = null
  }

  /** True when this campaign follows the server. */
  isSynced(campaignId: string): boolean {
    const state = this.states.get(campaignId)
    return Boolean(state && !state.detached && !state.leaving)
  }

  /** The server can (or cannot) be reached: work resumes, or waits. */
  setOnline(online: boolean): void {
    this.online = online
    if (online) this.pushSoon()
  }

  /** Waits for the work in progress (tests, before locking). */
  flush(): Promise<void> {
    return this.queue
  }

  /**
   * Follows the server's list of campaigns: downloads the new ones, drops the
   * copies this account lost access to, and puts this device's other campaigns
   * online (D-257: the local campaigns are taken over by the online account).
   */
  reconcile(): Promise<void> {
    return this.enqueue(async () => {
      // Asked here, in turn: an upload queued before must be in the list.
      const campaigns = await this.options.api.campaigns()
      this.options.onCampaigns?.(campaigns)
      const editable = new Map(
        campaigns
          .filter((c) => c.role !== 'player')
          .map((c) => [c.id, c.role as 'owner' | 'editor']),
      )
      for (const [id, state] of [...this.states]) {
        if (state.leaving) {
          await this.leave(id, state)
          continue
        }
        const role = editable.get(id)
        if (!role) {
          if (!state.detached) await this.lost(id, state)
        } else if (role !== state.role || state.detached) {
          await this.save({ ...state, role, detached: false })
        }
      }
      for (const [id, role] of editable)
        if (!this.states.has(id)) await this.save({ id, rev: 0, role })
      for (const campaign of await this.db().campaigns.toArray())
        if (!this.states.has(campaign.id)) await this.uploadNow(campaign)
      await this.pushNow()
      for (const [id, state] of this.states) if (this.isSynced(id)) await this.pullNow(id, state)
    })
  }

  /** Puts one campaign online (also a detached one, on the GM's request). */
  upload(campaignId: string): Promise<void> {
    return this.enqueue(async () => {
      const campaign = await this.db().campaigns.get(campaignId)
      if (!campaign) return
      this.states.delete(campaignId)
      await this.uploadNow(campaign)
      await this.pushNow()
    })
  }

  /**
   * Someone changed this campaign (up to revision `rev`): fetch it. Notices
   * arriving while a pull waits are covered by it; one already read is skipped (D-270).
   */
  pullSoon(campaignId: string, rev?: number): void {
    if (this.pulls.has(campaignId)) return
    this.pulls.add(campaignId)
    void this.enqueue(async () => {
      this.pulls.delete(campaignId)
      const state = this.states.get(campaignId)
      if (rev !== undefined && state && state.rev >= rev) return
      if (state && this.isSynced(campaignId)) await this.pullNow(campaignId, state)
    })
  }

  pushSoon(): void {
    if (this.pushing) return
    this.pushing = true
    void this.enqueue(async () => {
      this.pushing = false
      await this.pushNow()
    })
  }

  // ---- local writes -----------------------------------------------------------------

  private capture(changes: DbChange[]): void {
    if (this.stopped) return
    const local = changes.filter((c) => !c.remote && isSyncTable(c.table))
    if (!local.length) return
    // A campaign deleted on this device: the server is told, its records are not sent one by one.
    const deleted = new Set(local.filter((c) => c.table === 'campaigns').flatMap((c) => c.del))
    const entries: OutboxEntry[] = []
    const add = (
      table: string,
      id: string,
      campaignId: unknown,
      record: Record<string, unknown> | null,
    ) => {
      if (typeof campaignId !== 'string' || deleted.has(campaignId) || !this.isSynced(campaignId))
        return
      const version = crypto.randomUUID()
      const key = keyOf(table, id)
      this.pending.set(key, version)
      entries.push({ id: key, campaignId, table, recordId: id, record, version })
    }
    let unknown = false
    for (const c of local) {
      for (const record of c.put) {
        const campaignId = c.table === 'campaigns' ? record.id : record.campaignId
        if (typeof campaignId === 'string' && !this.states.has(campaignId)) unknown = true
        add(c.table, String(record.id), campaignId, record)
      }
      if (c.table !== 'campaigns')
        c.del.forEach((id, i) => add(c.table, id, c.delCampaigns?.[i], null))
    }
    for (const id of deleted) {
      const state = this.states.get(id)
      if (state && !state.detached) void this.enqueue(() => this.leave(id, state, true))
    }
    if (entries.length)
      void this.db()
        .outbox.bulkPut(entries)
        .then(() => {
          this.reportPending()
          this.pushSoon()
        })
        .catch((error) => console.warn('Outbox not written', error))
    // A new campaign (created, imported, copied) goes online too.
    if (unknown)
      void this.enqueue(async () => {
        for (const campaign of await this.db().campaigns.toArray())
          if (!this.states.has(campaign.id)) await this.uploadNow(campaign)
        await this.pushNow()
      })
  }

  // ---- work with the server ---------------------------------------------------------

  private enqueue(task: () => Promise<void>): Promise<void> {
    const run = this.queue.then(async () => {
      if (this.stopped) return
      try {
        await task()
      } catch (error) {
        if (error instanceof ApiError && error.code === 'offline') {
          this.online = false
          this.options.onOffline?.()
        } else console.warn('Sync', error)
      }
    })
    this.queue = run
    return run
  }

  private async save(state: SyncState): Promise<void> {
    this.states.set(state.id, state)
    this.reportSynced()
    await this.db().syncState.put(state)
  }

  private async forget(campaignId: string): Promise<void> {
    this.states.delete(campaignId)
    this.reportSynced()
    await this.db().syncState.delete(campaignId)
    const keys = (await this.db()
      .outbox.where('campaignId')
      .equals(campaignId)
      .primaryKeys()) as string[]
    await this.db().outbox.bulkDelete(keys)
    keys.forEach((k) => this.pending.delete(k))
    this.reportPending()
  }

  /** Deleted (owner) or left (co-GM) here: tell the server, or retry later. */
  private async leave(campaignId: string, state: SyncState, first = false): Promise<void> {
    if (first) await this.save({ ...state, leaving: true })
    if (!this.online) return
    try {
      if (state.role === 'owner') await this.options.api.deleteCampaign(campaignId)
      else await this.options.api.leaveCampaign(campaignId)
    } catch (error) {
      if (!(error instanceof ApiError) || error.code === 'offline') throw error
      // Already gone on the server.
    }
    await this.forget(campaignId)
  }

  /** The server no longer lists this campaign for this account. */
  private async lost(campaignId: string, state: SyncState): Promise<void> {
    if (state.role === 'owner') {
      // Deleted from another device, or the server lost it: the GM's copy stays here, off line.
      await this.forget(campaignId)
      await this.save({ id: campaignId, rev: 0, role: 'owner', detached: true })
      return
    }
    // A co-GM's copy of someone else's campaign goes with the access to it.
    await this.forget(campaignId)
    const db = this.db()
    const tables = SYNC_TABLES.map((t) => db.table(t))
    await db.transaction('rw', tables, async (tx) => {
      markRemote(tx.idbtrans)
      await db.campaigns.delete(campaignId)
      for (const table of SYNC_TABLES)
        if (table !== 'campaigns')
          await db.table(table).where('campaignId').equals(campaignId).delete()
    })
  }

  /** Sends a local campaign to the server, whole. */
  private async uploadNow(campaign: Campaign): Promise<void> {
    if (!this.online) return
    try {
      await this.options.api.putCampaign(campaign.id, campaign.name)
    } catch (error) {
      if (error instanceof ApiError && error.code === 'conflict') {
        // The id belongs to someone else's campaign (an imported copy): it stays on this device.
        await this.save({ id: campaign.id, rev: 0, role: 'owner', detached: true })
        this.options.onRefused?.('conflict', 1)
        return
      }
      throw error
    }
    // Followed from now on: writes made while it uploads are captured (and newer than what is read here).
    await this.save({ id: campaign.id, rev: 0, role: 'owner' })
    const db = this.db()
    const self = this.options.self()
    const asSelf = (p: unknown) =>
      (p as Participant | undefined)?.id === HOST_ID ||
      (p as Participant | undefined)?.id === self.id
    // Before going online, the GM of this device becomes the account (running game, activity log).
    const rewritten: TableChanges[] = []
    const play = campaign.play as { live?: { operator?: Participant } | null } | undefined
    if (play?.live?.operator && asSelf(play.live.operator)) {
      const record = { ...campaign, play: { ...play, live: { ...play.live, operator: self } } }
      rewritten.push({
        table: 'campaigns',
        put: [record as unknown as Record<string, unknown>],
        del: [],
      })
    }
    const entries: OutboxEntry[] = []
    const lines: Record<string, unknown>[] = []
    for (const table of SYNC_TABLES) {
      const rows = (
        table === 'campaigns'
          ? [rewritten[0]?.put[0] ?? campaign]
          : await db.table(table).where('campaignId').equals(campaign.id).toArray()
      ) as Record<string, unknown>[]
      for (let record of rows) {
        if (table === 'activity') {
          // Only this GM's own lines: the others were signed by peers the server does not know.
          if (!asSelf(record.author)) continue
          record = { ...record, author: self }
          lines.push(record)
        }
        const id = String(record.id)
        if (this.pending.has(keyOf(table, id))) continue
        entries.push({
          id: keyOf(table, id),
          campaignId: campaign.id,
          table,
          recordId: id,
          record,
          version: crypto.randomUUID(),
        })
      }
    }
    if (lines.length) rewritten.push({ table: 'activity', put: lines, del: [] })
    if (rewritten.length) await this.applyRemote(campaign.id, rewritten, true)
    for (const e of entries) this.pending.set(e.id, e.version)
    await db.outbox.bulkPut(entries)
    this.reportPending()
  }

  private async pushNow(): Promise<void> {
    while (this.online && !this.stopped) {
      const db = this.db()
      const first = await db.outbox.toCollection().first()
      if (!first) return
      const campaignId = first.campaignId
      const all = await db.outbox.where('campaignId').equals(campaignId).toArray()
      if (!this.isSynced(campaignId)) {
        await db.outbox.bulkDelete(all.map((e) => e.id))
        all.forEach((e) => this.pending.delete(e.id))
        continue
      }
      const batch: OutboxEntry[] = []
      let bytes = 0
      for (const entry of all) {
        if (batch.length && (batch.length >= BATCH_RECORDS || bytes + sizeOf(entry) > BATCH_BYTES))
          break
        batch.push(entry)
        bytes += sizeOf(entry)
      }
      let result: Awaited<ReturnType<SyncApi['push']>>
      try {
        result = await this.options.api.push(campaignId, toChanges(batch))
      } catch (error) {
        if (
          error instanceof ApiError &&
          (error.code === 'notFound' || error.code === 'forbidden')
        ) {
          // No longer allowed to edit this campaign: the next reconcile sorts it out.
          await db.outbox.bulkDelete(all.map((e) => e.id))
          all.forEach((e) => this.pending.delete(e.id))
          continue
        }
        if (error instanceof ApiError && error.code === 'tooLarge') {
          await this.confirm([batch[0]!])
          this.options.onRefused?.('tooLarge', 1)
          continue
        }
        throw error
      }
      await this.confirm(batch)
      await this.applyRemote(campaignId, [...result.corrected, ...result.current])
      if (result.refused.length)
        this.options.onRefused?.(result.refused[0]!.reason, result.refused.length)
    }
  }

  /** The server took these entries: they leave the outbox, unless rewritten meanwhile. */
  private async confirm(entries: OutboxEntry[]): Promise<void> {
    const db = this.db()
    await db.transaction('rw', db.outbox, async () => {
      for (const e of entries) {
        const current = await db.outbox.get(e.id)
        if (current?.version === e.version) await db.outbox.delete(e.id)
      }
    })
    for (const e of entries) if (this.pending.get(e.id) === e.version) this.pending.delete(e.id)
    this.reportPending()
  }

  private async pullNow(campaignId: string, state: SyncState): Promise<void> {
    let rev = state.rev
    for (;;) {
      const page = await this.options.api.pull(campaignId, rev)
      if (this.stopped || !this.isSynced(campaignId)) return
      await this.applyRemote(campaignId, page.changes)
      rev = page.rev
      await this.save({ ...(this.states.get(campaignId) ?? state), rev })
      if (!page.more) return
    }
  }

  /** Writes the server's records into the copy (not echoed back), skipping pending local edits. */
  private async applyRemote(
    campaignId: string,
    changes: TableChanges[],
    force = false,
  ): Promise<void> {
    const fresh = changes
      .filter((c) => isSyncTable(c.table))
      .map((c) => ({
        table: c.table,
        put: c.put.filter(
          (r) =>
            (force || !this.pending.has(keyOf(c.table, String(r.id)))) &&
            (c.table === 'campaigns' ? r.id === campaignId : r.campaignId === campaignId) &&
            (c.table !== 'assets' || isSafeImageDataUrl(r.data)),
        ),
        del: c.del.filter((id) => force || !this.pending.has(keyOf(c.table, id))),
      }))
      .filter((c) => c.put.length || c.del.length)
    if (!fresh.length) return
    const db = this.db()
    await db.transaction(
      'rw',
      fresh.map((c) => db.table(c.table)),
      async (tx) => {
        markRemote(tx.idbtrans)
        for (const c of fresh) {
          if (c.put.length) await db.table(c.table).bulkPut(c.put)
          if (c.del.length) await db.table(c.table).bulkDelete(c.del)
        }
      },
    )
    if (this.options.ingest !== false) {
      applyExternalChanges(fresh)
      const rolls = fresh.find((c) => c.table === 'rolls')
      if (rolls) applyExternalRolls(rolls.put, rolls.del)
    }
  }

  private reportSynced(): void {
    this.options.onSynced?.([...this.states.keys()].filter((id) => this.isSynced(id)))
  }

  private reportPending(): void {
    this.options.onPending?.(this.pending.size)
  }
}
