import type { Item, StatKey } from './types'
import { clamp } from '@/lib/numbers'
import { compareText } from '@/lib/text'

/**
 * Battle maps (SPEC §5, D-228). Pure data and geometry: no rendering here.
 *
 * Coordinates: "map pixels" (px) are the map's own space, independent of
 * zoom. Cells are addressed by (col, row); hex grids use pointy-top hexes in
 * "odd-r" offset layout (odd rows shifted right by half a cell).
 */

export type GridType = 'square' | 'hex'

export interface GridSettings {
  type: GridType
  /** Square: side of a cell. Hex: width of a hex (flat side to flat side). In px. */
  size: number
  /** Where cell (0, 0) starts, in px — moved by the calibration tool. */
  offsetX: number
  offsetY: number
  visible: boolean
  color: string
  /** 0–1 */
  opacity: number
}

export interface MapBackground {
  /** Image in the asset table (kept out of the map record: maps change often). */
  assetId: string | null
  x: number
  y: number
  /** Image pixels → map pixels. */
  scale: number
  opacity: number
}

export const DECOR_KINDS = [
  'tree',
  'bush',
  'rock',
  'water',
  'table',
  'chair',
  'bed',
  'barrel',
  'crate',
  'pillar',
  'statue',
  'rug',
  'torch',
  'stairs',
] as const
export type DecorKind = (typeof DECOR_KINDS)[number]

export const OBJECT_KINDS = ['chest', 'trap', 'lever', 'link', 'image', 'npc', 'note'] as const
export type ObjectKind = (typeof OBJECT_KINDS)[number]

export type ElementKind = DecorKind | ObjectKind

export interface TrapData {
  /** Malus on the Wisdom (Perception) check to spot it. */
  difficulty: number
  /** Spotted (by the group or the GM): drawn on the players' view. */
  detected: boolean
  triggered: boolean
  effect: { kind: 'none' | 'damage' | 'condition'; expression: string; conditionId: string | null }
}

export interface MapElement {
  id: string
  kind: ElementKind
  /** decor & objects are seen by players; gm = GM annotations, never shown to players. */
  layer: 'decor' | 'objects' | 'gm'
  /** Top-left, in cells (may be fractional when snapping is off). */
  x: number
  y: number
  /** Size in cells. */
  w: number
  h: number
  /** Degrees, clockwise. */
  rotation: number
  label: string
  /** Hidden from players until revealed (secret door, ambush, unspotted trap). */
  hidden: boolean
  chest?: { items: Item[]; opened: boolean }
  trap?: TrapData
  lever?: { on: boolean }
  link?: { mapId: string | null }
  /** Pictures the GM shows the players when clicking the zone, in order (D-259). */
  gallery?: { assetIds: string[] }
  npc?: { entityId: string | null }
  note?: { text: string }
}

export interface Wall {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
  kind: 'wall' | 'door'
  door?: {
    open: boolean
    locked: boolean
    /** malus on the lockpicking check */ difficulty: number
  }
}

export interface Token {
  id: string
  entityId: string
  col: number
  row: number
  /** Cells per side (1 = medium, 2 = large…). */
  size: number
  /** Only the GM sees it. */
  hidden: boolean
}

export interface Drawing {
  id: string
  points: number[]
  color: string
  width: number
  /** GM annotation: not shown to players. */
  gmOnly: boolean
}

export interface FogState {
  enabled: boolean
  /** One char per cell, row by row: '1' revealed, '0' hidden. */
  revealed: string
}

export interface VisionSettings {
  /** Reveal fog automatically around player tokens. */
  autoReveal: boolean
  /** In cells. */
  radius: number
  /** Walls and closed doors block sight (for the automatic reveal). */
  wallsBlockSight: boolean
}

export interface GameMap {
  id: string
  campaignId: string
  name: string
  cols: number
  rows: number
  grid: GridSettings
  background: MapBackground
  elements: MapElement[]
  walls: Wall[]
  tokens: Token[]
  drawings: Drawing[]
  fog: FogState
  vision: VisionSettings
  createdAt: number
  updatedAt: number
}

export interface Point {
  x: number
  y: number
}
export interface Cell {
  col: number
  row: number
}

export function newMap(
  campaignId: string,
  input: { name: string; cols?: number; rows?: number; gridType?: GridType; size?: number },
  now = Date.now(),
): GameMap {
  const cols = clampInt(input.cols ?? 30, 1, 200)
  const rows = clampInt(input.rows ?? 20, 1, 200)
  return {
    id: crypto.randomUUID(),
    campaignId,
    name: input.name,
    cols,
    rows,
    grid: {
      type: input.gridType ?? 'square',
      size: input.size ?? 64,
      offsetX: 0,
      offsetY: 0,
      visible: true,
      // 'auto' follows the board theme (DA §9.1); the GM may pick a colour.
      color: 'auto',
      opacity: 1,
    },
    background: { assetId: null, x: 0, y: 0, scale: 1, opacity: 1 },
    elements: [],
    walls: [],
    tokens: [],
    drawings: [],
    fog: { enabled: false, revealed: '0'.repeat(cols * rows) },
    vision: { autoReveal: false, radius: 6, wallsBlockSight: true },
    createdAt: now,
    updatedAt: now,
  }
}

/** Fills fields missing from older or hand-edited maps. */
export function normalizeMap(raw: GameMap): GameMap {
  const base = newMap(raw.campaignId, { name: raw.name, cols: raw.cols, rows: raw.rows })
  const map = {
    ...base,
    ...raw,
    grid: { ...base.grid, ...raw.grid },
    background: { ...base.background, ...raw.background },
    fog: { ...base.fog, ...raw.fog },
    vision: { ...base.vision, ...raw.vision },
  }
  if (map.fog.revealed.length !== map.cols * map.rows)
    map.fog = { ...map.fog, revealed: resizeFog(map.fog.revealed, map.cols, map.rows) }
  return map
}

function clampInt(value: number, min: number, max: number): number {
  return clamp(Math.round(value), min, max)
}

// ---------------------------------------------------------------------------
// Grid geometry
// ---------------------------------------------------------------------------

/** Hex outer radius (centre to corner) for a hex `size` wide. */
export function hexRadius(grid: GridSettings): number {
  return grid.size / Math.sqrt(3)
}

export function cellCenter(grid: GridSettings, cell: Cell): Point {
  if (grid.type === 'square')
    return {
      x: grid.offsetX + (cell.col + 0.5) * grid.size,
      y: grid.offsetY + (cell.row + 0.5) * grid.size,
    }
  const r = hexRadius(grid)
  return {
    x: grid.offsetX + grid.size * (cell.col + 0.5 * (cell.row & 1)) + grid.size / 2,
    y: grid.offsetY + r + cell.row * 1.5 * r,
  }
}

/** Corners of a cell, for drawing the grid and the fog. */
export function cellPolygon(grid: GridSettings, cell: Cell): Point[] {
  const c = cellCenter(grid, cell)
  if (grid.type === 'square') {
    const h = grid.size / 2
    return [
      { x: c.x - h, y: c.y - h },
      { x: c.x + h, y: c.y - h },
      { x: c.x + h, y: c.y + h },
      { x: c.x - h, y: c.y + h },
    ]
  }
  const r = hexRadius(grid)
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 30)
    return { x: c.x + r * Math.cos(angle), y: c.y + r * Math.sin(angle) }
  })
}

/** Cell under a point (may be outside the map). */
export function cellAt(grid: GridSettings, p: Point): Cell {
  if (grid.type === 'square')
    return {
      col: Math.floor((p.x - grid.offsetX) / grid.size),
      row: Math.floor((p.y - grid.offsetY) / grid.size),
    }
  // Pixel → axial (pointy-top), then round in cube space, then axial → odd-r.
  const r = hexRadius(grid)
  const x = p.x - grid.offsetX - grid.size / 2
  const y = p.y - grid.offsetY - r
  const q = ((Math.sqrt(3) / 3) * x - (1 / 3) * y) / r
  const rr = ((2 / 3) * y) / r
  const cube = cubeRound(q, -q - rr, rr)
  const row = cube.z
  const col = cube.x + (row - (row & 1)) / 2
  return { col, row }
}

function cubeRound(x: number, y: number, z: number) {
  let rx = Math.round(x)
  let ry = Math.round(y)
  let rz = Math.round(z)
  const dx = Math.abs(rx - x)
  const dy = Math.abs(ry - y)
  const dz = Math.abs(rz - z)
  if (dx > dy && dx > dz) rx = -ry - rz
  else if (dy > dz) ry = -rx - rz
  else rz = -rx - ry
  return { x: rx, y: ry, z: rz }
}

function toCube(cell: Cell) {
  const x = cell.col - (cell.row - (cell.row & 1)) / 2
  const z = cell.row
  return { x, y: -x - z, z }
}

export function inBounds(map: Pick<GameMap, 'cols' | 'rows'>, cell: Cell): boolean {
  return cell.col >= 0 && cell.row >= 0 && cell.col < map.cols && cell.row < map.rows
}

/** Size of the whole grid in px (background excluded). */
export function gridExtent(map: Pick<GameMap, 'cols' | 'rows' | 'grid'>): {
  width: number
  height: number
} {
  const { grid } = map
  if (grid.type === 'square') return { width: map.cols * grid.size, height: map.rows * grid.size }
  const r = hexRadius(grid)
  return { width: grid.size * (map.cols + 0.5), height: r * (1.5 * map.rows + 0.5) }
}

/** Nearest grid corner (square grids), used to draw walls along cell edges. */
export function snapToVertex(grid: GridSettings, p: Point): Point {
  if (grid.type === 'hex') return p
  return {
    x: grid.offsetX + Math.round((p.x - grid.offsetX) / grid.size) * grid.size,
    y: grid.offsetY + Math.round((p.y - grid.offsetY) / grid.size) * grid.size,
  }
}

export type DiagonalRule = 'euclidean' | 'chebyshev' | 'alternate'

/**
 * Distance in cells between two cells. Hex grids count steps between hexes;
 * square grids follow the campaign's diagonal rule (straight-line distance by
 * default, D-228).
 */
export function cellDistance(grid: GridSettings, a: Cell, b: Cell, diagonal: DiagonalRule): number {
  if (grid.type === 'hex') {
    const ca = toCube(a)
    const cb = toCube(b)
    return Math.max(Math.abs(ca.x - cb.x), Math.abs(ca.y - cb.y), Math.abs(ca.z - cb.z))
  }
  const dx = Math.abs(a.col - b.col)
  const dy = Math.abs(a.row - b.row)
  if (diagonal === 'chebyshev') return Math.max(dx, dy)
  if (diagonal === 'alternate') {
    const diag = Math.min(dx, dy)
    return Math.max(dx, dy) - diag + diag + Math.floor(diag / 2)
  }
  return Math.round(Math.hypot(dx, dy) * 10) / 10
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

/** Centre of a token (a size-N token covers N×N cells from its top-left cell). */
export function tokenCenter(grid: GridSettings, token: Pick<Token, 'col' | 'row' | 'size'>): Point {
  const first = cellCenter(grid, token)
  if (token.size <= 1) return first
  const offset = ((token.size - 1) * grid.size) / 2
  return { x: first.x + offset, y: first.y + (grid.type === 'square' ? offset : offset * 0.866) }
}

/** Top-left cell that centres a token of `size` on point `p`. */
export function tokenCellAt(grid: GridSettings, p: Point, size: number): Cell {
  const shift = ((size - 1) * grid.size) / 2
  return cellAt(grid, { x: p.x - shift, y: p.y - (grid.type === 'square' ? shift : shift * 0.866) })
}

export function tokenOf(map: GameMap, entityId: string): Token | undefined {
  return map.tokens.find((t) => t.entityId === entityId)
}

// ---------------------------------------------------------------------------
// Fog of war
// ---------------------------------------------------------------------------

export function fogIndex(map: Pick<GameMap, 'cols'>, cell: Cell): number {
  return cell.row * map.cols + cell.col
}

export function isRevealed(map: Pick<GameMap, 'cols' | 'rows' | 'fog'>, cell: Cell): boolean {
  if (!map.fog.enabled) return true
  if (!inBounds(map, cell)) return false
  return map.fog.revealed[fogIndex(map, cell)] === '1'
}

/** Reveals (or hides) the given cells; returns the same string if nothing changes. */
export function setFog(
  map: Pick<GameMap, 'cols' | 'rows' | 'fog'>,
  cells: readonly Cell[],
  revealed: boolean,
): string {
  const chars = map.fog.revealed.split('')
  const value = revealed ? '1' : '0'
  let changed = false
  for (const cell of cells) {
    if (!inBounds(map, cell)) continue
    const i = fogIndex(map, cell)
    if (chars[i] !== value) {
      chars[i] = value
      changed = true
    }
  }
  return changed ? chars.join('') : map.fog.revealed
}

export function fillFog(map: Pick<GameMap, 'cols' | 'rows'>, revealed: boolean): string {
  return (revealed ? '1' : '0').repeat(map.cols * map.rows)
}

/** Re-lays a fog string on a new size; the old width is deduced from the saved length. */
function resizeFog(revealed: string, cols: number, rows: number): string {
  const oldRows = Math.max(1, rows)
  const oldCols = revealed.length % oldRows === 0 ? revealed.length / oldRows : cols
  let out = ''
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) out += c < oldCols ? (revealed[r * oldCols + c] ?? '0') : '0'
  return out
}

/** Cells whose centre is within `radius` px of `p` (fog brush). */
export function cellsInCircle(map: GameMap, p: Point, radius: number): Cell[] {
  const cells: Cell[] = []
  const span = Math.ceil(radius / (map.grid.size * 0.75)) + 1
  const centre = cellAt(map.grid, p)
  for (let row = centre.row - span; row <= centre.row + span; row++)
    for (let col = centre.col - span; col <= centre.col + span; col++) {
      const cell = { col, row }
      if (!inBounds(map, cell)) continue
      const c = cellCenter(map.grid, cell)
      if (Math.hypot(c.x - p.x, c.y - p.y) <= radius) cells.push(cell)
    }
  return cells
}

/** Cells whose centre is inside the rectangle (fog "reveal room"). */
export function cellsInRect(map: GameMap, a: Point, b: Point): Cell[] {
  const minX = Math.min(a.x, b.x)
  const maxX = Math.max(a.x, b.x)
  const minY = Math.min(a.y, b.y)
  const maxY = Math.max(a.y, b.y)
  const cells: Cell[] = []
  for (let row = 0; row < map.rows; row++)
    for (let col = 0; col < map.cols; col++) {
      const c = cellCenter(map.grid, { col, row })
      if (c.x >= minX && c.x <= maxX && c.y >= minY && c.y <= maxY) cells.push({ col, row })
    }
  return cells
}

// ---------------------------------------------------------------------------
// Walls, doors, line of sight
// ---------------------------------------------------------------------------

/** Proper or touching intersection of segments ab and cd. */
export function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const cross = (p: Point, q: Point, r: Point) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)
  const d1 = cross(c, d, a)
  const d2 = cross(c, d, b)
  const d3 = cross(a, b, c)
  const d4 = cross(a, b, d)
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0)))
    return true
  const onSegment = (p: Point, q: Point, r: Point) =>
    Math.min(p.x, q.x) - 1e-9 <= r.x &&
    r.x <= Math.max(p.x, q.x) + 1e-9 &&
    Math.min(p.y, q.y) - 1e-9 <= r.y &&
    r.y <= Math.max(p.y, q.y) + 1e-9
  if (Math.abs(d1) < 1e-9 && onSegment(c, d, a)) return true
  if (Math.abs(d2) < 1e-9 && onSegment(c, d, b)) return true
  if (Math.abs(d3) < 1e-9 && onSegment(a, b, c)) return true
  if (Math.abs(d4) < 1e-9 && onSegment(a, b, d)) return true
  return false
}

/** Walls and closed doors stop movement and sight; open doors do not. */
export function isBlocking(wall: Wall): boolean {
  return wall.kind === 'wall' || !wall.door?.open
}

/** First blocking wall crossed by a straight move from `from` to `to`, if any. */
export function blockingWall(walls: readonly Wall[], from: Point, to: Point): Wall | undefined {
  return walls.find(
    (w) => isBlocking(w) && segmentsIntersect(from, to, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }),
  )
}

/**
 * Cells seen from `origin` within `radius` cells: their centre is in range and,
 * when walls block sight, no blocking wall stands in between.
 */
export function visibleCells(
  map: GameMap,
  origin: Point,
  radius: number,
  wallsBlockSight: boolean,
): Cell[] {
  const range = radius * map.grid.size
  const blockers = wallsBlockSight ? map.walls.filter(isBlocking) : []
  return cellsInCircle(map, origin, range).filter((cell) => {
    const c = cellCenter(map.grid, cell)
    return !blockers.some((w) =>
      segmentsIntersect(origin, c, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }),
    )
  })
}

/** Automatic reveal around the given tokens (player characters), if enabled. */
export function autoRevealFog(map: GameMap, viewers: readonly Token[]): string {
  if (!map.fog.enabled || !map.vision.autoReveal || viewers.length === 0) return map.fog.revealed
  const cells = viewers.flatMap((t) =>
    visibleCells(map, tokenCenter(map.grid, t), map.vision.radius, map.vision.wallsBlockSight),
  )
  return setFog(map, cells, true)
}

// ---------------------------------------------------------------------------
// Areas of effect
// ---------------------------------------------------------------------------

export type AreaShape =
  | { kind: 'circle'; center: Point; radius: number }
  | { kind: 'square'; center: Point; half: number }
  | { kind: 'cone'; origin: Point; direction: number; length: number; angle: number }
  | { kind: 'line'; from: Point; to: Point; width: number }

export function pointInArea(p: Point, area: AreaShape): boolean {
  switch (area.kind) {
    case 'circle':
      return Math.hypot(p.x - area.center.x, p.y - area.center.y) <= area.radius
    case 'square':
      return (
        Math.abs(p.x - area.center.x) <= area.half && Math.abs(p.y - area.center.y) <= area.half
      )
    case 'cone': {
      const dist = Math.hypot(p.x - area.origin.x, p.y - area.origin.y)
      if (dist > area.length) return false
      if (dist === 0) return true
      const angle = Math.atan2(p.y - area.origin.y, p.x - area.origin.x)
      let diff = Math.abs(angle - area.direction) % (2 * Math.PI)
      if (diff > Math.PI) diff = 2 * Math.PI - diff
      return diff <= area.angle / 2
    }
    case 'line': {
      const dx = area.to.x - area.from.x
      const dy = area.to.y - area.from.y
      const len2 = dx * dx + dy * dy
      const t = len2 === 0 ? 0 : ((p.x - area.from.x) * dx + (p.y - area.from.y) * dy) / len2
      if (t < 0 || t > 1) return false
      const qx = area.from.x + t * dx
      const qy = area.from.y + t * dy
      return Math.hypot(p.x - qx, p.y - qy) <= area.width / 2
    }
  }
}

/** Tokens whose centre lies in the area (they become the targets). */
export function tokensInArea(map: GameMap, area: AreaShape): Token[] {
  return map.tokens.filter((t) => pointInArea(tokenCenter(map.grid, t), area))
}

// ---------------------------------------------------------------------------
// Calibration: fit the grid to a background image
// ---------------------------------------------------------------------------

/**
 * The GM drags a box around N×N cells of the image (usually one). The grid
 * takes that cell size and starts at the box's top-left corner, shifted back
 * to the first whole cell.
 */
export function calibrateGrid(
  grid: GridSettings,
  a: Point,
  b: Point,
  cellsAcross = 1,
): GridSettings {
  const width = Math.abs(b.x - a.x)
  const height = Math.abs(b.y - a.y)
  const size = Math.max(8, (width + height) / 2 / Math.max(1, cellsAcross))
  const left = Math.min(a.x, b.x)
  const top = Math.min(a.y, b.y)
  const mod = (v: number) => ((v % size) + size) % size
  return { ...grid, size, offsetX: mod(left), offsetY: mod(top) }
}

// ---------------------------------------------------------------------------
// Objects
// ---------------------------------------------------------------------------

export function newElement(
  kind: ElementKind,
  at: Cell,
  input: Partial<MapElement> = {},
): MapElement {
  const object = (OBJECT_KINDS as readonly string[]).includes(kind)
  const base: MapElement = {
    id: crypto.randomUUID(),
    kind,
    // Notes and picture zones are the GM's tools: players never see them on the board.
    layer: kind === 'note' || kind === 'image' ? 'gm' : object ? 'objects' : 'decor',
    x: at.col,
    y: at.row,
    w: 1,
    h: 1,
    rotation: 0,
    label: '',
    hidden: kind === 'trap',
  }
  if (kind === 'chest') base.chest = { items: [], opened: false }
  if (kind === 'trap')
    base.trap = {
      difficulty: 0,
      detected: false,
      triggered: false,
      effect: { kind: 'none', expression: '', conditionId: null },
    }
  if (kind === 'lever') base.lever = { on: false }
  if (kind === 'link') base.link = { mapId: null }
  if (kind === 'image') Object.assign(base, { w: 2, h: 2, gallery: { assetIds: [] } })
  if (kind === 'npc') base.npc = { entityId: null }
  if (kind === 'note') base.note = { text: '' }
  return { ...base, ...input }
}

/** What players see: no GM layer, no hidden things, traps only once spotted. */
export function visibleToPlayers(element: MapElement): boolean {
  if (element.layer === 'gm' || element.hidden) return false
  if (element.trap && !element.trap.detected) return false
  return true
}

/** The perception check of a trap uses Wisdom (SPEC §4.8). */
export const PERCEPTION_STAT: StatKey = 'wisdom'

/** Box of an element in map pixels, before its rotation (around the box centre). */
export function elementBox(map: Pick<GameMap, 'grid'>, el: MapElement) {
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

function elementContains(map: Pick<GameMap, 'grid'>, el: MapElement, p: Point): boolean {
  const box = elementBox(map, el)
  const angle = (-el.rotation * Math.PI) / 180
  const dx = p.x - (box.x + box.w / 2)
  const dy = p.y - (box.y + box.h / 2)
  const x = dx * Math.cos(angle) - dy * Math.sin(angle)
  const y = dx * Math.sin(angle) + dy * Math.cos(angle)
  return Math.abs(x) <= box.w / 2 && Math.abs(y) <= box.h / 2
}

function coveredCells(at: Cell, size: number): Cell[] {
  const cells: Cell[] = []
  for (let dr = 0; dr < Math.max(1, size); dr++)
    for (let dc = 0; dc < Math.max(1, size); dc++)
      cells.push({ col: at.col + dc, row: at.row + dr })
  return cells
}

// ---------------------------------------------------------------------------
// Passages between maps (D-256)
// ---------------------------------------------------------------------------

/** A link the players can take: it leads to another map and is not hidden. */
export function isPassage(el: MapElement, fromMapId: string): boolean {
  return Boolean(el.link?.mapId) && el.link!.mapId !== fromMapId && !el.hidden
}

/** The passage a token of `size` touches when it stands at `at`, if any. */
export function passageAt(map: GameMap, at: Cell, size = 1): MapElement | undefined {
  const centres = coveredCells(at, size).map((c) => cellCenter(map.grid, c))
  return map.elements.find(
    (el) => isPassage(el, map.id) && centres.some((p) => elementContains(map, el, p)),
  )
}

/** Nearest free cell from `start`, spiralling out; tokens never stack, `avoid` cells are skipped. */
export function freeCellNear(
  map: GameMap,
  start: Cell,
  options: { ignoreEntityId?: string; avoid?: (cell: Cell) => boolean } = {},
): Cell {
  const taken = new Set(
    map.tokens
      .filter((tk) => tk.entityId !== options.ignoreEntityId)
      .map((tk) => `${tk.col},${tk.row}`),
  )
  const free = (cell: Cell) =>
    inBounds(map, cell) && !taken.has(`${cell.col},${cell.row}`) && !options.avoid?.(cell)
  for (let ring = 0; ring < Math.max(map.cols, map.rows); ring++)
    for (let dr = -ring; dr <= ring; dr++)
      for (let dc = -ring; dc <= ring; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring) continue
        const cell = { col: start.col + dc, row: start.row + dr }
        if (free(cell)) return cell
      }
  return start
}

/**
 * Where a token coming from `fromMapId` lands on `target`: beside the passage
 * leading back (a door has two sides), otherwise in the middle of the map.
 * Never on a passage, or the next step would send it straight back.
 */
export function arrivalCell(target: GameMap, fromMapId: string, entityId?: string): Cell {
  const back = target.elements.find((el) => el.link?.mapId === fromMapId)
  const start = back
    ? (() => {
        const box = elementBox(target, back)
        const cell = cellAt(target.grid, { x: box.x + box.w / 2, y: box.y + box.h / 2 })
        return {
          col: clamp(cell.col, 0, target.cols - 1),
          row: clamp(cell.row, 0, target.rows - 1),
        }
      })()
    : { col: Math.floor(target.cols / 2), row: Math.floor(target.rows / 2) }
  return freeCellNear(target, start, {
    ignoreEntityId: entityId,
    avoid: (cell) => passageAt(target, cell) !== undefined,
  })
}

/** Map where a character's token stands; `preferred` wins when it has one there. */
export function entityMapId(
  maps: Iterable<GameMap>,
  entityId: string,
  preferred?: string | null,
): string | null {
  let found: string | null = null
  for (const map of maps) {
    if (!map.tokens.some((tk) => tk.entityId === entityId)) continue
    if (map.id === preferred) return map.id
    found ??= map.id
  }
  return found
}

export interface MapTreeNode {
  map: GameMap
  /** Maps reached through this map's passages, each map listed once in the whole tree. */
  children: MapTreeNode[]
}

/**
 * Maps reachable from `rootIds` through passages, breadth first so each map
 * sits at its shortest path; `rest` holds the maps no passage leads to.
 */
export function mapTree(
  maps: Record<string, GameMap>,
  rootIds: readonly (string | null | undefined)[],
): { tree: MapTreeNode[]; rest: GameMap[] } {
  const seen = new Set<string>()
  const node = (map: GameMap): MapTreeNode => ({ map, children: [] })
  const tree: MapTreeNode[] = []
  const queue: MapTreeNode[] = []
  for (const id of rootIds) {
    const map = id ? maps[id] : undefined
    if (!map || seen.has(map.id)) continue
    seen.add(map.id)
    const root = node(map)
    tree.push(root)
    queue.push(root)
  }
  while (queue.length) {
    const parent = queue.shift()!
    for (const el of parent.map.elements) {
      const target = el.link?.mapId ? maps[el.link.mapId] : undefined
      if (!target || seen.has(target.id)) continue
      seen.add(target.id)
      const child = node(target)
      parent.children.push(child)
      queue.push(child)
    }
  }
  const rest = Object.values(maps)
    .filter((m) => !seen.has(m.id))
    .sort((a, b) => compareText(a.name, b.name))
  return { tree, rest }
}

/** The map with a passage to `targetId` on `cell` (D-258); one already there is retargeted. */
export function withPassage(map: GameMap, cell: Cell, targetId: string, label: string): GameMap {
  const existing = map.elements.find(
    (el) => el.kind === 'link' && Math.round(el.x) === cell.col && Math.round(el.y) === cell.row,
  )
  if (existing)
    return {
      ...map,
      elements: map.elements.map((el) =>
        el.id === existing.id ? { ...el, link: { mapId: targetId }, label } : el,
      ),
    }
  return {
    ...map,
    elements: [...map.elements, newElement('link', cell, { link: { mapId: targetId }, label })],
  }
}

/** Passages of `map` that lead to `targetId`. */
export function passagesTo(map: GameMap, targetId: string): MapElement[] {
  return map.elements.filter((el) => el.link?.mapId === targetId)
}

/**
 * A door has two sides (D-259): `target` gets a passage back to `from` unless
 * it already has one. It stands where the door stands on `from` (kept inside
 * the target), on the nearest cell that is neither a passage nor a token.
 */
export function withReturnPassage(
  target: GameMap,
  from: Pick<GameMap, 'id'>,
  door: Pick<MapElement, 'x' | 'y'>,
  label: string,
): GameMap {
  if (target.id === from.id || passagesTo(target, from.id).length > 0) return target
  const start = {
    col: clamp(Math.round(door.x), 0, target.cols - 1),
    row: clamp(Math.round(door.y), 0, target.rows - 1),
  }
  const cell = freeCellNear(target, start, { avoid: (c) => passageAt(target, c) !== undefined })
  return withPassage(target, cell, from.id, label)
}

/**
 * The map with `entity`'s token on it (D-259): placed at `at` (or the middle)
 * on the nearest free cell, or moved there when it already stands on the map.
 * Enemies start hidden under the fog of war.
 */
export function withToken(map: GameMap, entity: { id: string; kind: string }, at?: Cell): GameMap {
  const centre = { col: Math.floor(map.cols / 2), row: Math.floor(map.rows / 2) }
  const cell = freeCellNear(map, at && inBounds(map, at) ? at : centre, {
    ignoreEntityId: entity.id,
  })
  const existing = map.tokens.find((tk) => tk.entityId === entity.id)
  return {
    ...map,
    tokens: existing
      ? map.tokens.map((tk) => (tk.id === existing.id ? { ...tk, ...cell } : tk))
      : [
          ...map.tokens,
          {
            id: crypto.randomUUID(),
            entityId: entity.id,
            ...cell,
            size: 1,
            hidden: entity.kind === 'enemy' && map.fog.enabled,
          },
        ],
  }
}

// ---------------------------------------------------------------------------
// Teleportation by the GM (D-276)
// ---------------------------------------------------------------------------

export interface TeleportMove {
  entityId: string
  toMapId: string
  /** Where to land (chosen by the GM); by default beside the target's arrival point. */
  at?: Cell
  /** Land beside this character's token once it has landed (a familiar following its master). */
  beside?: string
  /** Kind of a character with no token yet (enemies start hidden under fog). */
  kind?: string
}

/**
 * Sends characters to other maps by force (D-276): no wall, door, fog or
 * passage matters. Each token leaves every map it stands on and lands on its
 * target at `at` or beside the target's arrival point, on a free cell; those
 * going to the same map land next to each other (a group stays together).
 * Size and hidden flag are kept; a character with no token gets one.
 * Maps left untouched keep their identity.
 */
export function teleport(
  maps: Readonly<Record<string, GameMap>>,
  moves: readonly TeleportMove[],
): Record<string, GameMap> {
  const next: Record<string, GameMap> = { ...maps }
  const anchors = new Map<string, Cell>()
  // Cells the GM chose: nobody else lands there, whatever the order of the moves.
  const reserved = new Map<string, string>()
  for (const move of moves) {
    const target = maps[move.toMapId]
    if (target && move.at && !move.beside && inBounds(target, move.at))
      reserved.set(`${target.id}:${move.at.col},${move.at.row}`, move.entityId)
  }
  for (const move of moves) {
    if (!next[move.toMapId]) continue
    let token: Token | undefined
    let fromId: string | null = null
    for (const map of Object.values(next)) {
      const found = map.tokens.find((tk) => tk.entityId === move.entityId)
      if (!found) continue
      if (!token) {
        token = found
        fromId = map.id
      }
      next[map.id] = { ...map, tokens: map.tokens.filter((tk) => tk.entityId !== move.entityId) }
    }
    const target = next[move.toMapId]!
    const othersChose = (cell: Cell) => {
      const owner = reserved.get(`${target.id}:${cell.col},${cell.row}`)
      return owner !== undefined && owner !== move.entityId
    }
    const avoid = (cell: Cell) => othersChose(cell) || passageAt(target, cell) !== undefined
    const master = move.beside ? target.tokens.find((tk) => tk.entityId === move.beside) : undefined
    let cell: Cell
    if (master) {
      // Beside its master, never under it (a big token covers several cells).
      const covers = (c: Cell) =>
        c.col >= master.col &&
        c.col < master.col + master.size &&
        c.row >= master.row &&
        c.row < master.row + master.size
      cell = freeCellNear(target, master, { avoid: (c) => covers(c) || avoid(c) })
    } else if (move.at && !move.beside && inBounds(target, move.at))
      cell = freeCellNear(target, move.at, { avoid: othersChose })
    else {
      const anchor = anchors.get(target.id) ?? arrivalCell(target, fromId ?? target.id)
      anchors.set(target.id, anchor)
      cell = freeCellNear(target, anchor, { avoid })
    }
    next[target.id] = {
      ...target,
      tokens: [
        ...target.tokens,
        token
          ? { ...token, col: cell.col, row: cell.row }
          : {
              id: crypto.randomUUID(),
              entityId: move.entityId,
              col: cell.col,
              row: cell.row,
              size: 1,
              hidden: move.kind === 'enemy' && target.fog.enabled,
            },
      ],
    }
  }
  // Maps whose tokens did not actually change keep their identity.
  for (const id of Object.keys(next))
    if (next[id] !== maps[id] && sameTokens(next[id]!.tokens, maps[id]!.tokens))
      next[id] = maps[id]!
  return next
}

const sameTokens = (a: readonly Token[], b: readonly Token[]) =>
  a.length === b.length &&
  a.every((tk) => {
    const o = b.find((x) => x.id === tk.id)
    return o !== undefined && o.col === tk.col && o.row === tk.row
  })
