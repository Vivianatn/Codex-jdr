import { create } from 'zustand'
import type { AreaShape, ElementKind, Point } from '@/domain/maps'
import { clamp } from '@/lib/numbers'

/**
 * View state of the map canvas (not saved, not undoable): tool, selection,
 * camera, pending area of effect, pings. Map *data* lives in the campaign store.
 */

export type MapTool =
  | 'select'
  | 'measure'
  | 'fogReveal'
  | 'fogHide'
  | 'fogRect'
  | 'wall'
  | 'door'
  | 'draw'
  | 'erase'
  | 'areaCircle'
  | 'areaCone'
  | 'areaLine'
  | 'areaSquare'
  | 'ping'
  | 'calibrate'
  | 'place'

export interface Camera {
  x: number
  y: number
  scale: number
}

export type Selection =
  | { type: 'none' }
  | { type: 'tokens'; ids: string[] }
  | { type: 'element'; id: string }
  | { type: 'wall'; id: string }

export interface Ping {
  id: string
  x: number
  y: number
  at: number
}

export const MAP_LAYERS = [
  'background',
  'grid',
  'decor',
  'objects',
  'walls',
  'tokens',
  'fog',
  'drawings',
  'gm',
] as const
export type MapLayerKey = (typeof MAP_LAYERS)[number]

interface MapViewState {
  tool: MapTool
  /** Element kind placed by the "place" tool. */
  placeKind: ElementKind
  selection: Selection
  /** Camera per map id. */
  cameras: Record<string, Camera>
  brush: number
  drawColor: string
  drawGmOnly: boolean
  hiddenLayers: MapLayerKey[]
  /** Area waiting for the GM to apply an effect to its targets. */
  area: AreaShape | null
  pings: Ping[]
  /** Centre the camera on whoever plays (turns, D-226). */
  followTurn: boolean
  /** Character whose mini sheet is open above its token (D-234). */
  sheetId: string | null
  /** Compact mini sheets above every player token. */
  pinPlayerSheets: boolean
  /** Size of the map viewport in screen pixels (for zoom buttons and fit). */
  viewport: { width: number; height: number }
  setViewport: (viewport: { width: number; height: number }) => void
  setTool: (tool: MapTool) => void
  setPlaceKind: (kind: ElementKind) => void
  select: (selection: Selection) => void
  setCamera: (mapId: string, camera: Camera) => void
  setBrush: (size: number) => void
  setDraw: (patch: Partial<Pick<MapViewState, 'drawColor' | 'drawGmOnly'>>) => void
  toggleLayer: (layer: MapLayerKey) => void
  setArea: (area: AreaShape | null) => void
  addPing: (p: Point) => Ping
  dropPing: (id: string) => void
  setFollowTurn: (follow: boolean) => void
  openSheet: (entityId: string | null) => void
  setPinPlayerSheets: (pin: boolean) => void
}

export const useMapViewStore = create<MapViewState>()((set) => ({
  tool: 'select',
  placeKind: 'tree',
  selection: { type: 'none' },
  cameras: {},
  brush: 2,
  drawColor: '#d9a441',
  drawGmOnly: false,
  hiddenLayers: [],
  area: null,
  pings: [],
  followTurn: true,
  viewport: { width: 0, height: 0 },
  sheetId: null,
  pinPlayerSheets: false,
  setViewport: (viewport) => set({ viewport }),
  setTool: (tool) => set({ tool, area: null }),
  setPlaceKind: (placeKind) => set({ placeKind, tool: 'place' }),
  select: (selection) => set({ selection }),
  setCamera: (mapId, camera) => set((s) => ({ cameras: { ...s.cameras, [mapId]: camera } })),
  setBrush: (brush) => set({ brush: clamp(brush, 1, 10) }),
  setDraw: (patch) => set(patch),
  toggleLayer: (layer) =>
    set((s) => ({
      hiddenLayers: s.hiddenLayers.includes(layer)
        ? s.hiddenLayers.filter((l) => l !== layer)
        : [...s.hiddenLayers, layer],
    })),
  setArea: (area) => set({ area }),
  addPing: (p) => {
    const ping = { id: crypto.randomUUID(), x: p.x, y: p.y, at: Date.now() }
    set((s) => ({ pings: [...s.pings, ping].slice(-10) }))
    return ping
  },
  dropPing: (id) => set((s) => ({ pings: s.pings.filter((p) => p.id !== id) })),
  setFollowTurn: (followTurn) => set({ followTurn }),
  openSheet: (sheetId) => set({ sheetId }),
  setPinPlayerSheets: (pinPlayerSheets) => set({ pinPlayerSheets }),
}))
