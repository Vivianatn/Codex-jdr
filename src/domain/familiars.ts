import { entityName } from './entity'
import type { Entity, EntityKind, EntityOfKind } from './types'

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
    .sort((a, b) => order[a.kind]! - order[b.kind]! || a.name.localeCompare(b.name, 'fr'))
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
