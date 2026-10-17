import type { Entity } from './types'

/**
 * Player colours (D-268): each player character gets one when its player joins
 * a game; rolls, tokens and names show it. The order is the assignment order,
 * the most distinct hues first. No gold or amber: gold is the GM's colour.
 * CSS tokens: `--codex-player-<key>` (tokens.css); board literals: boardTheme.ts.
 */
export const PLAYER_COLORS = [
  'crimson',
  'azure',
  'emerald',
  'copper',
  'plum',
  'teal',
  'rose',
  'moss',
  'indigo',
  'ice',
] as const
export type PlayerColorKey = (typeof PLAYER_COLORS)[number]

/** Colour of whatever the GM rolls (enemies, allies, free rolls): the DA gold. */
export const GM_COLOR = 'gm'
/** Colour of a roll or a token: a player's, or the GM's. */
export type RollColor = PlayerColorKey | typeof GM_COLOR

type Colorable = Pick<Entity, 'kind' | 'details'>

export function isPlayerColor(value: unknown): value is PlayerColorKey {
  return (PLAYER_COLORS as readonly unknown[]).includes(value)
}

/** The colour stored on a player character (older saves have none). */
export function playerColorOf(entity: Colorable | undefined): PlayerColorKey | null {
  if (entity?.kind !== 'player') return null
  const color = (entity.details as { color?: unknown }).color
  return isPlayerColor(color) ? color : null
}

/** Colours already taken by the player characters of a campaign. */
export function usedPlayerColors(entities: Iterable<Colorable>): PlayerColorKey[] {
  const used: PlayerColorKey[] = []
  for (const e of entities) {
    const color = playerColorOf(e)
    if (color) used.push(color)
  }
  return used
}

/**
 * The first colour nobody uses. When all ten are taken (big tables), the least
 * used one, in palette order: colours cycle instead of running out.
 */
export function assignColor(used: Iterable<PlayerColorKey | null | undefined>): PlayerColorKey {
  const counts = new Map<PlayerColorKey, number>(PLAYER_COLORS.map((c) => [c, 0]))
  for (const c of used) if (c && counts.has(c)) counts.set(c, counts.get(c)! + 1)
  let best: PlayerColorKey = PLAYER_COLORS[0]
  for (const c of PLAYER_COLORS) if (counts.get(c)! < counts.get(best)!) best = c
  return best
}

type Lookup = (id: string) => Colorable | undefined

/**
 * Whose colour a roll or a token wears: a player character's own colour; a
 * familiar's master's when the master is a player; the GM's for everything
 * else (enemies, allies, their familiars, free GM rolls, uncoloured players).
 */
export function colorOfEntity(entityId: string | null, lookup: Lookup): RollColor {
  if (!entityId) return GM_COLOR
  const entity = lookup(entityId)
  if (!entity) return GM_COLOR
  if (entity.kind === 'player') return playerColorOf(entity) ?? GM_COLOR
  if (entity.kind === 'familiar') {
    const ownerId = (entity.details as { ownerId?: string | null }).ownerId
    const owner = ownerId ? lookup(ownerId) : undefined
    return playerColorOf(owner) ?? GM_COLOR
  }
  return GM_COLOR
}

/** Same, from a record or a list of entities. */
export function colorIn(
  entities: Readonly<Record<string, Colorable>> | readonly (Colorable & { id: string })[],
  entityId: string | null,
): RollColor {
  const lookup: Lookup = Array.isArray(entities)
    ? (id) => (entities as readonly (Colorable & { id: string })[]).find((e) => e.id === id)
    : (id) => (entities as Readonly<Record<string, Colorable>>)[id]
  return colorOfEntity(entityId, lookup)
}
