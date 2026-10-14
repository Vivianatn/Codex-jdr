/**
 * Shared by the app and the server (D-262): what a campaign is made of online
 * and how a batch of changes is checked. No imports, no TypeScript-only syntax:
 * the server runs this file as is.
 */

/** Tables of a campaign kept on the server (backups stay on each device). */
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
  'activity',
] as const
export type SyncTable = (typeof SYNC_TABLES)[number]

export interface TableChanges {
  table: SyncTable
  put: Record<string, unknown>[]
  del: string[]
}

/** Only the operator of a running game may change these (D-244). */
export const OPERATOR_TABLES: readonly SyncTable[] = ['entities', 'maps', 'rolls', 'skills']

/** Owner and co-GMs prepare the campaign; players act through their character. */
export type MemberRole = 'owner' | 'editor' | 'player'

/** Writes larger than this are refused (a whole campaign is far smaller). */
export const MAX_RECORDS = 5000

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export const isSyncTable = (v: unknown): v is SyncTable =>
  (SYNC_TABLES as readonly unknown[]).includes(v)

/** Ids are uuids or short slugs: anything else is not one of ours. */
export const isId = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= 100

/** Validates a batch of changes; null = refuse it (never trust a peer). */
export function parseChanges(value: unknown, max = MAX_RECORDS): TableChanges[] | null {
  if (!Array.isArray(value)) return null
  let total = 0
  const out: TableChanges[] = []
  for (const c of value) {
    if (!isRecord(c) || !isSyncTable(c.table) || !Array.isArray(c.put) || !Array.isArray(c.del))
      return null
    if (!c.put.every((r) => isRecord(r) && isId(r.id)) || !c.del.every(isId)) return null
    total += c.put.length + c.del.length
    if (total > max) return null
    out.push({ table: c.table, put: c.put as Record<string, unknown>[], del: c.del as string[] })
  }
  return out
}

// Raster formats only: an SVG can carry scripts and external references (D-243).
const SAFE_IMAGE = /^data:image\/(?:png|jpeg|webp|gif|avif);base64,[A-Za-z0-9+/]*={0,2}$/

export function isSafeImageDataUrl(value: unknown): value is string {
  return typeof value === 'string' && SAFE_IMAGE.test(value)
}

/** Longest activity label (D-247). */
export const ACTIVITY_LABEL_MAX = 200

/** True when `value` is a well-formed activity line of `campaignId` signed by `author` (D-247). */
export function isValidActivity(
  value: Record<string, unknown>,
  campaignId: string,
  author: { id: string; name: string },
): boolean {
  const a = value.author as Record<string, unknown> | null | undefined
  return (
    value.campaignId === campaignId &&
    typeof value.at === 'number' &&
    Number.isFinite(value.at) &&
    (value.kind === 'do' || value.kind === 'undo' || value.kind === 'redo') &&
    typeof value.label === 'string' &&
    value.label.length <= ACTIVITY_LABEL_MAX &&
    typeof value.count === 'number' &&
    Number.isInteger(value.count) &&
    value.count >= 1 &&
    typeof a === 'object' &&
    a !== null &&
    a.id === author.id &&
    a.name === author.name
  )
}

/** The running game of a campaign record, as far as the server cares (D-244). */
export interface LiveInfo {
  operatorId: string
  operatorName: string
  mode: 'local' | 'online'
  startedAt: number
  /** Title of the session being played. */
  title: string
  /** The GM shows the game in the catalogue of open sessions. */
  listed: boolean
}

export function liveOf(campaign: Record<string, unknown> | undefined): LiveInfo | null {
  const play = campaign?.play
  if (!isRecord(play) || !isRecord(play.live)) return null
  const { operator, mode, startedAt, title, listed } = play.live
  if (!isRecord(operator) || !isId(operator.id) || typeof operator.name !== 'string') return null
  return {
    operatorId: operator.id,
    operatorName: operator.name,
    mode: mode === 'online' ? 'online' : 'local',
    startedAt: typeof startedAt === 'number' ? startedAt : 0,
    title: typeof title === 'string' ? title.slice(0, 200) : '',
    listed: listed === true,
  }
}

/** Activity lines kept per campaign (D-247). */
export const ACTIVITY_LIMIT = 300

// ---- live-game relay (D-262) -----------------------------------------------------

/**
 * WebSocket messages between a device and the server. The live game itself
 * (the host/guest protocol of src/online/protocol.ts) travels inside `up` and
 * `down` frames: the server only relays it between the players and the
 * operator's device.
 */
export type ClientFrame =
  /** Operator: this device serves the players of its running online game. */
  | { t: 'serve'; campaignId: string }
  | { t: 'unserve'; campaignId: string }
  /** Player: enter the running game of a campaign. */
  | { t: 'enter'; campaignId: string }
  | { t: 'leave' }
  /** Player → operator. */
  | { t: 'up'; data: unknown }
  /** Operator → one player. */
  | { t: 'down'; campaignId: string; peerId: string; data: unknown }
  /** Operator: disconnect one player. */
  | { t: 'kick'; campaignId: string; peerId: string }
  | { t: 'ping' }

export interface PresenceUser {
  id: string
  name: string
  role: MemberRole
}

export type ServerFrame =
  | { t: 'hello'; userId: string }
  /** Records of this campaign changed up to `rev`: pull them. */
  | { t: 'changed'; campaignId: string; rev: number }
  /** Memberships, requests or running games changed: refresh the campaign list. */
  | { t: 'campaigns' }
  /** The catalogue of open sessions changed: read it again. */
  | { t: 'sessions' }
  /** Members of a campaign connected right now. */
  | { t: 'presence'; campaignId: string; users: PresenceUser[] }
  | { t: 'serving'; campaignId: string; ok: boolean }
  /** Operator: a player entered (peerId = their user id). */
  | {
      t: 'peer'
      campaignId: string
      peerId: string
      name: string
      characterId: string | null
    }
  | { t: 'peerGone'; campaignId: string; peerId: string }
  /** Player → operator frame, delivered to the operator. */
  | { t: 'up'; campaignId: string; peerId: string; data: unknown }
  /** Player: entered, or why not. */
  | { t: 'entered'; campaignId: string }
  | { t: 'enterFailed'; campaignId: string; reason: 'notLive' | 'forbidden' }
  /** Operator → player frame, delivered to the player. */
  | { t: 'down'; data: unknown }
  /** Player: the game's host left (end of game, handover, connection lost). */
  | { t: 'hostGone' }
  | { t: 'pong' }

export function parseClientFrame(value: unknown): ClientFrame | null {
  if (!isRecord(value)) return null
  switch (value.t) {
    case 'serve':
    case 'unserve':
    case 'enter':
      return isId(value.campaignId) ? { t: value.t, campaignId: value.campaignId } : null
    case 'leave':
      return { t: 'leave' }
    case 'up':
      return { t: 'up', data: value.data }
    case 'down':
      return isId(value.campaignId) && isId(value.peerId)
        ? { t: 'down', campaignId: value.campaignId, peerId: value.peerId, data: value.data }
        : null
    case 'kick':
      return isId(value.campaignId) && isId(value.peerId)
        ? { t: 'kick', campaignId: value.campaignId, peerId: value.peerId }
        : null
    case 'ping':
      return { t: 'ping' }
    default:
      return null
  }
}

const SERVER_FRAMES = new Set([
  'hello',
  'changed',
  'campaigns',
  'sessions',
  'presence',
  'serving',
  'peer',
  'peerGone',
  'up',
  'entered',
  'enterFailed',
  'down',
  'hostGone',
  'pong',
])

/** The app trusts its own server, but only frames it knows. */
export function parseServerFrame(value: unknown): ServerFrame | null {
  return isRecord(value) && typeof value.t === 'string' && SERVER_FRAMES.has(value.t)
    ? (value as unknown as ServerFrame)
    : null
}

// ---- REST payloads ----------------------------------------------------------------

export interface PublicUser {
  id: string
  email: string
  displayName: string
}

export interface CampaignSummary {
  id: string
  name: string
  role: MemberRole
  ownerName: string
  characterId: string | null
  live: LiveInfo | null
  /** Join requests waiting (owner and co-GMs only). */
  pendingRequests: number
}

export interface MemberInfo {
  userId: string
  displayName: string
  role: MemberRole
  characterId: string | null
}

export interface JoinRequestInfo {
  id: string
  userId: string
  displayName: string
  message: string
  createdAt: number
}

export interface InvitePreview {
  campaignId: string
  campaignName: string
  ownerName: string
  /** The viewer already belongs to the campaign, or already asked. */
  status: 'none' | 'member' | 'requested'
}

/** An online game its GM shows in the catalogue: players ask to join it in one click. */
export interface OpenSession {
  campaignId: string
  campaignName: string
  ownerName: string
  title: string
  operatorName: string
  startedAt: number
  /** The viewer already plays in the campaign, or already asked. */
  status: 'none' | 'member' | 'requested'
}

/** Error codes of the API (the app turns them into French messages). */
export type ApiErrorCode =
  | 'invalid'
  | 'unauthenticated'
  | 'forbidden'
  | 'notFound'
  | 'emailTaken'
  | 'wrongCredentials'
  | 'throttled'
  | 'weakPassword'
  | 'tokenExpired'
  | 'mailUnavailable'
  | 'notOperator'
  | 'conflict'
  | 'tooLarge'
  | 'server'
