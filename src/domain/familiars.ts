import { entityName } from './entity'
import {
  blockingWall,
  cellCenter,
  freeCellNear,
  inBounds,
  passageAt,
  tokenCenter,
  type Cell,
  type GameMap,
  type Token,
} from './maps'
import type { Entity, EntityKind, EntityOfKind } from './types'
import { compareText } from '@/lib/text'

/** Who can have familiars: players, enemies and allies. */
export const FAMILIAR_OWNER_KINDS = [
  'player',
  'enemy',
  'ally',
] as const satisfies readonly EntityKind[]

export function canOwnFamiliars(entity: Pick<Entity, 'kind'>): boolean {
  return (FAMILIAR_OWNER_KINDS as readonly EntityKind[]).includes(entity.kind)
}

export interface OwnerOption {
  id: string
  name: string
  kind: EntityKind
}

/** Possible masters for a familiar, players first, then allies, then enemies. */
export function ownerOptions(entities: readonly Entity[]): OwnerOption[] {
  const order: Record<string, number> = { player: 0, ally: 1, enemy: 2 }
  return entities
    .filter(canOwnFamiliars)
    .map((e) => ({ id: e.id, name: entityName(e), kind: e.kind }))
    .sort((a, b) => order[a.kind]! - order[b.kind]! || compareText(a.name, b.name))
}

export function isFamiliar(entity: Entity): entity is EntityOfKind<'familiar'> {
  return entity.kind === 'familiar'
}

/** Familiars attached to `ownerId`. */
export function familiarsOf(
  entities: readonly Entity[],
  ownerId: string,
): EntityOfKind<'familiar'>[] {
  return entities.filter(isFamiliar).filter((f) => f.details.ownerId === ownerId)
}

/** Familiars with no master (or whose master no longer exists). */
export function freeFamiliars(entities: readonly Entity[]): EntityOfKind<'familiar'>[] {
  const ids = new Set(entities.map((e) => e.id))
  return entities
    .filter(isFamiliar)
    .filter((f) => !f.details.ownerId || !ids.has(f.details.ownerId))
}

export function withOwner<E extends Entity>(entity: E, ownerId: string | null): E {
  if (!isFamiliar(entity)) return entity
  return { ...entity, details: { ...entity.details, ownerId } } as E
}

type EntityList = readonly Entity[] | Readonly<Record<string, Entity>>
const listOf = (entities: EntityList): readonly Entity[] =>
  Array.isArray(entities) ? entities : Object.values(entities)

/**
 * Master of a familiar when that master still exists (D-269), else null. Such
 * a familiar has no turn of its own: it plays during its master's turn.
 */
export function masterOf(entities: EntityList, entity: Entity | undefined): Entity | null {
  if (!entity || !isFamiliar(entity) || !entity.details.ownerId) return null
  const ownerId = entity.details.ownerId
  return listOf(entities).find((e) => e.id === ownerId && canOwnFamiliars(e)) ?? null
}

/** A familiar plays at its master's turn unless the GM unticked « Agit au tour de son maître ». */
const actsOnOwnerTurn = (f: EntityOfKind<'familiar'>) => f.details.actsOnOwnerTurn !== false

/**
 * Familiars playing at `masterId`'s turn (D-269): attached to it, and acting
 * on their master's turn (the familiar sheet's setting, on by default).
 */
export function turnFamiliars(entities: EntityList, masterId: string): EntityOfKind<'familiar'>[] {
  return familiarsOf(listOf(entities), masterId).filter(actsOnOwnerTurn)
}

/** Ids of the familiars sharing their (existing) master's turn: no slot of their own (D-269). */
export function attachedFamiliarIds(entities: EntityList): Set<string> {
  const list = listOf(entities)
  return new Set(
    list.filter((e) => isFamiliar(e) && actsOnOwnerTurn(e) && masterOf(list, e)).map((e) => e.id),
  )
}

/**
 * What a player controls (D-269): their characters and the familiars attached
 * to them. They roll the dice and move the tokens of these only.
 */
export function controlledBy(entities: EntityList, characterIds: readonly string[]): Set<string> {
  const own = new Set(characterIds)
  const controlled = new Set(characterIds)
  for (const e of listOf(entities))
    if (isFamiliar(e) && e.details.ownerId && own.has(e.details.ownerId)) controlled.add(e.id)
  return controlled
}

export interface FamiliarChoice {
  master: Entity
  familiars: EntityOfKind<'familiar'>[]
}

/**
 * Familiars the GM may bring onto the board in play (D-269): only those
 * attached to a player character or to an enemy, grouped by master (players
 * first). Free familiars and allies' familiars are left out on purpose.
 */
export function playableFamiliars(entities: EntityList): FamiliarChoice[] {
  const list = listOf(entities)
  const order: Record<string, number> = { player: 0, enemy: 1 }
  return list
    .filter((e) => e.kind === 'player' || e.kind === 'enemy')
    .map((master) => ({
      master,
      familiars: familiarsOf(list, master.id).sort((a, b) =>
        compareText(entityName(a), entityName(b)),
      ),
    }))
    .filter((c) => c.familiars.length > 0)
    .sort(
      (a, b) =>
        order[a.master.kind]! - order[b.master.kind]! ||
        compareText(entityName(a.master), entityName(b.master)),
    )
}

/**
 * Where a familiar's token goes (D-269): the first free cell around its
 * master's token (in the map, not behind a wall, not on a passage), or null
 * when there is none.
 */
export function familiarSpot(map: GameMap, master: Token, familiarId: string): Cell | null {
  const from = tokenCenter(map.grid, master)
  const covers = (cell: Cell) =>
    cell.col >= master.col &&
    cell.col < master.col + master.size &&
    cell.row >= master.row &&
    cell.row < master.row + master.size
  const avoid = (cell: Cell) =>
    covers(cell) ||
    passageAt(map, cell) !== undefined ||
    blockingWall(map.walls, from, cellCenter(map.grid, cell)) !== undefined
  const start = { col: master.col, row: master.row }
  const cell = freeCellNear(map, start, { ignoreEntityId: familiarId, avoid })
  return avoid(cell) || !inBounds(map, cell) ? null : cell
}
