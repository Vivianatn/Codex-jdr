import { useMemo } from 'react'
import { useT } from '@/i18n'
import type { MapCanvasLabels } from './MapCanvas'

/** French labels the canvas needs (it stays free of i18n hooks for the players' window). */
export function useCanvasLabels(): MapCanvasLabels {
  const t = useT()
  return useMemo(
    () => ({
      blocked: t.maps.blocked,
      measure: t.maps.measureLabel,
      moved: t.maps.moved,
      fogRevealed: t.maps.fogRevealed,
      fogHidden: t.maps.fogHidden,
      wallAdded: t.maps.wallAdded,
      doorAdded: t.maps.doorAdded,
      drawingAdded: t.maps.drawingAdded,
      drawingErased: t.maps.drawingErased,
      elementAdded: t.maps.elementAdded,
      elementMoved: t.maps.elementMoved,
      calibrated: t.maps.calibrated,
    }),
    [t],
  )
}
