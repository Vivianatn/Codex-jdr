import type { CodexDB } from '@/db/db'
import type { Asset, Campaign } from '@/db/types'
import type { ActivityRecord } from '@/domain/activity'
import { entityMapId, type GameMap } from '@/domain/maps'
import type { RollRecord } from '@/domain/rolls'
import type { SessionPlan, SessionRun } from '@/domain/sessions'
import { normalizePlayState } from '@/domain/turns'
import type { EnemyTemplate, Entity, LibraryItem, SkillDefinition } from '@/domain/types'
import { isSyncTable } from '@shared/sync'
import { SYNC_TABLES, type SyncTable, type TableChanges } from './protocol'

/**
 * Everything of one campaign that can be shared online. Treated as immutable
 * (D-270): a change makes a new object, unchanged records keep their reference,
 * which is what lets the projections and the diffs below skip the work.
 */
export interface CampaignData {
  campaigns: Campaign[]
  entities: Entity[]
  skills: SkillDefinition[]
  maps: GameMap[]
  rolls: RollRecord[]
  bestiary: EnemyTemplate[]
  itemLibrary: LibraryItem[]
  sessions: SessionPlan[]
  sessionRuns: SessionRun[]
  assets: Asset[]
  /** Editors' activity log (D-247): editors only. */
  activity: ActivityRecord[]
}

export function emptyCampaignData(): CampaignData {
  return Object.fromEntries(SYNC_TABLES.map((t) => [t, []])) as unknown as CampaignData
}

/** Reads the given tables of a campaign; the others are taken from `previous`. */
export async function loadCampaignData(
  db: CodexDB,
  campaignId: string,
  tables: Iterable<SyncTable> = SYNC_TABLES,
  previous: CampaignData = emptyCampaignData(),
): Promise<CampaignData> {
  const next = { ...previous }
  for (const table of tables) {
    if (table === 'campaigns') {
      const campaign = await db.campaigns.get(campaignId)
      next.campaigns = campaign ? [campaign] : []
    } else {
      ;(next as Record<SyncTable, unknown[]>)[table] = await db
        .table(table)
        .where('campaignId')
        .equals(campaignId)
        .toArray()
    }
  }
  return next
}

/**
 * Brings committed writes (the database change feed, in clear) into `data`
 * without reading anything back (D-270): only the touched tables are rebuilt,
 * records of other campaigns are ignored. Returns `data` itself when nothing applies.
 */
export function applyChanges(
  data: CampaignData,
  campaignId: string,
  changes: readonly {
    table: string
    put: readonly Record<string, unknown>[]
    del: readonly string[]
  }[],
): CampaignData {
  const touched = new Map<SyncTable, Map<string, Record<string, unknown>>>()
  for (const change of changes) {
    const table = change.table
    if (!isSyncTable(table)) continue
    let rows = touched.get(table)
    if (!rows) {
      const current = data[table] as unknown as Record<string, unknown>[]
      rows = new Map(current.map((r) => [String(r.id), r]))
      touched.set(table, rows)
    }
    for (const record of change.put) {
      const own =
        table === 'campaigns' ? record.id === campaignId : record.campaignId === campaignId
      if (own) rows.set(String(record.id), record)
      else rows.delete(String(record.id))
    }
    for (const id of change.del) rows.delete(id)
  }
  if (!touched.size) return data
  const next = { ...data } as Record<SyncTable, unknown[]>
  for (const [table, rows] of touched) next[table] = [...rows.values()]
  return next as unknown as CampaignData
}

/** Players never see more than the last rolls. */
const PLAYER_ROLLS = 100

// Projections are memoised on the records they come from (D-270): the same
// record always gives the same projected object, so a diff recognises it at once.
type Enemy = Extract<Entity, { kind: 'enemy' }>
const maskedEnemies = new WeakMap<Enemy, Entity>()
const projectedMaps = new WeakMap<GameMap, GameMap>()
const projectedCampaigns = new WeakMap<Campaign, Map<string | null, Campaign>>()
const publicRolls = new WeakMap<RollRecord[], RollRecord[]>()
const views = new WeakMap<CampaignData, Map<string, CampaignData>>()

/** An enemy as players see it: name, picture, HP and conditions only. */
function maskEnemy(e: Enemy): Entity {
  let masked = maskedEnemies.get(e)
  if (!masked) {
    masked = {
      ...e,
      identity: {
        ...e.identity,
        discordName: '',
        className: '',
        weaponType: '',
        origin: '',
        description: '',
        mindset: '',
      },
      stats: Object.fromEntries(Object.keys(e.stats).map((k) => [k, 0])) as Entity['stats'],
      modifiers: [],
      skills: [],
      inventory: [],
      journal: [],
      purse: 0,
      details: { ...e.details, templateId: null, xpReward: 0, loot: '' },
    }
    maskedEnemies.set(e, masked)
  }
  return masked
}

/** A map without its hidden or GM-only content, and closed chests emptied. */
function projectMap(source: GameMap): GameMap {
  let map = projectedMaps.get(source)
  if (!map) {
    map = {
      ...source,
      elements: source.elements
        .filter((e) => e.layer !== 'gm' && !e.hidden)
        .map((e) => (e.chest && !e.chest.opened ? { ...e, chest: { ...e.chest, items: [] } } : e)),
      tokens: source.tokens.filter((t) => !t.hidden),
      drawings: source.drawings.filter((d) => !d.gmOnly),
    }
    projectedMaps.set(source, map)
  }
  return map
}

function projectCampaign(campaign: Campaign, ownMapId: string | null): Campaign {
  let byMap = projectedCampaigns.get(campaign)
  if (!byMap) {
    byMap = new Map()
    projectedCampaigns.set(campaign, byMap)
  }
  let projected = byMap.get(ownMapId)
  if (!projected) {
    const inPlay = normalizePlayState(campaign.play)
    projected = {
      ...campaign,
      description: '',
      play: { ...inPlay, mapId: ownMapId ?? inPlay.mapId },
    }
    byMap.set(ownMapId, projected)
  }
  return projected
}

function publicRollsOf(rolls: RollRecord[]): RollRecord[] {
  let shown = publicRolls.get(rolls)
  if (!shown) {
    shown = rolls
      .filter((r) => !r.secret)
      .toSorted((a, b) => a.at - b.at)
      .slice(-PLAYER_ROLLS)
    publicRolls.set(rolls, shown)
  }
  return shown
}

/**
 * What a player may see (D-245): the map where their character stands (D-256;
 * the map in play when they have no token anywhere) without hidden or GM-only
 * content, the party, the enemies whose token is visible (name, picture, HP
 * and conditions only), the last public rolls and the pictures on screen. No
 * bestiary, item library, session plans or GM notes. Several players with the
 * same characters share one result.
 */
export function projectForPlayer(
  data: CampaignData,
  characterIds: readonly string[] = [],
): CampaignData {
  let cache = views.get(data)
  if (!cache) {
    cache = new Map()
    views.set(data, cache)
  }
  const key = characterIds.join('\n')
  let view = cache.get(key)
  if (!view) {
    view = computeView(data, characterIds)
    cache.set(key, view)
  }
  return view
}

function computeView(data: CampaignData, characterIds: readonly string[]): CampaignData {
  const campaign = data.campaigns[0]
  if (!campaign) return emptyCampaignData()
  const inPlay = normalizePlayState(campaign.play)
  // Only visible tokens count: a hidden character must not reveal where it is.
  const shown = data.maps.map((m) => ({ ...m, tokens: m.tokens.filter((t) => !t.hidden) }))
  const own =
    characterIds
      .map((id) => entityMapId(shown, id, inPlay.mapId))
      .find((id): id is string => id !== null) ?? null
  const mapId = own ?? inPlay.mapId
  const source = data.maps.find((m) => m.id === mapId)
  const map = source ? projectMap(source) : null
  const visible = new Set(map?.tokens.map((t) => t.entityId) ?? [])

  const entities = data.entities.flatMap((e): Entity[] => {
    if (e.kind !== 'enemy') return [e]
    return visible.has(e.id) ? [maskEnemy(e)] : []
  })

  const shownAssets = new Set(
    [map?.background.assetId, inPlay.display.imageAssetId].filter((a): a is string => Boolean(a)),
  )
  return {
    ...emptyCampaignData(),
    campaigns: [projectCampaign(campaign, own)],
    entities,
    maps: map ? [map] : [],
    rolls: publicRollsOf(data.rolls),
    assets: data.assets.filter((a) => shownAssets.has(a.id)),
  }
}

/** Identities already computed, shared by every replica (records are never changed in place). */
const prints = new WeakMap<object, string>()

/** Cheap identity of a record: pictures are compared by id and size, not content. */
function fingerprint(table: SyncTable, record: Record<string, unknown>): string {
  let print = prints.get(record)
  if (print === undefined) {
    if (table === 'assets') {
      const a = record as unknown as Asset
      print = `${a.name}:${a.data.length}`
    } else print = JSON.stringify(record)
    prints.set(record, print)
  }
  return print
}

/**
 * What one guest already has (D-245). `diff` returns only the records that
 * changed since the last call, and the ones that disappeared. The same record
 * object as last time is skipped without looking inside (D-270).
 */
export class Replica {
  private readonly sent = new Map<SyncTable, Map<string, Record<string, unknown>>>()
  private readonly lists = new Map<SyncTable, readonly unknown[]>()

  diff(data: CampaignData): TableChanges[] {
    const out: TableChanges[] = []
    for (const table of SYNC_TABLES) {
      const list = data[table] as unknown as Record<string, unknown>[]
      if (this.lists.get(table) === list) continue
      this.lists.set(table, list)
      const before = this.sent.get(table) ?? new Map<string, Record<string, unknown>>()
      const after = new Map<string, Record<string, unknown>>()
      const put: Record<string, unknown>[] = []
      for (const record of list) {
        const key = String(record.id)
        const previous = before.get(key)
        after.set(key, record)
        if (previous === record) continue
        if (!previous || fingerprint(table, previous) !== fingerprint(table, record))
          put.push(record)
      }
      const del = [...before.keys()].filter((key) => !after.has(key))
      this.sent.set(table, after)
      if (put.length || del.length) out.push({ table, put, del })
    }
    return out
  }

  /** The next diff sends these records again (after a refused write or move). */
  forget(table: SyncTable, ids: Iterable<string>): void {
    const map = this.sent.get(table)
    for (const id of ids) map?.delete(id)
    this.lists.delete(table)
  }
}
