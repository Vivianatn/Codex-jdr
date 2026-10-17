import { entityName } from '@/domain/entity'
import { inBounds, type Cell, type GameMap } from '@/domain/maps'
import type { Entity } from '@/domain/types'
import { compareText } from '@/lib/text'
import type { TeleportPick } from '@/stores/mapViewStore'

const KIND_ORDER: Record<string, number> = { player: 0, ally: 1, familiar: 2, enemy: 3 }

/** Who the GM may teleport: every player character, and anyone standing on a map. */
export function teleportCandidates(
  entities: Readonly<Record<string, Entity>>,
  maps: Readonly<Record<string, GameMap>>,
): Entity[] {
  const onBoard = new Set(Object.values(maps).flatMap((m) => m.tokens.map((tk) => tk.entityId)))
  return Object.values(entities)
    .filter((e) => e.kind === 'player' || onBoard.has(e.id))
    .sort(
      (a, b) =>
        (KIND_ORDER[a.kind] ?? 9) - (KIND_ORDER[b.kind] ?? 9) ||
        compareText(entityName(a), entityName(b)),
    )
}

/** Campaign maps by name, for the destination pickers. */
export function sortedMaps(maps: Readonly<Record<string, GameMap>>): GameMap[] {
  return Object.values(maps).sort((a, b) => compareText(a.name, b.name))
}

// ---------------------------------------------------------------------------
// Choosing the exact landing cell (D-277)
// ---------------------------------------------------------------------------

/** Size of a character's token (the first one found), 1 when it has none. */
export function tokenSize(maps: Readonly<Record<string, GameMap>>, entityId: string): number {
  for (const map of Object.values(maps)) {
    const tk = map.tokens.find((x) => x.entityId === entityId)
    if (tk) return tk.size
  }
  return 1
}

const overlaps = (a: Cell, sa: number, b: Cell, sb: number) =>
  a.col < b.col + sb && b.col < a.col + sa && a.row < b.row + sb && b.row < a.row + sa

/**
 * Why the current character of `pick` cannot land on `cell`, or null: its
 * footprint must fit in the map and cover neither another token nor a cell
 * already chosen for someone else. Walls, fog and passages do not count.
 */
export function pickProblem(
  maps: Readonly<Record<string, GameMap>>,
  pick: TeleportPick,
  cell: Cell,
): 'outside' | 'occupied' | null {
  const current = pick.queue[0]
  const map = current ? maps[current.mapId] : undefined
  if (!current || !map) return 'outside'
  const size = tokenSize(maps, current.entityId)
  const last = { col: cell.col + size - 1, row: cell.row + size - 1 }
  if (!inBounds(map, cell) || !inBounds(map, last)) return 'outside'
  const taken =
    map.tokens.some(
      (tk) => tk.entityId !== current.entityId && overlaps(cell, size, tk, tk.size),
    ) ||
    Object.entries(pick.chosen).some(
      ([id, c]) =>
        id !== current.entityId &&
        c.mapId === map.id &&
        overlaps(cell, size, c.cell, tokenSize(maps, id)),
    )
  return taken ? 'occupied' : null
}

/** `pick` once the current character has its cell: the next one comes up. */
export function advancePick(pick: TeleportPick, cell: Cell): TeleportPick {
  const [current, ...rest] = pick.queue
  if (!current) return pick
  return {
    ...pick,
    queue: rest,
    chosen: { ...pick.chosen, [current.entityId]: { mapId: current.mapId, cell } },
  }
}

/** A cell as the GM reads it on a chess-like board: column letters, row number (« C4 »). */
export function cellName(cell: Cell): string {
  let letters = ''
  for (let n = cell.col + 1; n > 0; n = Math.floor((n - 1) / 26))
    letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters
  return `${letters}${cell.row + 1}`
}
