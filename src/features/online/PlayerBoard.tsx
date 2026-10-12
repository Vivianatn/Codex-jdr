import { normalizeEntityShape } from '@/domain/entity'
import type { GameMap } from '@/domain/maps'
import type { Entity } from '@/domain/types'
import { MapCanvas } from '@/features/maps/MapCanvas'
import { useCanvasLabels } from '@/features/maps/useCanvasLabels'
import { sendIntent } from '@/online/controller'
import type { RulesConfig } from '@/rules'
import { useMemo } from 'react'

/**
 * The board seen by a player (D-245): the host's map as the players may see
 * it; only their own token can be dragged, and the host decides the move.
 */
export function PlayerBoard({
  map,
  entities,
  rules,
  mine,
  activeEntityId,
  canMove,
}: {
  map: GameMap
  entities: Entity[]
  rules: RulesConfig
  mine: string[]
  activeEntityId: string | null
  canMove: boolean
}) {
  const labels = useCanvasLabels()
  const byId = useMemo(
    () => Object.fromEntries(entities.map((e) => [e.id, normalizeEntityShape(e)])),
    [entities],
  )
  return (
    <MapCanvas
      map={map}
      entities={byId}
      rules={rules}
      viewer="players"
      mode="view"
      labels={labels}
      activeEntityId={activeEntityId}
      movableEntityIds={canMove ? mine : []}
      onTokenMove={(tokenId, cell) =>
        sendIntent({ type: 'move', mapId: map.id, tokenId, col: cell.col, row: cell.row })
      }
      className="relative size-full overflow-hidden"
    />
  )
}
