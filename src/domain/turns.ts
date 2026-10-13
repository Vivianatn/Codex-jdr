import type { PlayMode } from './sessions'

/**
 * Turns by groups (D-226), replacing the combat tracker of the original spec.
 *
 * The GM sorts characters into ordered groups. Groups play one after the
 * other, and inside the active group its characters play one after the
 * other. When every group has played comes the GM's turn: nothing moves
 * until the GM resumes, which starts the next round from the first group.
 */

export interface PlayGroup {
  id: string
  name: string
  /** Characters of the group, in playing order. */
  memberIds: string[]
}

export type TurnState =
  | { status: 'stopped' }
  | { status: 'playing'; round: number; groupId: string; memberId: string }
  | { status: 'gm'; round: number }

export interface PlayerDisplay {
  /** What the players' window shows (SPEC §5.3). */
  mode: 'map' | 'image' | 'pause'
  /** Mood picture shown full screen in "image" mode. */
  imageAssetId: string | null
  /**
   * Pictures shown one after the other (D-259, from a picture zone of the map);
   * `imageAssetId` is the one on screen. Empty for a single mood picture.
   */
  gallery: string[]
}

/** Someone taking part in the game: the host device ('host') or a peer (D-245). */
export interface Participant {
  id: string
  name: string
}

/** Participant id of the device that owns the campaign. */
export const HOST_ID = 'host'

/**
 * A game in progress (D-244). Play is started by hand by an editor; while it
 * runs, only the operator acts on the table — other editors watch.
 */
export interface LiveGame {
  runId: string
  planId: string | null
  mode: PlayMode
  startedAt: number
  operator: Participant
}

export interface PlayState {
  groups: PlayGroup[]
  turn: TurnState
  /** Map in play (D-228), or null. */
  mapId: string | null
  display: PlayerDisplay
  /** Game in progress, or null between sessions (the play screen then offers to start one). */
  live: LiveGame | null
}

export function emptyPlayState(): PlayState {
  return {
    groups: [],
    turn: { status: 'stopped' },
    mapId: null,
    display: { mode: 'map', imageAssetId: null, gallery: [] },
    live: null,
  }
}

function normalizeLive(raw: unknown): LiveGame | null {
  if (typeof raw !== 'object' || raw === null) return null
  const live = raw as Partial<LiveGame>
  const operator = live.operator
  if (
    typeof live.runId !== 'string' ||
    typeof operator?.id !== 'string' ||
    typeof operator.name !== 'string'
  )
    return null
  return {
    runId: live.runId,
    planId: typeof live.planId === 'string' ? live.planId : null,
    mode: live.mode === 'online' ? 'online' : 'local',
    startedAt: typeof live.startedAt === 'number' ? live.startedAt : 0,
    operator: { id: operator.id, name: operator.name },
  }
}

/** True when `participantId` may act on the table right now. */
export function isOperator(state: PlayState, participantId: string): boolean {
  return state.live?.operator.id === participantId
}

/** Fills missing fields of a saved play state (or none). */
export function normalizePlayState(raw: unknown): PlayState {
  if (typeof raw !== 'object' || raw === null) return emptyPlayState()
  const value = raw as Partial<PlayState>
  const groups = Array.isArray(value.groups)
    ? value.groups.filter(
        (g): g is PlayGroup =>
          typeof g?.id === 'string' && typeof g.name === 'string' && Array.isArray(g.memberIds),
      )
    : []
  const turn = value.turn && typeof value.turn === 'object' ? value.turn : { status: 'stopped' }
  const shown: PlayerDisplay =
    value.display && typeof value.display === 'object'
      ? { ...emptyPlayState().display, ...value.display }
      : emptyPlayState().display
  const display: PlayerDisplay = {
    ...shown,
    gallery: Array.isArray(shown.gallery)
      ? shown.gallery.filter((id): id is string => typeof id === 'string').slice(0, 50)
      : [],
  }
  return {
    groups,
    turn: turn as TurnState,
    mapId: typeof value.mapId === 'string' ? value.mapId : null,
    display,
    live: normalizeLive(value.live),
  }
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

export function addGroup(
  state: PlayState,
  name: string,
  id: string = crypto.randomUUID(),
): PlayState {
  return { ...state, groups: [...state.groups, { id, name, memberIds: [] }] }
}

export function renameGroup(state: PlayState, groupId: string, name: string): PlayState {
  return {
    ...state,
    groups: state.groups.map((g) => (g.id === groupId ? { ...g, name } : g)),
  }
}

export function removeGroup(state: PlayState, groupId: string): PlayState {
  const next = { ...state, groups: state.groups.filter((g) => g.id !== groupId) }
  // The group that was playing disappears: the turn moves on as if it had finished.
  if (state.turn.status === 'playing' && state.turn.groupId === groupId)
    return { ...next, turn: firstTurnFrom(next, indexOfGroup(state, groupId), state.turn.round) }
  return next
}

/** Moves a group up (-1) or down (+1) in the playing order. */
export function moveGroup(state: PlayState, groupId: string, delta: -1 | 1): PlayState {
  return { ...state, groups: move(state.groups, (g) => g.id === groupId, delta) }
}

/** Puts a character in a group (a character belongs to at most one group). */
export function addMember(state: PlayState, groupId: string, entityId: string): PlayState {
  return {
    ...state,
    groups: state.groups.map((g) =>
      g.id === groupId
        ? { ...g, memberIds: [...g.memberIds.filter((id) => id !== entityId), entityId] }
        : { ...g, memberIds: g.memberIds.filter((id) => id !== entityId) },
    ),
  }
}

export function removeMember(state: PlayState, entityId: string): PlayState {
  const next = {
    ...state,
    groups: state.groups.map((g) => ({
      ...g,
      memberIds: g.memberIds.filter((id) => id !== entityId),
    })),
  }
  // Removing the character who is playing hands the turn to the next one.
  if (state.turn.status === 'playing' && state.turn.memberId === entityId)
    return { ...next, turn: nextTurn(state).turn }
  return next
}

export function moveMember(state: PlayState, entityId: string, delta: -1 | 1): PlayState {
  return {
    ...state,
    groups: state.groups.map((g) =>
      g.memberIds.includes(entityId)
        ? { ...g, memberIds: move(g.memberIds, (id) => id === entityId, delta) }
        : g,
    ),
  }
}

/** Drops characters that no longer exist (deleted while grouped). */
export function pruneMembers(state: PlayState, existing: ReadonlySet<string>): PlayState {
  if (state.groups.every((g) => g.memberIds.every((id) => existing.has(id)))) return state
  return {
    ...state,
    groups: state.groups.map((g) => ({
      ...g,
      memberIds: g.memberIds.filter((id) => existing.has(id)),
    })),
  }
}

export function groupOf(state: PlayState, entityId: string): PlayGroup | undefined {
  return state.groups.find((g) => g.memberIds.includes(entityId))
}

// ---------------------------------------------------------------------------
// Turns
// ---------------------------------------------------------------------------

/** First character of the first non-empty group at or after `from`; the GM's turn if none. */
function firstTurnFrom(state: PlayState, from: number, round: number): TurnState {
  for (let i = Math.max(0, from); i < state.groups.length; i++) {
    const group = state.groups[i]!
    if (group.memberIds.length)
      return { status: 'playing', round, groupId: group.id, memberId: group.memberIds[0]! }
  }
  return { status: 'gm', round }
}

function indexOfGroup(state: PlayState, groupId: string): number {
  return state.groups.findIndex((g) => g.id === groupId)
}

export function canStart(state: PlayState): boolean {
  return state.groups.some((g) => g.memberIds.length > 0)
}

/** Round 1, first character of the first group. */
export function startTurns(state: PlayState): PlayState {
  if (!canStart(state)) return state
  return { ...state, turn: firstTurnFrom(state, 0, 1) }
}

/**
 * The next character plays: the next one of the group, else the first of the
 * next group, else the GM's turn. Returns the new state and who now plays
 * (an entity id, or 'gm').
 */
export function nextTurn(state: PlayState): { turn: TurnState; actor: string | 'gm' | null } {
  const turn = state.turn
  if (turn.status !== 'playing') return { turn, actor: null }
  const gIndex = indexOfGroup(state, turn.groupId)
  const group = state.groups[gIndex]
  const mIndex = group ? group.memberIds.indexOf(turn.memberId) : -1
  const nextMember = group && mIndex >= 0 ? group.memberIds[mIndex + 1] : undefined
  const next: TurnState = nextMember
    ? { ...turn, memberId: nextMember }
    : firstTurnFrom(state, gIndex < 0 ? 0 : gIndex + 1, turn.round)
  return { turn: next, actor: next.status === 'playing' ? next.memberId : 'gm' }
}

/** After the GM's turn: next round, from the first group. */
export function resumeTurns(state: PlayState): PlayState {
  if (state.turn.status !== 'gm') return state
  return { ...state, turn: firstTurnFrom(state, 0, state.turn.round + 1) }
}

export function stopTurns(state: PlayState): PlayState {
  return { ...state, turn: { status: 'stopped' } }
}

function move<T>(list: readonly T[], match: (item: T) => boolean, delta: -1 | 1): T[] {
  const from = list.findIndex(match)
  const to = from + delta
  if (from < 0 || to < 0 || to >= list.length) return [...list]
  const next = [...list]
  ;[next[from], next[to]] = [next[to]!, next[from]!]
  return next
}

/** The players' window shows `assetIds` one after the other (D-259), starting at `index`. */
export function showGallery(assetIds: readonly string[], index = 0): PlayerDisplay {
  const at = Math.max(0, Math.min(index, assetIds.length - 1))
  return { mode: 'image', imageAssetId: assetIds[at] ?? null, gallery: [...assetIds] }
}

/** Position of the picture on screen in its series: `{ index, total }`, or null outside a series. */
export function galleryPosition(display: PlayerDisplay): { index: number; total: number } | null {
  if (display.mode !== 'image' || display.gallery.length < 2 || !display.imageAssetId) return null
  const index = display.gallery.indexOf(display.imageAssetId)
  return index < 0 ? null : { index, total: display.gallery.length }
}

/** Next (`+1`) or previous (`-1`) picture of the series; stays put at either end. */
export function stepGallery(display: PlayerDisplay, delta: 1 | -1): PlayerDisplay {
  const at = galleryPosition(display)
  if (!at) return display
  return showGallery(display.gallery, at.index + delta)
}
