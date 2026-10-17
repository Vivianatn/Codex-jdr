import { entityName } from '@/domain/entity'
import type { GameMap } from '@/domain/maps'
import type { Entity } from '@/domain/types'
import { compareText } from '@/lib/text'

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
