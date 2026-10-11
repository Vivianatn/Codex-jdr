import { useEffect } from 'react'
import { hexRadius, tokenCenter, type GameMap } from '@/domain/maps'
import type { Entity } from '@/domain/types'
import { MiniSheet } from '@/features/play/MiniSheet'
import { useMapViewStore } from '@/stores/mapViewStore'
import { useUiStore } from '@/stores/uiStore'
import { fitCamera } from './mapGeometry'

/**
 * Mini sheets floating above the tokens (D-234), in HTML over the canvas so
 * they stay crisp and accessible. They follow the camera; the canvas below
 * keeps receiving clicks around them.
 */
export function TokenSheets({ map, entities }: { map: GameMap; entities: Record<string, Entity> }) {
  const stored = useMapViewStore((s) => s.cameras[map.id])
  const viewport = useMapViewStore((s) => s.viewport)
  const sheetId = useMapViewStore((s) => s.sheetId)
  const pinPlayers = useMapViewStore((s) => s.pinPlayerSheets)
  const openSheet = useMapViewStore((s) => s.openSheet)
  const openQuick = useUiStore((s) => s.openQuick)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (e.key === 'Escape' && !/^(INPUT|SELECT|TEXTAREA)$/.test(target?.tagName ?? ''))
        useMapViewStore.getState().openSheet(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!viewport.width) return null
  const camera = stored ?? fitCamera(map, viewport.width, viewport.height)
  const shown = map.tokens.filter((tk) => {
    const e = entities[tk.entityId]
    return e && (tk.entityId === sheetId || (pinPlayers && e.kind === 'player'))
  })

  return (
    <div className="pointer-events-none absolute inset-0 z-[5] overflow-hidden">
      {shown.map((token) => {
        const entity = entities[token.entityId]!
        const center = tokenCenter(map.grid, token)
        const radius =
          (map.grid.type === 'hex' ? hexRadius(map.grid) * 0.85 : map.grid.size * 0.42) * token.size
        const expanded = token.entityId === sheetId
        const above = camera.y + (center.y - radius) * camera.scale - 8
        // Near the top edge, the sheet goes under the token instead of being cut off.
        const below = above < (expanded ? 340 : 100)
        return (
          <div
            key={token.id}
            className="pointer-events-auto absolute"
            style={{
              left: camera.x + center.x * camera.scale,
              top: below ? camera.y + (center.y + radius) * camera.scale + 24 : above,
              transform: below ? 'translateX(-50%)' : 'translate(-50%, -100%)',
              zIndex: expanded ? 2 : 1,
            }}
          >
            <MiniSheet
              entity={entity}
              expanded={expanded}
              onExpand={() => openSheet(entity.id)}
              onClose={() => openSheet(null)}
              onFull={() => {
                openSheet(null)
                openQuick(entity.id)
              }}
            />
          </div>
        )
      })}
    </div>
  )
}
