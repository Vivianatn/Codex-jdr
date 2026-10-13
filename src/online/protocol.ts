import type { RollMode } from '@/domain/checks'
import type { StatKey } from '@/domain/types'
import { STAT_KEYS } from '@/domain/types'
import type { GuestRole, PeerInfo } from './onlineStore'
import { isRecord } from '@/lib/guards'
import { isSyncTable, parseChanges, type TableChanges } from '@shared/sync'

/**
 * Messages of a live online game between the operator's device and each player
 * (D-245, D-262), relayed by the server. The operator owns the game: it sends
 * each player what they may see, players send intents it checks and performs.
 */

/** 3: through the server's relay, players only (co-GMs sync through the server). */
export const PROTOCOL_VERSION = 3

export { SYNC_TABLES, type SyncTable, type TableChanges } from '@shared/sync'

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
  | { type: 'choose'; characterId: string | null }
  | { type: 'intent'; seq: number; intent: Intent }

export type RejectReason =
  'forbidden' | 'notOperator' | 'notOnline' | 'notYours' | 'invalid' | 'blocked' | 'taken'

const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 100
const int = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v)

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
      const changes = parseChanges(v.changes)
      // The initial sync of a big campaign may exceed the write limit: check the shape only.
      const loose =
        Array.isArray(v.changes) &&
        v.changes.every(
          (c) =>
            isRecord(c) && isSyncTable(c.table) && Array.isArray(c.put) && Array.isArray(c.del),
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
