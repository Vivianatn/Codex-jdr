import type { RollMode } from '@/domain/checks'
import type { StatKey } from '@/domain/types'
import { STAT_KEYS } from '@/domain/types'
import type { GuestRole, PeerInfo } from './onlineStore'

/**
 * Messages between the host and its guests (D-245). The host owns the data:
 * it sends each guest what that guest may see, editors send their writes,
 * players send intents the host checks and performs.
 */

export const PROTOCOL_VERSION = 1

/** Tables shared online (backups stay on the host). */
export const SYNC_TABLES = [
  'campaigns',
  'entities',
  'skills',
  'maps',
  'rolls',
  'bestiary',
  'itemLibrary',
  'sessions',
  'sessionRuns',
  'assets',
] as const
export type SyncTable = (typeof SYNC_TABLES)[number]

export interface TableChanges {
  table: SyncTable
  put: Record<string, unknown>[]
  del: string[]
}

export type Intent =
  | { type: 'move'; mapId: string; tokenId: string; col: number; row: number }
  | { type: 'check'; entityId: string; stat: StatKey; mode: RollMode }
  | { type: 'roll'; entityId: string; expression: string }

export type HostMessage =
  | {
      type: 'welcome'
      protocol: number
      selfId: string
      role: GuestRole
      campaignId: string
      campaignName: string
      hostName: string
    }
  | { type: 'sync'; changes: TableChanges[]; initial: boolean }
  | { type: 'peers'; peers: PeerInfo[] }
  | { type: 'ack'; seq: number }
  | { type: 'rejected'; seq: number; reason: RejectReason }
  | { type: 'bye' }

export type GuestMessage =
  | { type: 'hello'; protocol: number; name: string }
  | { type: 'write'; seq: number; changes: TableChanges[] }
  | { type: 'choose'; characterId: string | null }
  | { type: 'intent'; seq: number; intent: Intent }

export type RejectReason =
  'forbidden' | 'notOperator' | 'notOnline' | 'notYours' | 'invalid' | 'blocked' | 'taken'

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const isTable = (v: unknown): v is SyncTable => (SYNC_TABLES as readonly unknown[]).includes(v)
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 100
const int = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v)

/** Writes larger than this are refused (a whole campaign is far smaller). */
const MAX_RECORDS = 5000

function changesOf(v: unknown): TableChanges[] | null {
  if (!Array.isArray(v)) return null
  let total = 0
  const out: TableChanges[] = []
  for (const c of v) {
    if (!isRecord(c) || !isTable(c.table) || !Array.isArray(c.put) || !Array.isArray(c.del))
      return null
    if (!c.put.every(isRecord) || !c.del.every(id)) return null
    total += c.put.length + c.del.length
    if (total > MAX_RECORDS) return null
    out.push({ table: c.table, put: c.put as Record<string, unknown>[], del: c.del as string[] })
  }
  return out
}

function intentOf(v: unknown): Intent | null {
  if (!isRecord(v)) return null
  if (v.type === 'move' && id(v.mapId) && id(v.tokenId) && int(v.col) && int(v.row))
    return { type: 'move', mapId: v.mapId, tokenId: v.tokenId, col: v.col, row: v.row }
  if (
    v.type === 'check' &&
    id(v.entityId) &&
    (STAT_KEYS as readonly unknown[]).includes(v.stat) &&
    (v.mode === 'normal' || v.mode === 'advantage' || v.mode === 'disadvantage')
  )
    return { type: 'check', entityId: v.entityId, stat: v.stat as StatKey, mode: v.mode }
  if (
    v.type === 'roll' &&
    id(v.entityId) &&
    typeof v.expression === 'string' &&
    v.expression.length <= 60
  )
    return { type: 'roll', entityId: v.entityId, expression: v.expression }
  return null
}

/** Validates what a guest sent; null = ignore it (never trust a peer). */
export function parseGuestMessage(v: unknown): GuestMessage | null {
  if (!isRecord(v)) return null
  switch (v.type) {
    case 'hello':
      return int(v.protocol) && typeof v.name === 'string' && v.name.trim() && v.name.length <= 80
        ? { type: 'hello', protocol: v.protocol, name: v.name.trim() }
        : null
    case 'write': {
      const changes = changesOf(v.changes)
      return int(v.seq) && changes ? { type: 'write', seq: v.seq, changes } : null
    }
    case 'choose':
      return v.characterId === null || id(v.characterId)
        ? { type: 'choose', characterId: v.characterId }
        : null
    case 'intent': {
      const intent = intentOf(v.intent)
      return int(v.seq) && intent ? { type: 'intent', seq: v.seq, intent } : null
    }
    default:
      return null
  }
}

/** Validates what the host sent. */
export function parseHostMessage(v: unknown): HostMessage | null {
  if (!isRecord(v)) return null
  switch (v.type) {
    case 'welcome':
      return int(v.protocol) &&
        id(v.selfId) &&
        (v.role === 'editor' || v.role === 'player') &&
        id(v.campaignId) &&
        typeof v.campaignName === 'string' &&
        typeof v.hostName === 'string'
        ? (v as HostMessage)
        : null
    case 'sync': {
      const changes = Array.isArray(v.changes) ? changesOf(v.changes) : null
      // The initial sync of a big campaign may exceed the write limit: check the shape only.
      const loose =
        Array.isArray(v.changes) &&
        v.changes.every(
          (c) => isRecord(c) && isTable(c.table) && Array.isArray(c.put) && Array.isArray(c.del),
        )
      return changes || loose
        ? { type: 'sync', changes: v.changes as TableChanges[], initial: v.initial === true }
        : null
    }
    case 'peers':
      return Array.isArray(v.peers) ? { type: 'peers', peers: v.peers as PeerInfo[] } : null
    case 'ack':
      return int(v.seq) ? { type: 'ack', seq: v.seq } : null
    case 'rejected':
      return int(v.seq) && typeof v.reason === 'string' ? (v as HostMessage) : null
    case 'bye':
      return { type: 'bye' }
    default:
      return null
  }
}
