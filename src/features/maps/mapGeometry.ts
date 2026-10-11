import { cellCenter, gridExtent, type GameMap, type MapElement } from '@/domain/maps'
import type { Camera } from '@/stores/mapViewStore'

export const MIN_SCALE = 0.1
export const MAX_SCALE = 6

/** Box of an element in map pixels. */
export function elementBox(map: GameMap, el: MapElement) {
  const { grid } = map
  if (grid.type === 'square')
    return {
      x: grid.offsetX + el.x * grid.size,
      y: grid.offsetY + el.y * grid.size,
      w: el.w * grid.size,
      h: el.h * grid.size,
    }
  const c = cellCenter(grid, { col: Math.round(el.x), row: Math.round(el.y) })
  return {
    x: c.x - grid.size / 2,
    y: c.y - grid.size / 2,
    w: el.w * grid.size,
    h: el.h * grid.size,
  }
}

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
