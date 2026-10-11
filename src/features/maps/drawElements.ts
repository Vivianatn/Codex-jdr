import type { ElementKind, MapElement } from '@/domain/maps'
import { drawBoardIcon } from './boardIcons'
import { DA_CELL, type BoardTheme } from './boardTheme'

/**
 * Drawings of map elements on a 2D canvas, in the element's local box
 * (0,0)–(w,h). Decor is "ink on parchment" (one stroke, flat fills from the
 * board theme); interactive objects sit on a plate with their icon so they
 * read on any background (DA §9.6).
 */

type Ctx = CanvasRenderingContext2D

interface DrawContext {
  theme: BoardTheme
  /** Size of a cell in map pixels; DA sizes are given for 70 px. */
  cell: number
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function blob(ctx: Ctx, cx: number, cy: number, r: number, bumps: number, seed: number) {
  ctx.beginPath()
  for (let i = 0; i <= bumps * 2; i++) {
    const a = (i / (bumps * 2)) * Math.PI * 2
    const k = i % 2 === 0 ? 1 : 0.86 + 0.08 * Math.sin(seed + i)
    const x = cx + Math.cos(a) * r * k
    const y = cy + Math.sin(a) * r * k
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
}

function ink(ctx: Ctx, d: DrawContext, fill: string, width = 1.5) {
  const u = d.cell / DA_CELL
  ctx.fillStyle = fill
  ctx.fill()
  ctx.strokeStyle = d.theme.decor.stroke
  ctx.lineWidth = width * u
  ctx.stroke()
}

/** Plate under an interactive object: 40 × 40 at 70 px cells, coloured inner edge. */
function plate(ctx: Ctx, d: DrawContext, w: number, h: number, color: string) {
  const u = d.cell / DA_CELL
  const s = 40 * u
  roundRect(ctx, (w - s) / 2, (h - s) / 2, s, s, 8 * u)
  ctx.fillStyle = d.theme.plate
  ctx.fill()
  roundRect(ctx, (w - s) / 2 + u, (h - s) / 2 + u, s - 2 * u, s - 2 * u, 7 * u)
  ctx.strokeStyle = color
  ctx.lineWidth = 2 * u
  ctx.stroke()
}

/** Zone covering the element's cells (trap, passage). */
function zone(ctx: Ctx, d: DrawContext, w: number, h: number, stroke: string, fill: string) {
  const u = d.cell / DA_CELL
  roundRect(ctx, u, u, w - 2 * u, h - 2 * u, 4 * u)
  ctx.fillStyle = fill
  ctx.fill()
  ctx.setLineDash([6 * u, 4 * u])
  ctx.strokeStyle = stroke
  ctx.lineWidth = 2 * u
  ctx.stroke()
  ctx.setLineDash([])
}

type Drawer = (ctx: Ctx, w: number, h: number, el: MapElement, d: DrawContext) => void

const DRAWERS: Record<ElementKind, Drawer> = {
  tree(ctx, w, h, _el, d) {
    const r = Math.min(w, h) * 0.46
    blob(ctx, w / 2, h / 2, r, 7, 1)
    ink(ctx, d, d.theme.decor.fill, 2)
    blob(ctx, w / 2 - r * 0.12, h / 2 - r * 0.12, r * 0.55, 6, 3)
    ink(ctx, d, d.theme.decor.fillDeep, 1)
  },
  bush(ctx, w, h, _el, d) {
    blob(ctx, w / 2, h / 2, Math.min(w, h) * 0.38, 6, 2)
    ink(ctx, d, d.theme.decor.fill)
  },
  rock(ctx, w, h, _el, d) {
    ctx.beginPath()
    ctx.moveTo(w * 0.15, h * 0.65)
    ctx.lineTo(w * 0.3, h * 0.2)
    ctx.lineTo(w * 0.7, h * 0.15)
    ctx.lineTo(w * 0.9, h * 0.55)
    ctx.lineTo(w * 0.65, h * 0.88)
    ctx.lineTo(w * 0.28, h * 0.85)
    ctx.closePath()
    ink(ctx, d, d.theme.decor.fillDeep, 2)
  },
  water(ctx, w, h, _el, d) {
    const u = d.cell / DA_CELL
    roundRect(ctx, u, u, w - 2 * u, h - 2 * u, Math.min(w, h) * 0.3)
    ctx.fillStyle = d.theme.decor.water
    ctx.fill()
    ctx.strokeStyle = d.theme.decor.waterEdge
    ctx.lineWidth = 1.5 * u
    ctx.stroke()
    for (let y = h * 0.3; y < h; y += h * 0.3) {
      ctx.beginPath()
      ctx.moveTo(w * 0.15, y)
      ctx.quadraticCurveTo(w * 0.35, y - h * 0.08, w * 0.5, y)
      ctx.quadraticCurveTo(w * 0.65, y + h * 0.08, w * 0.85, y)
      ctx.stroke()
    }
  },
  table(ctx, w, h, _el, d) {
    roundRect(ctx, w * 0.08, h * 0.15, w * 0.84, h * 0.7, 4)
    ink(ctx, d, d.theme.decor.fill)
  },
  chair(ctx, w, h, _el, d) {
    roundRect(ctx, w * 0.25, h * 0.3, w * 0.5, h * 0.5, 3)
    ink(ctx, d, d.theme.decor.fill)
    roundRect(ctx, w * 0.25, h * 0.15, w * 0.5, h * 0.15, 2)
    ink(ctx, d, d.theme.decor.fillDeep)
  },
  bed(ctx, w, h, _el, d) {
    roundRect(ctx, w * 0.1, h * 0.05, w * 0.8, h * 0.9, 4)
    ink(ctx, d, d.theme.decor.fillDeep)
    roundRect(ctx, w * 0.2, h * 0.1, w * 0.6, h * 0.2, 4)
    ink(ctx, d, d.theme.decor.fill)
  },
  barrel(ctx, w, h, _el, d) {
    const r = Math.min(w, h) * 0.38
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2)
    ink(ctx, d, d.theme.decor.fill, 2)
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, r * 0.6, 0, Math.PI * 2)
    ctx.stroke()
  },
  crate(ctx, w, h, _el, d) {
    roundRect(ctx, w * 0.12, h * 0.12, w * 0.76, h * 0.76, 2)
    ink(ctx, d, d.theme.decor.fill, 2)
    ctx.beginPath()
    ctx.moveTo(w * 0.12, h * 0.12)
    ctx.lineTo(w * 0.88, h * 0.88)
    ctx.moveTo(w * 0.88, h * 0.12)
    ctx.lineTo(w * 0.12, h * 0.88)
    ctx.stroke()
  },
  pillar(ctx, w, h, _el, d) {
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.4, 0, Math.PI * 2)
    ink(ctx, d, d.theme.decor.fill, 2)
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.26, 0, Math.PI * 2)
    ctx.stroke()
  },
  statue(ctx, w, h, _el, d) {
    roundRect(ctx, w * 0.15, h * 0.15, w * 0.7, h * 0.7, 3)
    ink(ctx, d, d.theme.decor.fillDeep, 2)
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.2, 0, Math.PI * 2)
    ink(ctx, d, d.theme.decor.fill)
  },
  rug(ctx, w, h, _el, d) {
    roundRect(ctx, w * 0.05, h * 0.05, w * 0.9, h * 0.9, 3)
    ink(ctx, d, d.theme.decor.fillDeep)
    roundRect(ctx, w * 0.15, h * 0.15, w * 0.7, h * 0.7, 2)
    ctx.stroke()
  },
  torch(ctx, w, h, _el, d) {
    const r = Math.min(w, h) * 0.5
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, r)
    g.addColorStop(0, d.theme.objects.torchHalo)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    drawBoardIcon(ctx, 'torch', w / 2, h / 2, Math.min(w, h) * 0.45, d.theme.objects.torch, 1.75)
  },
  stairs(ctx, w, h, _el, d) {
    roundRect(ctx, w * 0.08, h * 0.08, w * 0.84, h * 0.84, 2)
    ink(ctx, d, d.theme.decor.fill)
    for (let i = 1; i < 5; i++) {
      const y = h * 0.08 + (h * 0.84 * i) / 5
      ctx.beginPath()
      ctx.moveTo(w * 0.08, y)
      ctx.lineTo(w * 0.92, y)
      ctx.stroke()
    }
  },
  chest(ctx, w, h, el, d) {
    const u = d.cell / DA_CELL
    const color = d.theme.objects.chest
    plate(ctx, d, w, h, color)
    drawBoardIcon(ctx, el.chest?.opened ? 'chestOpen' : 'chest', w / 2, h / 2, 24 * u, color)
  },
  trap(ctx, w, h, el, d) {
    const u = d.cell / DA_CELL
    const o = d.theme.objects
    zone(
      ctx,
      d,
      w,
      h,
      o.trap,
      el.trap?.triggered ? o.trapFill.replace(/[\d.]+\)$/, '0.28)') : o.trapFill,
    )
    drawBoardIcon(ctx, 'trap', w / 2, h / 2, 28 * u, o.trap)
  },
  lever(ctx, w, h, el, d) {
    const u = d.cell / DA_CELL
    const color = d.theme.objects.lever
    plate(ctx, d, w, h, color)
    drawBoardIcon(ctx, el.lever?.on ? 'leverOn' : 'leverOff', w / 2, h / 2, 24 * u, color)
  },
  link(ctx, w, h, _el, d) {
    const u = d.cell / DA_CELL
    const o = d.theme.objects
    zone(ctx, d, w, h, o.passage, o.passageFill)
    drawBoardIcon(ctx, 'passage', w / 2, h / 2, 28 * u, o.passage)
  },
  npc(ctx, w, h, _el, d) {
    const r = Math.min(w, h) * 0.43
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2)
    ctx.fillStyle = d.theme.objects.npc
    ctx.fill()
    ctx.strokeStyle = d.theme.token.edge
    ctx.lineWidth = d.theme.token.edgeWidth * (d.cell / DA_CELL)
    ctx.stroke()
    drawBoardIcon(ctx, 'npc', w / 2, h / 2, r * 1.1, '#FFFFFF', 2)
  },
  note(ctx, w, h, _el, d) {
    const u = d.cell / DA_CELL
    const s = 34 * u
    ctx.save()
    ctx.translate(w / 2, h / 2)
    ctx.rotate((-4 * Math.PI) / 180)
    roundRect(ctx, -s / 2, -s / 2, s, s, 3 * u)
    ctx.fillStyle = d.theme.objects.note
    ctx.fill()
    ctx.strokeStyle = d.theme.objects.noteEdge
    ctx.lineWidth = u
    ctx.stroke()
    drawBoardIcon(ctx, 'note', 0, 0, 18 * u, d.theme.objects.noteIcon)
    ctx.restore()
  },
}

export function drawElement(
  ctx: Ctx,
  el: MapElement,
  w: number,
  h: number,
  theme: BoardTheme,
  cell: number,
) {
  ctx.save()
  DRAWERS[el.kind](ctx, w, h, el, { theme, cell })
  ctx.restore()
}
