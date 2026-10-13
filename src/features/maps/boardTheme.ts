import type { Entity } from '@/domain/types'

/**
 * Colours and sizes of the board (docs/CODEX-DA.md §9). The canvas cannot read
 * CSS variables, so the values are literals. Sizes marked "u" are pixels for a
 * 70 px cell at 100 % zoom and scale with the cell (they follow the zoom);
 * the others are screen pixels.
 */
export interface BoardTheme {
  name: 'light' | 'dark' | 'players'
  /** Outside the map. */
  bg: string
  /** Map floor when there is no background image. */
  floor: string
  outline: string | null
  grid: string
  /** Every fifth line (square grids), or null. */
  gridMajor: string | null
  /** Screen px. */
  gridWidth: number
  wall: { color: string; outline: string; width: number; outlineWidth: number }
  door: {
    closed: string
    edge: string
    edgeWidth: number
    thickness: number
    open: string
    openWidth: number
    openDash: [number, number]
    locked: string
    /** False in the players' window: a locked door looks closed. */
    showLock: boolean
  }
  fog: { masked: string; hatch: string | null; softEdge: number }
  brush: string
  token: {
    kinds: Record<Entity['kind'] | 'npc', string>
    edge: string
    edgeWidth: number
    ringTrack: string
    ringWidth: number
    healthy: string
    wounded: string
    critical: string
    down: string
    temp: string
    active: { color: string; width: number; glow: string; blur: number }
    selection: string | null
    hiddenEdge: string
    condition: { bg: string; stroke: string; size: number }
    moveFill: string | null
  }
  label: {
    text: string
    bg: string
    size: number
    radius: number
    padX: number
    padY: number
    gap: number
  }
  area: { fill: string; stroke: string; width: number }
  measure: {
    line: string
    width: number
    dash: [number, number]
    bubble: string
    bubbleText: string
    font: number
  }
  ping: { color: string; width: number; dot: number }
  plate: string
  objects: {
    chest: string
    trap: string
    trapFill: string
    lever: string
    passage: string
    passageFill: string
    /** Picture zones (D-259): GM only. */
    image: string
    imageFill: string
    npc: string
    note: string
    noteEdge: string
    noteIcon: string
    torch: string
    torchHalo: string
  }
  decor: { stroke: string; fill: string; fillDeep: string; water: string; waterEdge: string }
}

const KINDS_LIGHT = {
  player: '#2F64A8',
  ally: '#2B7D4C',
  familiar: '#137570',
  enemy: '#C43C3A',
  npc: '#B23D73',
}
const KINDS_DARK = { ...KINDS_LIGHT, player: '#4D86C9' }

export const BOARD_LIGHT: BoardTheme = {
  name: 'light',
  bg: '#E6DFD0',
  floor: '#E8DFCC',
  outline: 'rgba(33,28,38,0.20)',
  grid: 'rgba(33,28,38,0.16)',
  gridMajor: 'rgba(33,28,38,0.26)',
  gridWidth: 1,
  wall: { color: '#211C26', outline: 'rgba(255,253,248,0.55)', width: 6, outlineWidth: 1 },
  door: {
    closed: '#A97B22',
    edge: '#FFFDF8',
    edgeWidth: 2,
    thickness: 16,
    open: '#A97B22',
    openWidth: 3,
    openDash: [6, 4],
    locked: '#C43C3A',
    showLock: true,
  },
  fog: { masked: 'rgba(33,28,38,0.45)', hatch: 'rgba(255,253,248,0.10)', softEdge: 0 },
  brush: '#9A2A23',
  token: {
    kinds: KINDS_LIGHT,
    edge: '#FFFDF8',
    edgeWidth: 2,
    ringTrack: 'rgba(33,28,38,0.18)',
    ringWidth: 4,
    healthy: '#2E9A5E',
    wounded: '#B97A12',
    critical: '#C23B3B',
    down: '#8C8069',
    temp: '#3A80CC',
    active: { color: '#A97B22', width: 3, glow: 'rgba(217,164,65,0.55)', blur: 18 },
    selection: '#B07A1E',
    hiddenEdge: '#8C8069',
    condition: { bg: '#FFFDF8', stroke: '#8C8069', size: 16 },
    moveFill: 'rgba(176,122,30,0.12)',
  },
  label: {
    text: '#FFFDF8',
    bg: 'rgba(33,28,38,0.86)',
    size: 12,
    radius: 6,
    padX: 6,
    padY: 2,
    gap: 4,
  },
  area: { fill: 'rgba(154,42,35,0.14)', stroke: '#9A2A23', width: 2 },
  measure: {
    line: '#211C26',
    width: 2,
    dash: [8, 6],
    bubble: '#D9A441',
    bubbleText: '#2A1E08',
    font: 13,
  },
  ping: { color: '#A97B22', width: 3, dot: 8 },
  plate: 'rgba(255,253,248,0.85)',
  objects: {
    chest: '#A97B22',
    trap: '#C23B3B',
    trapFill: 'rgba(194,59,59,0.12)',
    lever: '#2B66A8',
    passage: '#3D8F55',
    passageFill: 'rgba(61,143,85,0.12)',
    image: '#2B66A8',
    imageFill: 'rgba(43,102,168,0.10)',
    npc: '#B23D73',
    note: '#E8B04A',
    noteEdge: '#82601B',
    noteIcon: '#2A1E08',
    torch: '#A97B22',
    torchHalo: 'rgba(217,164,65,0.18)',
  },
  decor: {
    stroke: '#4A4252',
    fill: '#D8CDB6',
    fillDeep: '#C4B79C',
    water: 'rgba(58,128,204,0.30)',
    waterEdge: '#2B66A8',
  },
}

export const BOARD_DARK: BoardTheme = {
  name: 'dark',
  bg: '#0E0B08',
  floor: '#3A3128',
  outline: 'rgba(242,234,221,0.10)',
  grid: 'rgba(242,234,221,0.14)',
  gridMajor: 'rgba(242,234,221,0.22)',
  gridWidth: 1,
  wall: { color: '#E9DFCF', outline: 'rgba(0,0,0,0.55)', width: 6, outlineWidth: 1 },
  door: {
    closed: '#C9963A',
    edge: '#15110D',
    edgeWidth: 2,
    thickness: 16,
    open: '#C9963A',
    openWidth: 3,
    openDash: [6, 4],
    locked: '#C43C3A',
    showLock: true,
  },
  fog: { masked: 'rgba(12,9,7,0.62)', hatch: 'rgba(242,234,221,0.06)', softEdge: 0 },
  brush: '#E2B45C',
  token: {
    kinds: KINDS_DARK,
    edge: '#15110D',
    edgeWidth: 2,
    ringTrack: 'rgba(0,0,0,0.35)',
    ringWidth: 4,
    healthy: '#4CB97A',
    wounded: '#E8A33D',
    critical: '#E35D5D',
    down: '#85745F',
    temp: '#8DBDF0',
    active: { color: '#E0AE4E', width: 3, glow: 'rgba(224,174,78,0.45)', blur: 16 },
    selection: '#E2B45C',
    hiddenEdge: '#B3A691',
    condition: { bg: '#1F1913', stroke: '#85745F', size: 16 },
    moveFill: 'rgba(226,180,92,0.10)',
  },
  label: {
    text: '#F2EADD',
    bg: 'rgba(21,17,13,0.86)',
    size: 12,
    radius: 6,
    padX: 6,
    padY: 2,
    gap: 4,
  },
  area: { fill: 'rgba(226,180,92,0.16)', stroke: '#E2B45C', width: 2 },
  measure: {
    line: '#F2EADD',
    width: 2,
    dash: [8, 6],
    bubble: '#E0AE4E',
    bubbleText: '#2A1E08',
    font: 13,
  },
  ping: { color: '#E0AE4E', width: 3, dot: 8 },
  plate: 'rgba(21,17,13,0.80)',
  objects: {
    chest: '#E0AE4E',
    trap: '#E35D5D',
    trapFill: 'rgba(227,93,93,0.14)',
    lever: '#93B1F2',
    passage: '#97C383',
    passageFill: 'rgba(151,195,131,0.12)',
    image: '#93B1F2',
    imageFill: 'rgba(147,177,242,0.12)',
    npc: '#B23D73',
    note: '#F0BF6E',
    noteEdge: '#C9963A',
    noteIcon: '#2A1E08',
    torch: '#E0AE4E',
    torchHalo: 'rgba(224,174,78,0.14)',
  },
  decor: {
    stroke: '#CFC3AF',
    fill: '#4A3F33',
    fillDeep: '#3C3229',
    water: 'rgba(107,147,236,0.28)',
    waterEdge: '#93B1F2',
  },
}

/** The players' window, on a TV: always dark, thicker, larger, no GM-only marks. */
export const BOARD_PLAYERS: BoardTheme = {
  ...BOARD_DARK,
  name: 'players',
  bg: '#0B0907',
  outline: null,
  grid: 'rgba(242,234,221,0.18)',
  gridMajor: null,
  gridWidth: 2,
  wall: { color: '#E9DFCF', outline: 'rgba(0,0,0,0.55)', width: 9, outlineWidth: 2 },
  door: {
    ...BOARD_DARK.door,
    edgeWidth: 3,
    open: '#E0AE4E',
    openWidth: 4,
    openDash: [8, 6],
    showLock: false,
  },
  fog: { masked: '#0B0907', hatch: null, softEdge: 48 },
  token: {
    ...BOARD_DARK.token,
    edgeWidth: 3,
    ringWidth: 5,
    active: { color: '#E0AE4E', width: 5, glow: 'rgba(224,174,78,0.50)', blur: 28 },
    selection: null,
    condition: { ...BOARD_DARK.token.condition, size: 24 },
    moveFill: null,
  },
  label: {
    text: '#F2EADD',
    bg: 'rgba(21,17,13,0.88)',
    size: 24,
    radius: 8,
    padX: 12,
    padY: 4,
    gap: 6,
  },
  area: { fill: 'rgba(226,180,92,0.20)', stroke: '#E2B45C', width: 3 },
  measure: { ...BOARD_DARK.measure, width: 3, dash: [12, 8], font: 22 },
  ping: { color: '#E0AE4E', width: 4, dot: 12 },
}

/** Pixel sizes of the DA are given for a 70 px cell. */
export const DA_CELL = 70

/** Fonts of the board (Konva cannot read the `--codex-font-*` variables, DA §4, D-239). */
export const BOARD_FONTS = {
  body: "'Source Sans 3 Variable', 'Source Sans 3', system-ui, sans-serif",
  display: "'Alegreya SC', Georgia, serif",
} as const
