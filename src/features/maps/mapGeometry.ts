import { gridExtent, type GameMap } from '@/domain/maps'
import type { Camera } from '@/stores/mapViewStore'

export { elementBox } from '@/domain/maps'

export const MIN_SCALE = 0.1
export const MAX_SCALE = 6

/** Camera showing the whole map in a viewport of `width × height`. */
export function fitCamera(map: GameMap, width: number, height: number): Camera {
  const extent = gridExtent(map)
  const w = extent.width + map.grid.offsetX
  const h = extent.height + map.grid.offsetY
  const scale = Math.min(
    MAX_SCALE,
    Math.max(MIN_SCALE, Math.min(width / (w + 40), height / (h + 40))),
  )
  return { scale, x: (width - w * scale) / 2, y: (height - h * scale) / 2 }
}
