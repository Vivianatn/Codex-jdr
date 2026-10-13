import type { CodexDB } from '@/db/db'
import type { Asset, Campaign } from '@/db/types'
import type { ActivityRecord } from '@/domain/activity'
import { entityMapId, type GameMap } from '@/domain/maps'
import type { RollRecord } from '@/domain/rolls'
import type { SessionPlan, SessionRun } from '@/domain/sessions'
import { normalizePlayState } from '@/domain/turns'
import type { EnemyTemplate, Entity, LibraryItem, SkillDefinition } from '@/domain/types'
import { SYNC_TABLES, type SyncTable, type TableChanges } from './protocol'

/** Everything of one campaign that can be shared online. */
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

/** Players never see more than the last rolls. */
const PLAYER_ROLLS = 100

/**
 * What a player may see (D-245): the map where their character stands (D-256;
 * the map in play when they have no token anywhere) without hidden or GM-only
 * content, the party, the enemies whose token is visible (name, picture, HP
 * and conditions only), the public rolls and the pictures on screen. No
 * bestiary, item library, session plans or GM notes.
 */
export function projectForPlayer(
  data: CampaignData,
  characterIds: readonly string[] = [],
): CampaignData {
  const campaign = data.campaigns[0]
  if (!campaign) return emptyCampaignData()
  const inPlay = normalizePlayState(campaign.play)
  // Only visible tokens count: a hidden character must not reveal where it is.
  const shown = data.maps.map((m) => ({ ...m, tokens: m.tokens.filter((t) => !t.hidden) }))
  const own = characterIds
    .map((id) => entityMapId(shown, id, inPlay.mapId))
    .find((id): id is string => id !== null)
  const play = { ...inPlay, mapId: own ?? inPlay.mapId }
  const source = data.maps.find((m) => m.id === play.mapId)
  const map: GameMap | null = source
    ? {
        ...source,
        elements: source.elements
          .filter((e) => e.layer !== 'gm' && !e.hidden)
          .map((e) =>
            e.chest && !e.chest.opened ? { ...e, chest: { ...e.chest, items: [] } } : e,
          ),
        tokens: source.tokens.filter((t) => !t.hidden),
        drawings: source.drawings.filter((d) => !d.gmOnly),
      }
    : null
  const visible = new Set(map?.tokens.map((t) => t.entityId) ?? [])

  const entities = data.entities.flatMap((e): Entity[] => {
    if (e.kind !== 'enemy') return [e]
    if (!visible.has(e.id)) return []
    return [
      {
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
      },
    ]
  })

  const shownAssets = new Set(
    [map?.background.assetId, play.display.imageAssetId].filter((a): a is string => Boolean(a)),
  )
  return {
    ...emptyCampaignData(),
    campaigns: [{ ...campaign, description: '', play }],
    entities,
    maps: map ? [map] : [],
    rolls: data.rolls.filter((r) => !r.secret).slice(-PLAYER_ROLLS),
    assets: data.assets.filter((a) => shownAssets.has(a.id)),
  }
}

/** Cheap identity of a record: pictures are compared by id and size, not content. */
function fingerprint(table: SyncTable, record: Record<string, unknown>): string {
  if (table === 'assets') {
    const a = record as unknown as Asset
    return `${a.name}:${a.data.length}`
  }
  return JSON.stringify(record)
}

/**
 * What one guest already has (D-245). `diff` returns only the records that
 * changed since the last call, and the ones that disappeared.
 */
export class Replica {
  private readonly sent = new Map<SyncTable, Map<string, string>>()

  diff(data: CampaignData): TableChanges[] {
    const out: TableChanges[] = []
    for (const table of SYNC_TABLES) {
      const before = this.sent.get(table) ?? new Map<string, string>()
      const after = new Map<string, string>()
      const put: Record<string, unknown>[] = []
      for (const record of data[table] as unknown as Record<string, unknown>[]) {
        const key = String(record.id)
        const print = fingerprint(table, record)
        after.set(key, print)
        if (before.get(key) !== print) put.push(record)
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
  }
}
