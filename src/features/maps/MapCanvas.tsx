import type Konva from 'konva'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Arc,
  Circle,
  Group,
  Image as KImage,
  Label,
  Layer,
  Line,
  Rect,
  Shape,
  Stage,
  Tag,
  Text,
} from 'react-konva'
import { entityHpMax, entityName, effectiveStats } from '@/domain/entity'
import {
  blockingWall,
  calibrateGrid,
  cellAt,
  cellCenter,
  cellDistance,
  cellPolygon,
  cellsInCircle,
  cellsInRect,
  gridExtent,
  hexRadius,
  inBounds,
  isRevealed,
  newElement,
  pointInArea,
  setFog,
  snapToVertex,
  tokenCellAt,
  tokenCenter,
  visibleToPlayers,
  type AreaShape,
  type Cell,
  type GameMap,
  type MapElement,
  type Point,
  type Token,
  type Wall,
} from '@/domain/maps'
import type { Entity } from '@/domain/types'
import { hpBand, type RulesConfig } from '@/rules'
import { useMapViewStore, type Camera } from '@/stores/mapViewStore'
import { ENTITY_DRAG_TYPE } from './dragTypes'
import { drawElement } from './drawElements'
import { elementBox, fitCamera, MAX_SCALE, MIN_SCALE } from './mapGeometry'
import { useAssetImage, useImage } from './useImage'

export type MapChange = (recipe: (map: GameMap) => GameMap, label: string) => void

export interface MapCanvasLabels {
  blocked: string
  measure: (cells: number, meters: number) => string
  moved: (name: string) => string
  fogRevealed: string
  fogHidden: string
  wallAdded: string
  doorAdded: string
  drawingAdded: string
  drawingErased: string
  elementAdded: string
  elementMoved: string
  calibrated: string
}

export interface MapCanvasProps {
  map: GameMap
  entities: Record<string, Entity>
  rules: RulesConfig
  /** gm sees everything (fog dimmed); players see what their characters may see. */
  viewer: 'gm' | 'players'
  /** edit = map editor, play = GM during the game, view = players' window. */
  mode: 'edit' | 'play' | 'view'
  labels: MapCanvasLabels
  activeEntityId?: string | null
  /** Controlled camera (players' window following the GM). */
  camera?: Camera | null
  onChange?: MapChange
  onTokenOpen?: (entityId: string) => void
  onElementOpen?: (elementId: string) => void
  onDoorOpen?: (wallId: string) => void
  onArea?: (area: AreaShape) => void
  onPing?: (point: Point) => void
  onCameraChange?: (camera: Camera, size: { width: number; height: number }) => void
  /** Token moved by drag or keyboard; the parent applies fog auto-reveal etc. */
  onTokenMove?: (tokenId: string, cell: Cell) => void
  /** Characters dropped from the side bar (HTML drag & drop). */
  onDropEntity?: (entityId: string, cell: Cell) => void
  onBlocked?: (message: string) => void
  calibrateCells?: number
  className?: string
}

const KIND_COLORS: Record<Entity['kind'], string> = {
  player: '#6d5bd0',
  ally: '#3fa96b',
  familiar: '#d9a441',
  enemy: '#c43d3d',
}
const BAND_COLORS = { healthy: '#3fa96b', wounded: '#e8a33d', critical: '#e05252', down: '#e05252' }
const CONDITION_DOT: Record<string, string> = {
  red: '#e05252',
  orange: '#e8833d',
  yellow: '#d9a441',
  green: '#3fa96b',
  blue: '#4a90d9',
  violet: '#6d5bd0',
  pink: '#d3558f',
  gray: '#8a869c',
}

/**
 * The battle map (SPEC §5): background, grid, decor, objects, walls & doors,
 * tokens, fog, drawings and the tool overlays, with smooth zoom and pan.
 */
export function MapCanvas(props: MapCanvasProps) {
  const { map, viewer, mode } = props
  const container = useRef<HTMLDivElement>(null)
  const stage = useRef<Konva.Stage>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const tool = useMapViewStore((s) => (mode === 'view' ? 'select' : s.tool))
  const storedCamera = useMapViewStore((s) => s.cameras[map.id])
  const setStoredCamera = useMapViewStore((s) => s.setCamera)
  const hidden = useMapViewStore((s) => s.hiddenLayers)
  const selection = useMapViewStore((s) => s.selection)
  const area = useMapViewStore((s) => s.area)
  const pings = useMapViewStore((s) => s.pings)

  // ---- size & camera ------------------------------------------------------
  useEffect(() => {
    const el = container.current
    if (!el) return
    const update = () => {
      const next = { width: el.clientWidth, height: el.clientHeight }
      setSize(next)
      useMapViewStore.getState().setViewport(next)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const camera: Camera = useMemo(() => {
    if (props.camera) return props.camera
    if (storedCamera) return storedCamera
    return size.width ? fitCamera(map, size.width, size.height) : { x: 0, y: 0, scale: 1 }
  }, [props.camera, storedCamera, size.width, size.height, map])

  const setCamera = useCallback(
    (next: Camera) => {
      const clamped = { ...next, scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, next.scale)) }
      setStoredCamera(map.id, clamped)
      props.onCameraChange?.(clamped, size)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [map.id, size, setStoredCamera, props.onCameraChange],
  )

  // Tell the parent about the initial camera too (players' window follows it).
  useEffect(() => {
    if (size.width && !props.camera) props.onCameraChange?.(camera, size)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height])

  // Debug hook for end-to-end tests: map ↔ screen coordinates.
  useEffect(() => {
    if (!import.meta.env.DEV || mode === 'view') return
    const w = window as unknown as { __codexMap?: unknown }
    w.__codexMap = {
      toScreen: (p: Point) => {
        const rect = container.current!.getBoundingClientRect()
        return {
          x: rect.left + camera.x + p.x * camera.scale,
          y: rect.top + camera.y + p.y * camera.scale,
        }
      },
      cellCenter: (col: number, row: number) => cellCenter(map.grid, { col, row }),
      camera,
    }
  }, [camera, map.grid, mode])

  // ---- pointer handling ----------------------------------------------------
  const [gesture, setGesture] = useState<
    | null
    | { kind: 'pan'; start: Point; camera: Camera }
    | { kind: 'measure'; from: Point; to: Point }
    | { kind: 'fog'; cells: Map<string, Cell>; reveal: boolean }
    | { kind: 'rect'; from: Point; to: Point; purpose: 'fog' | 'calibrate' }
    | { kind: 'draw'; points: number[] }
    | { kind: 'area'; from: Point; to: Point }
  >(null)
  const [measure, setMeasure] = useState<{ from: Point; to: Point } | null>(null)
  const [chain, setChain] = useState<Point[]>([])
  const [pointer, setPointer] = useState<Point | null>(null)
  const pinch = useRef<{ distance: number; center: Point; camera: Camera } | null>(null)
  const spaceHeld = useRef(false)

  const toMap = useCallback(
    (screen: Point): Point => ({
      x: (screen.x - camera.x) / camera.scale,
      y: (screen.y - camera.y) / camera.scale,
    }),
    [camera],
  )
  const pointerMap = (): Point | null => {
    const p = stage.current?.getPointerPosition()
    return p ? toMap(p) : null
  }

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isTyping(e.target)) spaceHeld.current = true
      if (e.key === 'Escape') {
        setChain([])
        setMeasure(null)
        useMapViewStore.getState().setArea(null)
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceHeld.current = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  const areaFrom = (from: Point, to: Point): AreaShape => {
    const length = Math.hypot(to.x - from.x, to.y - from.y)
    switch (tool) {
      case 'areaCone':
        return {
          kind: 'cone',
          origin: from,
          direction: Math.atan2(to.y - from.y, to.x - from.x),
          length,
          angle: Math.PI / 3,
        }
      case 'areaLine':
        return { kind: 'line', from, to, width: map.grid.size }
      case 'areaSquare':
        return {
          kind: 'square',
          center: from,
          half: Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y)),
        }
      default:
        return { kind: 'circle', center: from, radius: length }
    }
  }

  function onPointerDown(e: Konva.KonvaEventObject<PointerEvent>) {
    const p = pointerMap()
    if (!p) return
    const onEmpty = e.target === e.target.getStage() || e.target.name() === 'background'
    const evt = e.evt
    if (
      evt.button === 1 ||
      spaceHeld.current ||
      (tool === 'select' && onEmpty) ||
      mode === 'view'
    ) {
      setGesture({ kind: 'pan', start: { x: evt.clientX, y: evt.clientY }, camera })
      return
    }
    if (evt.altKey) {
      props.onPing?.(p)
      return
    }
    if (!props.onChange) return
    switch (tool) {
      case 'measure':
        setGesture({ kind: 'measure', from: p, to: p })
        break
      case 'fogReveal':
      case 'fogHide':
        setGesture({ kind: 'fog', cells: brushCells(p, new Map()), reveal: tool === 'fogReveal' })
        break
      case 'fogRect':
        setGesture({ kind: 'rect', from: p, to: p, purpose: 'fog' })
        break
      case 'calibrate':
        setGesture({ kind: 'rect', from: p, to: p, purpose: 'calibrate' })
        break
      case 'draw':
        setGesture({ kind: 'draw', points: [p.x, p.y] })
        break
      case 'areaCircle':
      case 'areaCone':
      case 'areaLine':
      case 'areaSquare':
        setGesture({ kind: 'area', from: p, to: p })
        break
      case 'ping':
        props.onPing?.(p)
        break
      case 'wall':
      case 'door': {
        const v = snapToVertex(map.grid, p)
        if (chain.length === 0) setChain([v])
        else {
          const last = chain[chain.length - 1]!
          if (last.x !== v.x || last.y !== v.y) {
            const wall: Wall = {
              id: crypto.randomUUID(),
              x1: last.x,
              y1: last.y,
              x2: v.x,
              y2: v.y,
              kind: tool,
              ...(tool === 'door' ? { door: { open: false, locked: false, difficulty: 0 } } : {}),
            }
            props.onChange(
              (m) => ({ ...m, walls: [...m.walls, wall] }),
              tool === 'door' ? props.labels.doorAdded : props.labels.wallAdded,
            )
            // Doors are single segments; walls chain until Escape / double-click.
            setChain(tool === 'door' ? [] : [v])
          }
        }
        break
      }
      case 'place': {
        const cell = cellAt(map.grid, p)
        if (!inBounds(map, cell)) break
        const kind = useMapViewStore.getState().placeKind
        const el = newElement(kind, cell)
        props.onChange((m) => ({ ...m, elements: [...m.elements, el] }), props.labels.elementAdded)
        useMapViewStore.getState().select({ type: 'element', id: el.id })
        break
      }
      default:
        if (onEmpty) useMapViewStore.getState().select({ type: 'none' })
    }
  }

  function brushCells(p: Point, into: Map<string, Cell>) {
    const radius = (useMapViewStore.getState().brush * map.grid.size) / 2
    for (const c of cellsInCircle(map, p, Math.max(radius, map.grid.size * 0.5)))
      into.set(`${c.col},${c.row}`, c)
    return into
  }

  function onPointerMove() {
    const screen = stage.current?.getPointerPosition()
    if (!screen) return
    const p = toMap(screen)
    setPointer(p)
    if (!gesture) return
    switch (gesture.kind) {
      case 'pan': {
        const rect = container.current!.getBoundingClientRect()
        const dx = screen.x + rect.left - gesture.start.x
        const dy = screen.y + rect.top - gesture.start.y
        setCamera({ ...gesture.camera, x: gesture.camera.x + dx, y: gesture.camera.y + dy })
        break
      }
      case 'measure':
      case 'area':
        setGesture({ ...gesture, to: p })
        break
      case 'rect':
        setGesture({ ...gesture, to: p })
        break
      case 'fog':
        setGesture({ ...gesture, cells: brushCells(p, new Map(gesture.cells)) })
        break
      case 'draw':
        setGesture({ ...gesture, points: [...gesture.points, p.x, p.y] })
        break
    }
  }

  function onPointerUp() {
    const g = gesture
    setGesture(null)
    if (!g || !props.onChange) return
    switch (g.kind) {
      case 'measure':
        setMeasure({ from: g.from, to: g.to })
        break
      case 'fog': {
        const cells = [...g.cells.values()]
        props.onChange(
          (m) => {
            const revealed = setFog(m, cells, g.reveal)
            return revealed === m.fog.revealed ? m : { ...m, fog: { ...m.fog, revealed } }
          },
          g.reveal ? props.labels.fogRevealed : props.labels.fogHidden,
        )
        break
      }
      case 'rect':
        if (g.purpose === 'fog') {
          const cells = cellsInRect(map, g.from, g.to)
          props.onChange((m) => {
            const revealed = setFog(m, cells, true)
            return revealed === m.fog.revealed ? m : { ...m, fog: { ...m.fog, revealed } }
          }, props.labels.fogRevealed)
        } else if (Math.abs(g.to.x - g.from.x) > 4) {
          props.onChange(
            (m) => ({ ...m, grid: calibrateGrid(m.grid, g.from, g.to, props.calibrateCells ?? 1) }),
            props.labels.calibrated,
          )
        }
        break
      case 'draw':
        if (g.points.length >= 4) {
          const { drawColor, drawGmOnly } = useMapViewStore.getState()
          props.onChange(
            (m) => ({
              ...m,
              drawings: [
                ...m.drawings,
                {
                  id: crypto.randomUUID(),
                  points: g.points,
                  color: drawColor,
                  width: 4,
                  gmOnly: drawGmOnly,
                },
              ],
            }),
            props.labels.drawingAdded,
          )
        }
        break
      case 'area': {
        const shape = areaFrom(g.from, g.to)
        useMapViewStore.getState().setArea(shape)
        props.onArea?.(shape)
        break
      }
    }
  }

  function onWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault()
    const screen = stage.current?.getPointerPosition()
    if (!screen) return
    const factor = Math.pow(1.0015, -e.evt.deltaY)
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, camera.scale * factor))
    const p = toMap(screen)
    setCamera({ scale, x: screen.x - p.x * scale, y: screen.y - p.y * scale })
  }

  function onTouchMove(e: Konva.KonvaEventObject<TouchEvent>) {
    const touches = e.evt.touches
    if (touches.length !== 2) return
    e.evt.preventDefault()
    const rect = container.current!.getBoundingClientRect()
    const a = { x: touches[0]!.clientX - rect.left, y: touches[0]!.clientY - rect.top }
    const b = { x: touches[1]!.clientX - rect.left, y: touches[1]!.clientY - rect.top }
    const distance = Math.hypot(a.x - b.x, a.y - b.y)
    const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    if (!pinch.current) {
      pinch.current = { distance, center, camera }
      setGesture(null)
      return
    }
    const start = pinch.current
    const scale = Math.min(
      MAX_SCALE,
      Math.max(MIN_SCALE, start.camera.scale * (distance / start.distance)),
    )
    const p = {
      x: (start.center.x - start.camera.x) / start.camera.scale,
      y: (start.center.y - start.camera.y) / start.camera.scale,
    }
    setCamera({ scale, x: center.x - p.x * scale, y: center.y - p.y * scale })
  }

  // ---- derived data ---------------------------------------------------------
  const isGm = viewer === 'gm'
  const show = (layer: (typeof hidden)[number]) => !hidden.includes(layer)
  const elements = map.elements.filter((el) => (isGm ? true : visibleToPlayers(el)))
  const decor = elements.filter((el) => el.layer === 'decor')
  const objects = elements.filter((el) => el.layer === 'objects')
  const gmNotes = elements.filter((el) => el.layer === 'gm')
  const selectedTokens = selection.type === 'tokens' ? selection.ids : []
  const areaTargets = useMemo(
    () =>
      new Set(
        area
          ? map.tokens.filter((t) => pointInArea(tokenCenter(map.grid, t), area)).map((t) => t.id)
          : [],
      ),
    [area, map.tokens, map.grid],
  )
  const tokens = map.tokens.filter((t) => {
    const entity = props.entities[t.entityId]
    if (!entity) return false
    if (isGm) return true
    if (t.hidden) return false
    if (entity.kind === 'player') return true
    return isRevealed(map, { col: t.col, row: t.row })
  })
  const background = useAssetImage(map.background.assetId)
  const extent = gridExtent(map)

  const dragArea = gesture?.kind === 'area' ? areaFrom(gesture.from, gesture.to) : null
  const shownArea = dragArea ?? area
  const measureLine = gesture?.kind === 'measure' ? gesture : measure
  const cursor =
    gesture?.kind === 'pan'
      ? 'grabbing'
      : tool === 'select'
        ? 'default'
        : tool === 'place' || tool === 'wall' || tool === 'door'
          ? 'copy'
          : 'crosshair'

  return (
    <div
      ref={container}
      className={
        props.className ?? 'relative size-full overflow-hidden bg-[#e9e4d8] dark:bg-[#1a1824]'
      }
      style={{ cursor, touchAction: 'none' }}
      data-testid="map-canvas"
      onDragOver={(e) => {
        if (props.onDropEntity && e.dataTransfer.types.includes(ENTITY_DRAG_TYPE))
          e.preventDefault()
      }}
      onDrop={(e) => {
        const id = e.dataTransfer.getData(ENTITY_DRAG_TYPE)
        if (!id || !props.onDropEntity) return
        e.preventDefault()
        const rect = container.current!.getBoundingClientRect()
        const p = toMap({ x: e.clientX - rect.left, y: e.clientY - rect.top })
        props.onDropEntity(id, cellAt(map.grid, p))
      }}
      onDoubleClick={() => setChain([])}
    >
      {size.width > 0 && (
        <Stage
          ref={stage}
          width={size.width}
          height={size.height}
          x={camera.x}
          y={camera.y}
          scaleX={camera.scale}
          scaleY={camera.scale}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={() => {
            setPointer(null)
            if (gesture?.kind === 'pan') setGesture(null)
          }}
          onWheel={onWheel}
          onTouchMove={onTouchMove}
          onTouchEnd={() => (pinch.current = null)}
        >
          {/* Static layer: redrawn only when the map changes. */}
          <Layer listening={mode !== 'view'}>
            <Rect
              name="background"
              x={-5000}
              y={-5000}
              width={extent.width + map.grid.offsetX + 10000}
              height={extent.height + map.grid.offsetY + 10000}
              fill="rgba(0,0,0,0)"
            />
            {background && show('background') && (
              <KImage
                name="background"
                image={background}
                x={map.background.x}
                y={map.background.y}
                scaleX={map.background.scale}
                scaleY={map.background.scale}
                opacity={map.background.opacity}
              />
            )}
            {!background && (
              <Rect
                name="background"
                x={map.grid.offsetX}
                y={map.grid.offsetY}
                width={extent.width}
                height={extent.height}
                fill="#f3eee2"
                stroke="#cfc6b3"
                strokeWidth={2}
              />
            )}
            {map.grid.visible && show('grid') && <GridShape map={map} />}
            {show('decor') &&
              decor.map((el) => (
                <ElementNode key={el.id} el={el} map={map} {...elementHandlers(el)} />
              ))}
            {show('objects') &&
              objects.map((el) => (
                <ElementNode key={el.id} el={el} map={map} {...elementHandlers(el)} />
              ))}
            {show('walls') &&
              map.walls.map((w) => (
                <WallNode
                  key={w.id}
                  wall={w}
                  selected={selection.type === 'wall' && selection.id === w.id}
                  scale={camera.scale}
                  onSelect={() => {
                    if (tool !== 'select') return
                    if (mode === 'edit')
                      useMapViewStore.getState().select({ type: 'wall', id: w.id })
                    else if (w.kind === 'door' && mode === 'play') props.onDoorOpen?.(w.id)
                  }}
                />
              ))}
          </Layer>

          {/* Tokens. */}
          <Layer listening={mode !== 'view'}>
            {show('tokens') &&
              tokens.map((t) => (
                <TokenNode
                  key={t.id}
                  token={t}
                  map={map}
                  entity={props.entities[t.entityId]!}
                  rules={props.rules}
                  gm={isGm}
                  selected={selectedTokens.includes(t.id) || areaTargets.has(t.id)}
                  active={props.activeEntityId === t.entityId}
                  draggable={mode !== 'view' && tool === 'select' && Boolean(props.onChange)}
                  onSelect={(additive) => {
                    const current = useMapViewStore.getState().selection
                    const ids = current.type === 'tokens' ? current.ids : []
                    useMapViewStore.getState().select({
                      type: 'tokens',
                      ids: additive
                        ? ids.includes(t.id)
                          ? ids.filter((i) => i !== t.id)
                          : [...ids, t.id]
                        : [t.id],
                    })
                    if (!additive) props.onTokenOpen?.(t.entityId)
                  }}
                  onMoved={(cell, force) => {
                    const from = tokenCenter(map.grid, t)
                    const to = tokenCenter(map.grid, { ...t, ...cell })
                    if (!force && blockingWall(map.walls, from, to)) {
                      props.onBlocked?.(props.labels.blocked)
                      return false
                    }
                    props.onTokenMove?.(t.id, cell)
                    return true
                  }}
                  onDragMove={(p) => setMeasure({ from: tokenCenter(map.grid, t), to: p })}
                  onDragEnd={() => setMeasure(null)}
                />
              ))}
          </Layer>

          {/* Fog and drawings. */}
          <Layer listening={tool === 'erase'}>
            {map.fog.enabled && show('fog') && <FogShape map={map} gm={isGm} />}
            {show('drawings') &&
              map.drawings
                .filter((d) => isGm || !d.gmOnly)
                .map((d) => (
                  <Line
                    key={d.id}
                    points={d.points}
                    stroke={d.color}
                    strokeWidth={d.width / Math.max(camera.scale, 0.5)}
                    lineCap="round"
                    lineJoin="round"
                    tension={0.3}
                    dash={d.gmOnly ? [8, 6] : undefined}
                    hitStrokeWidth={16}
                    onClick={() =>
                      props.onChange?.(
                        (m) => ({ ...m, drawings: m.drawings.filter((x) => x.id !== d.id) }),
                        props.labels.drawingErased,
                      )
                    }
                  />
                ))}
            {isGm &&
              show('gm') &&
              gmNotes.map((el) => (
                <ElementNode key={el.id} el={el} map={map} {...elementHandlers(el)} />
              ))}
          </Layer>

          {/* Overlays: previews, measure, areas, pings. */}
          <Layer listening={false}>
            {gesture?.kind === 'fog' &&
              [...gesture.cells.values()].map((c) => (
                <Line
                  key={`${c.col},${c.row}`}
                  points={cellPolygon(map.grid, c).flatMap((p) => [p.x, p.y])}
                  closed
                  fill={gesture.reveal ? 'rgba(217,164,65,0.35)' : 'rgba(20,19,28,0.45)'}
                />
              ))}
            {gesture?.kind === 'rect' && (
              <Rect
                x={Math.min(gesture.from.x, gesture.to.x)}
                y={Math.min(gesture.from.y, gesture.to.y)}
                width={Math.abs(gesture.to.x - gesture.from.x)}
                height={Math.abs(gesture.to.y - gesture.from.y)}
                stroke="#6d5bd0"
                strokeWidth={2 / camera.scale}
                dash={[8 / camera.scale, 4 / camera.scale]}
                fill="rgba(109,91,208,0.12)"
              />
            )}
            {gesture?.kind === 'draw' && (
              <Line
                points={gesture.points}
                stroke={useMapViewStore.getState().drawColor}
                strokeWidth={4 / Math.max(camera.scale, 0.5)}
                lineCap="round"
                tension={0.3}
              />
            )}
            {chain.length > 0 && pointer && (
              <Line
                points={[
                  chain[chain.length - 1]!.x,
                  chain[chain.length - 1]!.y,
                  snapToVertex(map.grid, pointer).x,
                  snapToVertex(map.grid, pointer).y,
                ]}
                stroke={tool === 'door' ? '#8a5a2b' : '#2b2233'}
                strokeWidth={6 / Math.max(camera.scale, 0.5)}
                opacity={0.6}
                dash={[10, 6]}
              />
            )}
            {(tool === 'fogReveal' || tool === 'fogHide') && pointer && !gesture && (
              <Circle
                x={pointer.x}
                y={pointer.y}
                radius={(useMapViewStore.getState().brush * map.grid.size) / 2}
                stroke="#6d5bd0"
                strokeWidth={2 / camera.scale}
                dash={[6, 4]}
              />
            )}
            {shownArea && <AreaNode area={shownArea} scale={camera.scale} />}
            {measureLine && (
              <MeasureNode
                map={map}
                rules={props.rules}
                from={measureLine.from}
                to={measureLine.to}
                scale={camera.scale}
                label={props.labels.measure}
              />
            )}
            {pings.map((p) => (
              <PingNode key={p.id} x={p.x} y={p.y} scale={camera.scale} id={p.id} />
            ))}
          </Layer>
        </Stage>
      )}
    </div>
  )

  function elementHandlers(el: MapElement) {
    const editable = mode === 'edit' && tool === 'select' && Boolean(props.onChange)
    return {
      selected: selection.type === 'element' && selection.id === el.id,
      draggable: editable,
      onSelect: () => {
        if (tool !== 'select') return
        useMapViewStore.getState().select({ type: 'element', id: el.id })
        if (mode === 'play') props.onElementOpen?.(el.id)
      },
      onMoved: (x: number, y: number) =>
        props.onChange?.(
          (m) => ({ ...m, elements: m.elements.map((e) => (e.id === el.id ? { ...e, x, y } : e)) }),
          props.labels.elementMoved,
        ),
    }
  }
}

function isTyping(target: EventTarget | null) {
  return target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

function GridShape({ map }: { map: GameMap }) {
  const { grid } = map
  return (
    <Shape
      listening={false}
      perfectDrawEnabled={false}
      sceneFunc={(ctx) => {
        const c = (ctx as unknown as { _context: CanvasRenderingContext2D })._context
        c.save()
        c.strokeStyle = grid.color
        c.globalAlpha = grid.opacity
        c.lineWidth = 1
        c.beginPath()
        if (grid.type === 'square') {
          const { width, height } = gridExtent(map)
          for (let col = 0; col <= map.cols; col++) {
            const x = grid.offsetX + col * grid.size
            c.moveTo(x, grid.offsetY)
            c.lineTo(x, grid.offsetY + height)
          }
          for (let row = 0; row <= map.rows; row++) {
            const y = grid.offsetY + row * grid.size
            c.moveTo(grid.offsetX, y)
            c.lineTo(grid.offsetX + width, y)
          }
        } else {
          for (let row = 0; row < map.rows; row++)
            for (let col = 0; col < map.cols; col++) {
              const poly = cellPolygon(grid, { col, row })
              c.moveTo(poly[0]!.x, poly[0]!.y)
              for (const p of poly.slice(1)) c.lineTo(p.x, p.y)
              c.closePath()
            }
        }
        c.stroke()
        c.restore()
      }}
    />
  )
}

function FogShape({ map, gm }: { map: GameMap; gm: boolean }) {
  return (
    <Shape
      listening={false}
      perfectDrawEnabled={false}
      sceneFunc={(ctx) => {
        const c = (ctx as unknown as { _context: CanvasRenderingContext2D })._context
        c.save()
        c.fillStyle = gm ? 'rgba(20, 19, 28, 0.55)' : '#0b0a10'
        c.beginPath()
        for (let row = 0; row < map.rows; row++)
          for (let col = 0; col < map.cols; col++) {
            if (map.fog.revealed[row * map.cols + col] === '1') continue
            const poly = cellPolygon(map.grid, { col, row })
            // Slightly enlarged so neighbouring cells leave no seams.
            const cx = poly.reduce((s, p) => s + p.x, 0) / poly.length
            const cy = poly.reduce((s, p) => s + p.y, 0) / poly.length
            const grow = (p: Point) => ({ x: cx + (p.x - cx) * 1.02, y: cy + (p.y - cy) * 1.02 })
            const first = grow(poly[0]!)
            c.moveTo(first.x, first.y)
            for (const p of poly.slice(1).map(grow)) c.lineTo(p.x, p.y)
            c.closePath()
          }
        c.fill()
        c.restore()
      }}
    />
  )
}

function ElementNode({
  el,
  map,
  selected,
  draggable,
  onSelect,
  onMoved,
}: {
  el: MapElement
  map: GameMap
  selected: boolean
  draggable: boolean
  onSelect: () => void
  onMoved: (x: number, y: number) => void
}) {
  const box = elementBox(map, el)
  return (
    <Group
      x={box.x + box.w / 2}
      y={box.y + box.h / 2}
      offsetX={box.w / 2}
      offsetY={box.h / 2}
      rotation={el.rotation}
      opacity={el.hidden ? 0.55 : 1}
      draggable={draggable}
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e) => {
        const node = e.target
        const left = node.x() - box.w / 2
        const top = node.y() - box.h / 2
        const x = Math.round((left - map.grid.offsetX) / map.grid.size)
        const y = Math.round((top - map.grid.offsetY) / map.grid.size)
        node.position({ x: box.x + box.w / 2, y: box.y + box.h / 2 })
        onMoved(x, y)
      }}
    >
      <Shape
        width={box.w}
        height={box.h}
        sceneFunc={(ctx, shape) => {
          const c = (ctx as unknown as { _context: CanvasRenderingContext2D })._context
          drawElement(c, el, box.w, box.h)
          ctx.fillStrokeShape(shape)
        }}
        hitFunc={(ctx, shape) => {
          ctx.beginPath()
          ctx.rect(0, 0, box.w, box.h)
          ctx.closePath()
          ctx.fillStrokeShape(shape)
        }}
      />
      {el.label && (
        <Text
          text={el.label}
          y={box.h + 2}
          width={box.w}
          align="center"
          fontSize={Math.max(10, map.grid.size * 0.22)}
          fill="#2b2233"
          listening={false}
        />
      )}
      {selected && (
        <Rect
          width={box.w}
          height={box.h}
          stroke="#6d5bd0"
          strokeWidth={3}
          dash={[8, 4]}
          listening={false}
        />
      )}
    </Group>
  )
}

function WallNode({
  wall,
  selected,
  scale,
  onSelect,
}: {
  wall: Wall
  selected: boolean
  scale: number
  onSelect: () => void
}) {
  const door = wall.kind === 'door'
  const open = door && wall.door?.open
  const width = (door ? 9 : 6) / Math.max(scale, 0.6)
  return (
    <Group onClick={onSelect} onTap={onSelect}>
      <Line
        points={[wall.x1, wall.y1, wall.x2, wall.y2]}
        stroke={selected ? '#6d5bd0' : door ? '#8a5a2b' : '#2b2233'}
        strokeWidth={width}
        lineCap="round"
        dash={open ? [width * 1.5, width * 1.5] : undefined}
        hitStrokeWidth={18}
      />
      {door && wall.door?.locked && (
        <Circle
          x={(wall.x1 + wall.x2) / 2}
          y={(wall.y1 + wall.y2) / 2}
          radius={width * 0.9}
          fill="#d9a441"
          stroke="#2b2233"
          strokeWidth={1.5}
          listening={false}
        />
      )}
    </Group>
  )
}

/**
 * Callbacks are recreated on every canvas render (camera moves included);
 * tokens only re-render when their data changes, which keeps zoom and pan
 * smooth with hundreds of tokens (D-233).
 */
function sameData<P extends object>(a: P, b: P) {
  return (Object.keys(b) as (keyof P)[]).every(
    (k) => typeof b[k] === 'function' || Object.is(a[k], b[k]),
  )
}

const TokenNode = memo(function TokenNode({
  token,
  map,
  entity,
  rules,
  gm,
  selected,
  active,
  draggable,
  onSelect,
  onMoved,
  onDragMove,
  onDragEnd,
}: {
  token: Token
  map: GameMap
  entity: Entity
  rules: RulesConfig
  gm: boolean
  selected: boolean
  active: boolean
  draggable: boolean
  onSelect: (additive: boolean) => void
  onMoved: (cell: Cell, force: boolean) => boolean
  onDragMove: (p: Point) => void
  onDragEnd: () => void
}) {
  const center = tokenCenter(map.grid, token)
  const radius =
    (map.grid.type === 'hex' ? hexRadius(map.grid) * 0.85 : map.grid.size * 0.42) * token.size
  const portrait = useImage(entity.identity.portrait)
  const name = entityName(entity)
  const max = entityHpMax(entity, rules)
  const ratio = max > 0 ? Math.max(0, Math.min(1, entity.hp.current / max)) : 0
  const band = hpBand(entity.hp.current, max, rules.hp)
  const color = KIND_COLORS[entity.kind]
  const ring = Math.max(3, radius * 0.14)
  const dots = entity.conditions.slice(0, 4)
  const range = useMemo(() => {
    const cells =
      rules.movement.baseCells +
      rules.movement.perDexterity * effectiveStats(entity, rules).dexterity.total
    return cells > 0 ? cells * map.grid.size : 0
  }, [entity, rules, map.grid.size])
  const [dragging, setDragging] = useState(false)

  return (
    <Group
      x={center.x}
      y={center.y}
      draggable={draggable}
      opacity={token.hidden ? 0.5 : 1}
      onClick={(e) => onSelect(e.evt.shiftKey)}
      onTap={() => onSelect(false)}
      onDragStart={() => setDragging(true)}
      onDragMove={(e) => onDragMove({ x: e.target.x(), y: e.target.y() })}
      onDragEnd={(e) => {
        setDragging(false)
        onDragEnd()
        const node = e.target
        const cell = tokenCellAt(map.grid, { x: node.x(), y: node.y() }, token.size)
        const ok = inBounds(map, cell) && onMoved(cell, e.evt.shiftKey)
        // The store decides the final position: snap back if refused.
        if (!ok) node.position(center)
      }}
    >
      {dragging && range > 0 && (
        <Circle
          radius={range}
          fill="rgba(109,91,208,0.08)"
          stroke="#6d5bd0"
          strokeWidth={2}
          dash={[8, 6]}
          listening={false}
        />
      )}
      {active && (
        <Circle
          radius={radius + ring * 2.2}
          stroke="#d9a441"
          strokeWidth={ring}
          shadowColor="#d9a441"
          shadowBlur={12}
          listening={false}
        />
      )}
      {selected && (
        <Circle
          radius={radius + ring * 1.6}
          stroke="#6d5bd0"
          strokeWidth={2}
          dash={[6, 4]}
          listening={false}
        />
      )}
      <Circle radius={radius} fill={color} stroke="#ffffff" strokeWidth={1.5} />
      {portrait ? (
        <Group clipFunc={(ctx) => ctx.arc(0, 0, radius - 1, 0, Math.PI * 2)}>
          <KImage
            image={portrait}
            x={-radius}
            y={-radius}
            width={radius * 2}
            height={radius * 2}
            listening={false}
          />
        </Group>
      ) : (
        <Text
          text={name.slice(0, 2).toUpperCase()}
          x={-radius}
          y={-radius}
          width={radius * 2}
          height={radius * 2}
          align="center"
          verticalAlign="middle"
          fontSize={radius * 0.8}
          fontStyle="bold"
          fill="#ffffff"
          listening={false}
        />
      )}
      <Arc
        innerRadius={radius}
        outerRadius={radius + ring}
        angle={360}
        fill="rgba(0,0,0,0.35)"
        listening={false}
      />
      {(gm || entity.kind !== 'enemy') && (
        <Arc
          innerRadius={radius}
          outerRadius={radius + ring}
          angle={360 * ratio}
          rotation={-90}
          fill={BAND_COLORS[band]}
          listening={false}
        />
      )}
      {dots.map((c, i) => (
        <Circle
          key={c.id}
          x={radius * 0.75 - i * ring * 2.1}
          y={-radius * 0.85}
          radius={ring * 0.95}
          fill={CONDITION_DOT[c.color] ?? '#8a869c'}
          stroke="#ffffff"
          strokeWidth={1}
          listening={false}
        />
      ))}
      <Label y={radius + ring + 2} listening={false}>
        <Tag fill="rgba(31,29,43,0.78)" cornerRadius={4} pointerDirection="none" />
        <Text text={name} fontSize={Math.max(9, map.grid.size * 0.18)} padding={3} fill="#ffffff" />
      </Label>
    </Group>
  )
}, sameData)

function AreaNode({ area, scale }: { area: AreaShape; scale: number }) {
  const style = { fill: 'rgba(224,82,82,0.18)', stroke: '#e05252', strokeWidth: 2 / scale }
  switch (area.kind) {
    case 'circle':
      return <Circle x={area.center.x} y={area.center.y} radius={area.radius} {...style} />
    case 'square':
      return (
        <Rect
          x={area.center.x - area.half}
          y={area.center.y - area.half}
          width={area.half * 2}
          height={area.half * 2}
          {...style}
        />
      )
    case 'cone':
      return (
        <Arc
          x={area.origin.x}
          y={area.origin.y}
          innerRadius={0}
          outerRadius={area.length}
          angle={(area.angle * 180) / Math.PI}
          rotation={((area.direction - area.angle / 2) * 180) / Math.PI}
          {...style}
        />
      )
    case 'line': {
      const angle = Math.atan2(area.to.y - area.from.y, area.to.x - area.from.x)
      const length = Math.hypot(area.to.x - area.from.x, area.to.y - area.from.y)
      return (
        <Rect
          x={area.from.x}
          y={area.from.y}
          width={length}
          height={area.width}
          offsetY={area.width / 2}
          rotation={(angle * 180) / Math.PI}
          {...style}
        />
      )
    }
  }
}

function MeasureNode({
  map,
  rules,
  from,
  to,
  scale,
  label,
}: {
  map: GameMap
  rules: RulesConfig
  from: Point
  to: Point
  scale: number
  label: (cells: number, meters: number) => string
}) {
  const cells = cellDistance(
    map.grid,
    cellAt(map.grid, from),
    cellAt(map.grid, to),
    rules.grid.diagonal,
  )
  const meters = Math.round(cells * rules.grid.cellMeters * 10) / 10
  return (
    <Group>
      <Line
        points={[from.x, from.y, to.x, to.y]}
        stroke="#d9a441"
        strokeWidth={3 / scale}
        dash={[10 / scale, 6 / scale]}
      />
      <Circle x={from.x} y={from.y} radius={5 / scale} fill="#d9a441" />
      <Label x={to.x + 10 / scale} y={to.y + 10 / scale} scaleX={1 / scale} scaleY={1 / scale}>
        <Tag fill="#1f1d2b" cornerRadius={6} />
        <Text
          text={label(cells, meters)}
          fontSize={14}
          padding={6}
          fill="#ffffff"
          fontStyle="bold"
        />
      </Label>
    </Group>
  )
}

function PingNode({ id, x, y, scale }: { id: string; x: number; y: number; scale: number }) {
  const ref = useRef<Konva.Circle>(null)
  const drop = useMapViewStore((s) => s.dropPing)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    node.radius(4 / scale)
    node.opacity(1)
    const tween = node.to({
      radius: 60 / scale,
      opacity: 0,
      duration: 1.4,
      onFinish: () => drop(id),
    })
    return () => tween?.destroy?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <Group>
      <Circle ref={ref} x={x} y={y} stroke="#d9a441" strokeWidth={4 / scale} />
      <Circle x={x} y={y} radius={5 / scale} fill="#d9a441" />
    </Group>
  )
}
