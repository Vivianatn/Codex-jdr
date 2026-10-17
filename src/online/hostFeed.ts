import type { CodexDB } from '@/db/db'
import type { DbChange } from '@/db/middleware'
import { useCampaignStore } from '@/stores/campaignStore'
import { useRollStore } from '@/stores/rollStore'
import { isSyncTable, SYNC_TABLES } from '@shared/sync'
import { applyChanges, loadCampaignData, type CampaignData } from './projection'

/**
 * What the players of an online game are projected from (D-270). The database
 * is read once; then committed writes are applied as they come (the change
 * feed, nothing read back or decrypted again), and while the operator has the
 * campaign open its in-memory stores come on top: a move, a hit or a roll
 * reaches the players without waiting for the auto-save.
 */
export class HostFeed {
  private base: CampaignData | null = null
  private view: CampaignData | null = null
  private readonly changes: DbChange[] = []
  private readonly stops: (() => void)[]
  private readonly memo = new Map<string, { from: readonly unknown[]; to: unknown }>()

  constructor(
    private readonly db: () => CodexDB,
    private readonly campaignId: string,
    /** Something players may see changed: sync soon. */
    onChange: () => void,
  ) {
    const mine = (s: { campaignId: string | null }) => s.campaignId === campaignId
    this.stops = [
      db().onChanges((changes) => {
        let relevant = false
        for (const c of changes)
          if (isSyncTable(c.table)) {
            this.changes.push(c)
            relevant = true
          }
        if (relevant) onChange()
      }),
      useCampaignStore.subscribe((s, p) => {
        if (
          (mine(s) || mine(p)) &&
          (s.status !== p.status ||
            s.entities !== p.entities ||
            s.skills !== p.skills ||
            s.maps !== p.maps ||
            s.play !== p.play)
        )
          onChange()
      }),
      useRollStore.subscribe((s, p) => {
        if ((mine(s) || mine(p)) && s.rolls !== p.rolls) onChange()
      }),
    ]
  }

  stop(): void {
    this.stops.forEach((stop) => stop())
  }

  /** The campaign as it is now; the same object as last time when nothing changed. */
  async current(): Promise<CampaignData> {
    if (!this.base) {
      // Writes committed during the read are applied again after it: harmless.
      this.changes.length = 0
      this.base = await loadCampaignData(this.db(), this.campaignId)
    }
    if (this.changes.length)
      this.base = applyChanges(this.base, this.campaignId, this.changes.splice(0))
    const next = this.overlay(this.base)
    if (!this.view || SYNC_TABLES.some((t) => this.view![t] !== next[t])) this.view = next
    return this.view
  }

  /** The operator's open campaign is the truth (D-008): its auto-save lags behind. */
  private overlay(base: CampaignData): CampaignData {
    const s = useCampaignStore.getState()
    const r = useRollStore.getState()
    const next = { ...base }
    if (s.campaignId === this.campaignId && s.status === 'ready') {
      next.entities = this.cached('entities', [s.entities], () => Object.values(s.entities))
      next.skills = this.cached('skills', [s.skills], () => Object.values(s.skills))
      next.maps = this.cached('maps', [s.maps], () => Object.values(s.maps))
      const record = base.campaigns[0]
      if (record && record.play !== s.play)
        next.campaigns = this.cached('campaigns', [record, s.play], () => [
          { ...record, play: s.play },
        ])
    }
    // Rolls are written at once, but a few milliseconds still count: the dice show on every screen.
    // Merged rather than replaced: the roll store starts empty while it loads.
    if (r.campaignId === this.campaignId)
      next.rolls = this.cached('rolls', [base.rolls, r.rolls], () => {
        const known = new Set(base.rolls.map((roll) => roll.id))
        const fresh = r.rolls.filter((roll) => !known.has(roll.id))
        return fresh.length ? [...base.rolls, ...fresh] : base.rolls
      })
    return next
  }

  private cached<T>(key: string, from: readonly unknown[], make: () => T): T {
    const hit = this.memo.get(key)
    if (hit && hit.from.length === from.length && hit.from.every((v, i) => v === from[i]))
      return hit.to as T
    const to = make()
    this.memo.set(key, { from, to })
    return to
  }
}
