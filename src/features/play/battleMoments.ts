import type { PlayState } from '@/domain/turns'
import type { Entity } from '@/domain/types'

/**
 * Big moments of a game shown as banners (D-252): a new round, and the end of
 * a fight when everyone on one side of the groups has fallen. Only what the
 * table can see happen: nothing here changes the game.
 */
export type GameMoment = { kind: 'round'; round: number } | { kind: 'victory' } | { kind: 'defeat' }

type Snapshot = { play: Pick<PlayState, 'groups' | 'turn'>; entities: Record<string, Entity> }

function fighters(state: Snapshot, kind: Entity['kind']): Entity[] {
  const ids = new Set(state.play.groups.flatMap((g) => g.memberIds))
  return [...ids].map((id) => state.entities[id]).filter((e): e is Entity => e?.kind === kind)
}

const allDown = (list: Entity[]) => list.length > 0 && list.every((e) => e.hp.current <= 0)

export function momentBetween(before: Snapshot, after: Snapshot): GameMoment | null {
  const was = before.play.turn
  const now = after.play.turn
  if (now.status === 'playing' && (was.status !== 'playing' || was.round !== now.round))
    return { kind: 'round', round: now.round }
  if (before.entities === after.entities) return null
  if (allDown(fighters(after, 'enemy')) && !allDown(fighters(before, 'enemy')))
    return { kind: 'victory' }
  if (allDown(fighters(after, 'player')) && !allDown(fighters(before, 'player')))
    return { kind: 'defeat' }
  return null
}
