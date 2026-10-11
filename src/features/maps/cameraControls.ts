import type { GameMap } from '@/domain/maps'
import { useMapViewStore } from '@/stores/mapViewStore'
import { fitCamera, MAX_SCALE, MIN_SCALE } from './mapGeometry'

/** Zoom around the centre of the viewport, fit the whole map, centre on a point. */
export function cameraControls(map: GameMap) {
  const state = () => useMapViewStore.getState()
  const current = () => {
    const { cameras, viewport } = state()
    return cameras[map.id] ?? fitCamera(map, viewport.width, viewport.height)
  }
  return {
    zoom(factor: number) {
      const { viewport, setCamera } = state()
      const c = current()
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, c.scale * factor))
      const cx = viewport.width / 2
      const cy = viewport.height / 2
      const px = (cx - c.x) / c.scale
      const py = (cy - c.y) / c.scale
      setCamera(map.id, { scale, x: cx - px * scale, y: cy - py * scale })
    },
    fit() {
      const { viewport, setCamera } = state()
      setCamera(map.id, fitCamera(map, viewport.width, viewport.height))
    },
    centerOn(point: { x: number; y: number }) {
      const { viewport, setCamera } = state()
      const c = current()
      setCamera(map.id, {
        ...c,
        x: viewport.width / 2 - point.x * c.scale,
        y: viewport.height / 2 - point.y * c.scale,
      })
    },
  }
}

/** Current zoom of a map (for the zoom control). */
export function useCameraScale(map: GameMap | undefined) {
  return useMapViewStore((s) => {
    if (!map) return 1
    return (s.cameras[map.id] ?? fitCamera(map, s.viewport.width, s.viewport.height)).scale
  })
}
