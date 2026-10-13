import type { GameMap } from '@/domain/maps'
import { useMapViewStore } from '@/stores/mapViewStore'
import { fitCamera, MAX_SCALE, MIN_SCALE } from './mapGeometry'
import { clamp } from '@/lib/numbers'

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
      const scale = clamp(c.scale * factor, MIN_SCALE, MAX_SCALE)
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
    /**
     * Centres the view on a point. `glide`: animate over 500 ms (DA §7.3) and
     * only when the point is outside the central 60 % of the screen.
     */
    centerOn(point: { x: number; y: number }, glide = false) {
      const { viewport, setCamera } = state()
      const c = current()
      const target = {
        ...c,
        x: viewport.width / 2 - point.x * c.scale,
        y: viewport.height / 2 - point.y * c.scale,
      }
      if (!glide) return setCamera(map.id, target)
      const sx = c.x + point.x * c.scale
      const sy = c.y + point.y * c.scale
      const inside =
        Math.abs(sx - viewport.width / 2) < viewport.width * 0.3 &&
        Math.abs(sy - viewport.height / 2) < viewport.height * 0.3
      if (inside) return
      const motion = document.documentElement.dataset.motion
      if (motion !== 'full' || window.matchMedia('(prefers-reduced-motion: reduce)').matches)
        return setCamera(map.id, target)
      const start = performance.now()
      const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / 500)
        const k = ease(t)
        setCamera(map.id, { ...c, x: c.x + (target.x - c.x) * k, y: c.y + (target.y - c.y) * k })
        if (t < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
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
