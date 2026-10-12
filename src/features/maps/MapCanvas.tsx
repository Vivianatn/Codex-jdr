import Konva from 'konva'
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
import { useResolvedTheme } from '@/app/usePreferences'
import { useFxStore, type HpFx } from '@/stores/fxStore'
import { useMapViewStore, type Camera } from '@/stores/mapViewStore'
import { drawBoardIcon, type BoardIcon } from './boardIcons'
import {
  BOARD_DARK,
  BOARD_FONTS,
  BOARD_LIGHT,
  BOARD_PLAYERS,
  DA_CELL,
  type BoardTheme,
} from './boardTheme'
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
  /** Names of the campaign's maps, for passage labels (GM only). */
  mapNames?: Record<string, string>
  className?: string
}

/** Condition colours on tokens (the *-text tones of DA §2, readable on the plate). */
const CONDITION_DOT: Record<string, string> = {
  red: '#C23B3B',
  orange: '#C2621C',
  yellow: '#A87719',
  green: '#2E9A5E',
  blue: '#3A80CC',
  violet: '#7A4BB6',
  pink: '#B23D73',
  gray: '#8C8069',
}

/** Board palette: the players' window has its own, the GM follows the app theme. */
function useBoardTheme(viewer: 'gm' | 'players'): BoardTheme {
  const resolved = useResolvedTheme()
  if (viewer === 'players') return BOARD_PLAYERS
  return resolved === 'dark' ? BOARD_DARK : BOARD_LIGHT
}

/** Draws a board icon inside a Konva shape. */
function IconShape({
  icon,
  x,
  y,
  size,
  color,
}: {
  icon: BoardIcon
  x: number
  y: number
  size: number
  color: string
}) {
  return (
    <Shape
      listening={false}
      perfectDrawEnabled={false}
      sceneFunc={(ctx) => {
        const c = (ctx as unknown as { _context: CanvasRenderingContext2D })._context
        drawBoardIcon(c, icon, x, y, size, color)
      }}
    />
  )
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
  const hpFx = useFxStore((s) => s.hp)
  const theme = useBoardTheme(viewer)
  /** DA pixel sizes are given for a 70 px cell. */
  const u = map.grid.size / DA_CELL

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
      className={props.className ?? 'relative size-full overflow-hidden'}
      style={{ cursor, touchAction: 'none', background: theme.bg }}
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
                fill={theme.floor}
              />
            )}
            {theme.outline && (
              <Rect
                x={map.grid.offsetX}
                y={map.grid.offsetY}
                width={extent.width}
                height={extent.height}
                stroke={theme.outline}
                strokeWidth={1 / camera.scale}
                listening={false}
              />
            )}
            {map.grid.visible && show('grid') && (
              <GridShape map={map} theme={theme} scale={camera.scale} />
            )}
            {show('decor') &&
              decor.map((el) => (
                <ElementNode
                  key={el.id}
                  el={el}
                  map={map}
                  theme={theme}
                  gm={isGm}
                  {...elementHandlers(el)}
                />
              ))}
            {show('objects') &&
              objects.map((el) => (
                <ElementNode
                  key={el.id}
                  el={el}
                  map={map}
                  theme={theme}
                  gm={isGm}
                  linkName={el.link?.mapId ? props.mapNames?.[el.link.mapId] : undefined}
                  {...elementHandlers(el)}
                />
              ))}
            {show('walls') &&
              map.walls.map((w) => (
                <WallNode
                  key={w.id}
                  wall={w}
                  theme={theme}
                  u={u}
                  selected={selection.type === 'wall' && selection.id === w.id}
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
                  theme={theme}
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
            {/* Damage and healing float above the tokens (DA §7.3). */}
            {show('tokens') &&
              hpFx.map((fx) => {
                const token = tokens.find((tk) => tk.entityId === fx.entityId)
                if (!token) return null
                const same = hpFx.filter((x) => x.entityId === fx.entityId)
                const index = same.indexOf(fx)
                return (
                  <DamageFx
                    key={fx.id}
                    fx={fx}
                    at={tokenCenter(map.grid, token)}
                    cell={map.grid.size}
                    offset={(index - (same.length - 1) / 2) * 28 * u}
                  />
                )
              })}
          </Layer>

          {/* Fog and drawings. */}
          <Layer listening={tool === 'erase'}>
            {map.fog.enabled && show('fog') && (
              <FogShape map={map} theme={theme} scale={camera.scale} />
            )}
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
                <ElementNode
                  key={el.id}
                  el={el}
                  map={map}
                  theme={theme}
                  gm={isGm}
                  {...elementHandlers(el)}
                />
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
                  fill={gesture.reveal ? 'rgba(217,164,65,0.35)' : theme.fog.masked}
                />
              ))}
            {gesture?.kind === 'rect' && (
              <Rect
                x={Math.min(gesture.from.x, gesture.to.x)}
                y={Math.min(gesture.from.y, gesture.to.y)}
                width={Math.abs(gesture.to.x - gesture.from.x)}
                height={Math.abs(gesture.to.y - gesture.from.y)}
                stroke={theme.brush}
                strokeWidth={2 / camera.scale}
                dash={[8 / camera.scale, 4 / camera.scale]}
                fill={theme.area.fill}
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
                stroke={tool === 'door' ? theme.door.closed : theme.wall.color}
                strokeWidth={(tool === 'door' ? theme.door.thickness : theme.wall.width) * u}
                opacity={0.6}
                dash={[10, 6]}
              />
            )}
            {(tool === 'fogReveal' || tool === 'fogHide') && pointer && !gesture && (
              <Circle
                x={pointer.x}
                y={pointer.y}
                radius={(useMapViewStore.getState().brush * map.grid.size) / 2}
                stroke={theme.brush}
                strokeWidth={1 / camera.scale}
                dash={[4 / camera.scale, 4 / camera.scale]}
              />
            )}
            {shownArea && <AreaNode area={shownArea} scale={camera.scale} theme={theme} />}
            {measureLine && (
              <MeasureNode
                map={map}
                rules={props.rules}
                from={measureLine.from}
                to={measureLine.to}
                scale={camera.scale}
                theme={theme}
                label={props.labels.measure}
              />
            )}
            {pings.map((p) => (
              <PingNode
                key={p.id}
                x={p.x}
                y={p.y}
                scale={camera.scale}
                id={p.id}
                theme={theme}
                cell={map.grid.size}
              />
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
// Shapes (board theme: docs/CODEX-DA.md §9)
// ---------------------------------------------------------------------------

type Ctx2D = CanvasRenderingContext2D
const raw = (ctx: unknown) => (ctx as { _context: Ctx2D })._context

/** True when full animations are allowed (DA §7.2). */
function motionFull() {
  return (
    document.documentElement.dataset.motion === 'full' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function GridShape({ map, theme, scale }: { map: GameMap; theme: BoardTheme; scale: number }) {
  const { grid } = map
  // "auto" (new maps) follows the board theme; a colour chosen by the GM wins.
  const auto = grid.color === 'auto'
  return (
    <Shape
      listening={false}
      perfectDrawEnabled={false}
      sceneFunc={(ctx) => {
        const c = raw(ctx)
        c.save()
        c.lineWidth = theme.gridWidth / scale
        const stroke = (color: string, lines: (path: Ctx2D) => void) => {
          c.strokeStyle = color
          c.beginPath()
          lines(c)
          c.stroke()
        }
        if (!auto) c.globalAlpha = grid.opacity
        const minor = auto ? theme.grid : grid.color
        const major = auto ? theme.gridMajor : null
        if (grid.type === 'square') {
          const { width, height } = gridExtent(map)
          const lines = (keep: (i: number) => boolean) => (p: Ctx2D) => {
            for (let col = 0; col <= map.cols; col++) {
              if (!keep(col)) continue
              const x = grid.offsetX + col * grid.size
              p.moveTo(x, grid.offsetY)
              p.lineTo(x, grid.offsetY + height)
            }
            for (let row = 0; row <= map.rows; row++) {
              if (!keep(row)) continue
              const y = grid.offsetY + row * grid.size
              p.moveTo(grid.offsetX, y)
              p.lineTo(grid.offsetX + width, y)
            }
          }
          stroke(
            minor,
            lines((i) => !major || i % 5 !== 0),
          )
          if (major)
            stroke(
              major,
              lines((i) => i % 5 === 0),
            )
        } else {
          stroke(minor, (p) => {
            for (let row = 0; row < map.rows; row++)
              for (let col = 0; col < map.cols; col++) {
                const poly = cellPolygon(grid, { col, row })
                p.moveTo(poly[0]!.x, poly[0]!.y)
                for (const q of poly.slice(1)) p.lineTo(q.x, q.y)
                p.closePath()
              }
          })
        }
        c.restore()
      }}
    />
  )
}

function FogShape({ map, theme, scale }: { map: GameMap; theme: BoardTheme; scale: number }) {
  const u = map.grid.size / DA_CELL
  return (
    <Shape
      listening={false}
      perfectDrawEnabled={false}
      sceneFunc={(ctx) => {
        const c = raw(ctx)
        c.save()
        const path = new Path2D()
        for (let row = 0; row < map.rows; row++)
          for (let col = 0; col < map.cols; col++) {
            if (map.fog.revealed[row * map.cols + col] === '1') continue
            const poly = cellPolygon(map.grid, { col, row })
            // Slightly enlarged so neighbouring cells leave no seams.
            const cx = poly.reduce((s, p) => s + p.x, 0) / poly.length
            const cy = poly.reduce((s, p) => s + p.y, 0) / poly.length
            const grow = (p: Point) => ({ x: cx + (p.x - cx) * 1.02, y: cy + (p.y - cy) * 1.02 })
            const first = grow(poly[0]!)
            path.moveTo(first.x, first.y)
            for (const p of poly.slice(1).map(grow)) path.lineTo(p.x, p.y)
            path.closePath()
          }
        // Players: soft edge around what is revealed (DA §9.2).
        if (theme.fog.softEdge) c.filter = `blur(${(theme.fog.softEdge * u * scale) / 2}px)`
        c.fillStyle = theme.fog.masked
        c.fill(path)
        c.filter = 'none'
        // GM: diagonal hatching so the fog reads as fog over any picture.
        if (theme.fog.hatch) {
          c.clip(path)
          c.strokeStyle = theme.fog.hatch
          c.lineWidth = 2 * u
          const { width, height } = gridExtent(map)
          const step = 12 * u
          c.beginPath()
          for (let d = -height; d < width + height; d += step) {
            c.moveTo(map.grid.offsetX + d, map.grid.offsetY)
            c.lineTo(map.grid.offsetX + d - height, map.grid.offsetY + height)
          }
          c.stroke()
        }
        c.restore()
      }}
    />
  )
}

function SmallLabel({
  text,
  x,
  y,
  theme,
  u,
}: {
  text: string
  x: number
  y: number
  theme: BoardTheme
  u: number
}) {
  const l = theme.label
  const size = l.size * u
  // Konva has no auto-centring for labels: estimate the width.
  const width = text.length * size * 0.56 + 2 * l.padX * u
  return (
    <Label x={x - width / 2} y={y} listening={false}>
      <Tag fill={l.bg} cornerRadius={l.radius * u} />
      <Text
        text={text}
        width={width}
        align="center"
        fontFamily={BOARD_FONTS.body}
        fontStyle="600"
        fontSize={size}
        padding={l.padY * u}
        fill={l.text}
      />
    </Label>
  )
}

function ElementNode({
  el,
  map,
  theme,
  gm,
  linkName,
  selected,
  draggable,
  onSelect,
  onMoved,
}: {
  el: MapElement
  map: GameMap
  theme: BoardTheme
  gm: boolean
  linkName?: string
  selected: boolean
  draggable: boolean
  onSelect: () => void
  onMoved: (x: number, y: number) => void
}) {
  const box = elementBox(map, el)
  const u = map.grid.size / DA_CELL
  // GM view of things the players do not see: half transparent, crossed eye.
  const hiddenFromPlayers = gm && (el.hidden || Boolean(el.trap && !el.trap.detected))
  const label = el.label || (gm ? linkName : '') || ''
  return (
    <Group
      x={box.x + box.w / 2}
      y={box.y + box.h / 2}
      offsetX={box.w / 2}
      offsetY={box.h / 2}
      rotation={el.rotation}
      opacity={hiddenFromPlayers ? 0.5 : 1}
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
          drawElement(raw(ctx), el, box.w, box.h, theme, map.grid.size)
          ctx.fillStrokeShape(shape)
        }}
        hitFunc={(ctx, shape) => {
          ctx.beginPath()
          ctx.rect(0, 0, box.w, box.h)
          ctx.closePath()
          ctx.fillStrokeShape(shape)
        }}
      />
      {hiddenFromPlayers && (
        <IconShape
          icon="eyeOff"
          x={box.w - 9 * u}
          y={9 * u}
          size={14 * u}
          color={theme.token.hiddenEdge}
        />
      )}
      {label && <SmallLabel text={label} x={box.w / 2} y={box.h + 2 * u} theme={theme} u={u} />}
      {selected && (
        <Rect
          width={box.w}
          height={box.h}
          stroke={theme.token.selection ?? theme.brush}
          strokeWidth={2 * u}
          dash={[6 * u, 4 * u]}
          listening={false}
        />
      )}
    </Group>
  )
}

function WallNode({
  wall,
  theme,
  u,
  selected,
  onSelect,
}: {
  wall: Wall
  theme: BoardTheme
  u: number
  selected: boolean
  onSelect: () => void
}) {
  const points = [wall.x1, wall.y1, wall.x2, wall.y2]
  const hit = { hitStrokeWidth: 18 * u }
  const selection = selected && theme.token.selection

  if (wall.kind !== 'door' || !wall.door) {
    const w = theme.wall.width * u
    return (
      <Group onClick={onSelect} onTap={onSelect}>
        <Line
          points={points}
          stroke={theme.wall.outline}
          strokeWidth={w + 2 * theme.wall.outlineWidth * u}
          lineCap="round"
          lineJoin="round"
          listening={false}
        />
        <Line
          points={points}
          stroke={selection || theme.wall.color}
          strokeWidth={w}
          lineCap="round"
          lineJoin="round"
          {...hit}
        />
      </Group>
    )
  }

  const d = theme.door
  const door = wall.door
  const t = d.thickness * u
  const mid = { x: (wall.x1 + wall.x2) / 2, y: (wall.y1 + wall.y2) / 2 }
  if (door.open) {
    // Open: dashed outline of the door leaf.
    const len = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1) || 1
    const nx = (-(wall.y2 - wall.y1) / len) * (t / 2)
    const ny = ((wall.x2 - wall.x1) / len) * (t / 2)
    return (
      <Group onClick={onSelect} onTap={onSelect}>
        <Line
          points={[
            wall.x1 + nx,
            wall.y1 + ny,
            wall.x2 + nx,
            wall.y2 + ny,
            wall.x2 - nx,
            wall.y2 - ny,
            wall.x1 - nx,
            wall.y1 - ny,
          ]}
          closed
          stroke={selection || d.open}
          strokeWidth={d.openWidth * u}
          dash={[d.openDash[0] * u, d.openDash[1] * u]}
          fill="rgba(0,0,0,0)"
          {...hit}
        />
      </Group>
    )
  }
  const locked = door.locked && d.showLock
  return (
    <Group onClick={onSelect} onTap={onSelect}>
      <Line
        points={points}
        stroke={d.edge}
        strokeWidth={t + 2 * d.edgeWidth * u}
        lineCap="butt"
        listening={false}
      />
      <Line
        points={points}
        stroke={selection || (locked ? d.locked : d.closed)}
        strokeWidth={t}
        lineCap="butt"
        {...hit}
      />
      {locked && <IconShape icon="lock" x={mid.x} y={mid.y} size={12 * u} color="#FFFFFF" />}
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

/** Outline of a token: circle, or rounded square for enemies (DA §9.3). */
function tokenPath(c: Ctx2D, square: boolean, r: number) {
  c.beginPath()
  if (!square) {
    c.arc(0, 0, r, -Math.PI / 2, (Math.PI * 3) / 2)
    return 2 * Math.PI * r
  }
  const k = Math.min(r, 0.44 * r) // corner = 22 % of the side (2r)
  c.moveTo(0, -r)
  c.lineTo(r - k, -r)
  c.arcTo(r, -r, r, -r + k, k)
  c.lineTo(r, r - k)
  c.arcTo(r, r, r - k, r, k)
  c.lineTo(-r + k, r)
  c.arcTo(-r, r, -r, r - k, k)
  c.lineTo(-r, -r + k)
  c.arcTo(-r, -r, -r + k, -r, k)
  c.closePath()
  return 8 * (r - k) + 2 * Math.PI * k
}

const TokenNode = memo(function TokenNode({
  token,
  map,
  entity,
  rules,
  gm,
  theme,
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
  theme: BoardTheme
  selected: boolean
  active: boolean
  draggable: boolean
  onSelect: (additive: boolean) => void
  onMoved: (cell: Cell, force: boolean) => boolean
  onDragMove: (p: Point) => void
  onDragEnd: () => void
}) {
  const T = theme.token
  const u = map.grid.size / DA_CELL
  const center = tokenCenter(map.grid, token)
  const familiar = entity.kind === 'familiar'
  const square = entity.kind === 'enemy'
  // 0.86 of a cell for size 1, 1.86 for size 2…; familiars 0.66.
  const r =
    map.grid.type === 'hex'
      ? hexRadius(map.grid) * (familiar ? 0.66 : 0.86) * token.size
      : ((familiar ? 0.66 : token.size - 0.14) * map.grid.size) / 2
  const ring = T.ringWidth * u
  const edge = T.edgeWidth * u
  const inner = r - ring - edge
  const portrait = useImage(entity.identity.portrait)
  const name = entityName(entity)
  const max = entityHpMax(entity, rules)
  const ratio = max > 0 ? Math.max(0, Math.min(1, entity.hp.current / max)) : 0
  const band = hpBand(entity.hp.current, max, rules.hp)
  const down = entity.hp.current <= 0
  const showHp = gm || entity.kind !== 'enemy'
  const fill = T.kinds[entity.kind]
  const bandColor = { healthy: T.healthy, wounded: T.wounded, critical: T.critical, down: T.down }[
    band
  ]
  const conditions = entity.conditions.slice(0, 3)
  const more = entity.conditions.length - conditions.length
  const range = useMemo(() => {
    const cells =
      rules.movement.baseCells +
      rules.movement.perDexterity * effectiveStats(entity, rules).dexterity.total
    return cells > 0 ? cells * map.grid.size : 0
  }, [entity, rules, map.grid.size])
  const [dragging, setDragging] = useState(false)
  const [hover, setHover] = useState(false)
  const halo = useRef<Konva.Shape>(null)

  // Active token: soft pulse 0.55 → 1 → 0.55 over 1.6 s (DA §7.3).
  useEffect(() => {
    const node = halo.current
    if (!active || !node || !motionFull()) return
    const anim = new Konva.Animation((frame) => {
      const t = ((frame?.time ?? 0) % 1600) / 1600
      node.opacity(0.55 + 0.45 * Math.sin(t * Math.PI))
    }, node.getLayer())
    anim.start()
    return () => {
      anim.stop()
    }
  }, [active])

  // Names: allies always; enemies on hover, selection or during their turn.
  // The players never see an enemy's name.
  const showName = entity.kind !== 'enemy' ? true : gm && (hover || selected || active)

  const body = (
    <>
      {dragging && range > 0 && T.moveFill && (
        <Circle
          radius={range}
          fill={T.moveFill}
          stroke={T.selection ?? undefined}
          strokeWidth={u}
          dash={[8 * u, 6 * u]}
          listening={false}
        />
      )}
      {active && (
        <Shape
          ref={halo}
          listening={false}
          sceneFunc={(ctx) => {
            const c = raw(ctx)
            c.save()
            tokenPath(c, square, r + 3 * u + (T.active.width * u) / 2)
            c.strokeStyle = T.active.color
            c.lineWidth = T.active.width * u
            c.shadowColor = T.active.glow
            c.shadowBlur = T.active.blur * u
            c.stroke()
            c.restore()
          }}
        />
      )}
      {selected && T.selection && (
        <Shape
          listening={false}
          sceneFunc={(ctx) => {
            const c = raw(ctx)
            c.save()
            tokenPath(c, square, r + 4 * u + u)
            c.setLineDash([6 * u, 4 * u])
            c.strokeStyle = T.selection!
            c.lineWidth = 2 * u
            c.stroke()
            c.restore()
          }}
        />
      )}
      {/* Fill, ring track, HP ring and edge, drawn in one pass. */}
      <Shape
        sceneFunc={(ctx, shape) => {
          const c = raw(ctx)
          c.save()
          tokenPath(c, square, r - edge / 2)
          c.fillStyle = fill
          c.fill()
          // Ring track and HP.
          const mid = r - edge - ring / 2
          const perimeter = tokenPath(c, square, mid)
          c.lineWidth = ring
          c.strokeStyle = down ? T.down : T.ringTrack
          c.stroke()
          if (showHp && !down && ratio > 0) {
            tokenPath(c, square, mid)
            c.setLineDash([perimeter * ratio, perimeter])
            c.strokeStyle = bandColor
            c.stroke()
            c.setLineDash([])
          }
          // Edge (dashed when hidden from the players).
          tokenPath(c, square, r - edge / 2)
          if (token.hidden && gm) c.setLineDash([4 * u, 4 * u])
          c.lineWidth = edge
          c.strokeStyle = token.hidden && gm ? T.hiddenEdge : T.edge
          c.stroke()
          c.restore()
          ctx.fillStrokeShape(shape)
        }}
        hitFunc={(ctx, shape) => {
          const c = raw(ctx)
          tokenPath(c, square, r)
          ctx.fillStrokeShape(shape)
        }}
      />
      {portrait ? (
        <Group
          clipFunc={(ctx) => {
            tokenPath(ctx as unknown as Ctx2D, square, inner)
          }}
          opacity={down ? 0.4 : 1}
          listening={false}
        >
          <KImage image={portrait} x={-inner} y={-inner} width={inner * 2} height={inner * 2} />
        </Group>
      ) : (
        <Text
          text={name.slice(0, 2).toUpperCase()}
          x={-inner}
          y={-inner}
          width={inner * 2}
          height={inner * 2}
          align="center"
          verticalAlign="middle"
          fontFamily={BOARD_FONTS.body}
          fontStyle="700"
          fontSize={inner * 0.8}
          fill="#FFFFFF"
          opacity={down ? 0.5 : 1}
          listening={false}
        />
      )}
      {down && <IconShape icon="skull" x={0} y={0} size={16 * u} color="#FFFFFF" />}
      {showHp && entity.hp.temp > 0 && max > 0 && (
        <Arc
          innerRadius={r + 2 * u}
          outerRadius={r + 4 * u}
          angle={360 * Math.min(1, entity.hp.temp / max)}
          rotation={-90}
          fill={T.temp}
          listening={false}
        />
      )}
      {(familiar || entity.kind === 'ally') && (
        <Group x={r * 0.72} y={r * 0.72} listening={false}>
          <Circle radius={9 * u} fill={T.edge} />
          <Circle radius={7 * u} fill={fill} />
          <IconShape icon={familiar ? 'paw' : 'shield'} x={0} y={0} size={10 * u} color="#FFFFFF" />
        </Group>
      )}
      {conditions.map((cond, i) => {
        // On the upper-right arc of the token.
        const a = -Math.PI / 2 + (i + 0.6) * 0.62
        const size = T.condition.size * u
        return (
          <Group
            key={cond.id}
            x={Math.cos(a) * (r + size * 0.1)}
            y={Math.sin(a) * (r + size * 0.1)}
            listening={false}
          >
            <Circle
              radius={size / 2}
              fill={T.condition.bg}
              stroke={T.condition.stroke}
              strokeWidth={u}
            />
            <Circle radius={size * 0.28} fill={CONDITION_DOT[cond.color] ?? CONDITION_DOT.gray} />
          </Group>
        )
      })}
      {more > 0 && (
        <Text
          text={`+${more}`}
          x={r * 0.55}
          y={-r * 1.25}
          fontFamily={BOARD_FONTS.body}
          fontStyle="700"
          fontSize={10 * u}
          fill={T.condition.stroke}
          listening={false}
        />
      )}
      {token.hidden && gm && (
        <IconShape icon="eyeOff" x={-r * 0.72} y={-r * 0.72} size={14 * u} color={T.hiddenEdge} />
      )}
      {showName && <SmallLabel text={name} x={0} y={r + theme.label.gap * u} theme={theme} u={u} />}
    </>
  )

  return (
    <>
      {dragging && (
        <Group x={center.x} y={center.y} opacity={0.35} listening={false}>
          <Shape
            sceneFunc={(ctx) => {
              const c = raw(ctx)
              tokenPath(c, square, r)
              c.fillStyle = fill
              c.fill()
            }}
          />
        </Group>
      )}
      <Group
        x={center.x}
        y={center.y}
        draggable={draggable}
        opacity={token.hidden ? 0.45 : 1}
        onClick={(e) => onSelect(e.evt.shiftKey)}
        onTap={() => onSelect(false)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
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
        {body}
      </Group>
    </>
  )
}, sameData)

function AreaNode({ area, scale, theme }: { area: AreaShape; scale: number; theme: BoardTheme }) {
  const style = {
    fill: theme.area.fill,
    stroke: theme.area.stroke,
    strokeWidth: theme.area.width / scale,
  }
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
  theme,
  label,
}: {
  map: GameMap
  rules: RulesConfig
  from: Point
  to: Point
  scale: number
  theme: BoardTheme
  label: (cells: number, meters: number) => string
}) {
  const m = theme.measure
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
        stroke={m.line}
        strokeWidth={m.width / scale}
        dash={[m.dash[0] / scale, m.dash[1] / scale]}
      />
      <Circle x={from.x} y={from.y} radius={4 / scale} fill={m.line} />
      <Circle x={to.x} y={to.y} radius={4 / scale} fill={m.line} />
      <Label x={to.x + 12 / scale} y={to.y + 12 / scale} scaleX={1 / scale} scaleY={1 / scale}>
        <Tag fill={m.bubble} cornerRadius={999} />
        <Text
          text={label(cells, meters)}
          fontFamily={BOARD_FONTS.body}
          fontStyle="700"
          fontSize={m.font}
          padding={Math.round(m.font * 0.45)}
          fill={m.bubbleText}
        />
      </Label>
    </Group>
  )
}

/** Ping: three rings from 0.4 to 1.6 cell, 1.2 s, staggered 200 ms, twice (DA §7.3). */
function PingNode({
  id,
  x,
  y,
  scale,
  theme,
  cell,
}: {
  id: string
  x: number
  y: number
  scale: number
  theme: BoardTheme
  cell: number
}) {
  const rings = useRef<(Konva.Circle | null)[]>([])
  const drop = useMapViewStore((s) => s.dropPing)
  useEffect(() => {
    const full = motionFull()
    const tweens: Konva.Tween[] = []
    const timers: number[] = []
    const play = (round: number) =>
      rings.current.forEach((node, i) => {
        if (!node) return
        timers.push(
          window.setTimeout(
            () => {
              node.radius(0.2 * cell)
              node.opacity(1)
              const tween = new Konva.Tween({
                node,
                radius: 0.8 * cell,
                opacity: 0,
                duration: 1.2,
                easing: Konva.Easings.EaseOut,
              })
              tweens.push(tween)
              tween.play()
            },
            round * 1400 + i * 200,
          ),
        )
      })
    if (full) {
      play(0)
      play(1)
    } else {
      rings.current[0]?.radius(0.6 * cell)
    }
    timers.push(window.setTimeout(() => drop(id), full ? 3200 : 1200))
    return () => {
      timers.forEach((t) => window.clearTimeout(t))
      tweens.forEach((t) => t.destroy())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <Group listening={false}>
      {[0, 1, 2].map((i) => (
        <Circle
          key={i}
          ref={(n) => {
            rings.current[i] = n
          }}
          x={x}
          y={y}
          radius={0.2 * cell}
          opacity={i === 0 ? 1 : 0}
          stroke={theme.ping.color}
          strokeWidth={theme.ping.width / scale}
        />
      ))}
      <Circle x={x} y={y} radius={theme.ping.dot / 2 / scale} fill={theme.ping.color} />
    </Group>
  )
}

/**
 * Floating "−8" above a token (DA §7.3): rises 32 px, pops to 1.15, fades
 * from 700 to 1000 ms; a damaged token flashes red. Reduced motion: shown
 * in place, then faded.
 */
function DamageFx({ fx, at, cell, offset }: { fx: HpFx; at: Point; cell: number; offset: number }) {
  const text = useRef<Konva.Text>(null)
  const flash = useRef<Konva.Circle>(null)
  const drop = useFxStore((s) => s.dropHp)
  const u = cell / DA_CELL
  const size = (fx.severe ? 40 : 28) * u
  const color =
    fx.kind === 'damage'
      ? fx.severe
        ? '#EBC274'
        : '#F28B82'
      : fx.kind === 'heal'
        ? '#7BD6A1'
        : '#8DBDF0'
  const label = `${fx.kind === 'damage' ? '−' : '+'}${fx.amount}`
  useEffect(() => {
    const node = text.current
    const full = motionFull()
    const tweens: Konva.Tween[] = []
    if (node && full) {
      node.scale({ x: 0.8, y: 0.8 })
      tweens.push(
        new Konva.Tween({ node, scaleX: 1.15, scaleY: 1.15, duration: 0.12 }),
        new Konva.Tween({ node, y: node.y() - 32 * u, duration: 1, easing: Konva.Easings.EaseOut }),
      )
      tweens.forEach((t) => t.play())
      window.setTimeout(() => node.to({ scaleX: 1, scaleY: 1, duration: 0.15 }), 120)
      window.setTimeout(() => node.to({ opacity: 0, duration: 0.3 }), 700)
    } else if (node) {
      window.setTimeout(() => node.to({ opacity: 0, duration: 0.15 }), 800)
    }
    const f = flash.current
    if (f && fx.kind === 'damage') {
      f.opacity(full ? 0 : 0.6)
      if (full)
        f.to({ opacity: 1, duration: 0.12, onFinish: () => f.to({ opacity: 0, duration: 0.12 }) })
      else window.setTimeout(() => f.opacity(0), 200)
    }
    const timer = window.setTimeout(() => drop(fx.id), 1100)
    return () => {
      window.clearTimeout(timer)
      tweens.forEach((t) => t.destroy())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <Group listening={false}>
      {fx.kind === 'damage' && (
        <Circle
          ref={flash}
          x={at.x}
          y={at.y}
          radius={cell * 0.45}
          fill="rgba(227,93,93,0.45)"
          opacity={0}
        />
      )}
      <Text
        ref={text}
        text={label}
        x={at.x + offset}
        y={at.y - cell * 0.6}
        offsetX={(label.length * size * 0.62) / 2}
        offsetY={size / 2}
        fontFamily={BOARD_FONTS.display}
        fontStyle="700"
        fontSize={size}
        fill={color}
        stroke="#15110D"
        strokeWidth={3 * u}
        fillAfterStrokeEnabled
      />
    </Group>
  )
}
