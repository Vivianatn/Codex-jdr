import type { ElementKind, MapElement } from '@/domain/maps'

/**
 * Procedural drawings of map elements (decor and objects) on a 2D canvas, in
 * the element's local box (0,0)–(w,h). Map art uses fixed "ink on parchment"
 * colours that read on any background, not the UI theme.
 */

type Ctx = CanvasRenderingContext2D

const INK = '#2b2233'

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
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

function fillStroke(ctx: Ctx, fill: string, stroke = INK, width = 1.5) {
  ctx.fillStyle = fill
  ctx.fill()
  ctx.strokeStyle = stroke
  ctx.lineWidth = width
  ctx.stroke()
}

type Drawer = (ctx: Ctx, w: number, h: number, el: MapElement) => void

const DRAWERS: Record<ElementKind, Drawer> = {
  tree(ctx, w, h) {
    const r = Math.min(w, h) * 0.46
    blob(ctx, w / 2, h / 2, r, 7, 1)
    fillStroke(ctx, '#3f7d3a', '#1f3d1c', 2)
    blob(ctx, w / 2 - r * 0.15, h / 2 - r * 0.15, r * 0.55, 6, 3)
    ctx.fillStyle = 'rgba(140, 200, 110, 0.45)'
    ctx.fill()
  },
  bush(ctx, w, h) {
    blob(ctx, w / 2, h / 2, Math.min(w, h) * 0.38, 6, 2)
    fillStroke(ctx, '#5c9a45', '#2b4d20')
  },
  rock(ctx, w, h) {
    ctx.beginPath()
    ctx.moveTo(w * 0.15, h * 0.65)
    ctx.lineTo(w * 0.3, h * 0.2)
    ctx.lineTo(w * 0.7, h * 0.15)
    ctx.lineTo(w * 0.9, h * 0.55)
    ctx.lineTo(w * 0.65, h * 0.88)
    ctx.lineTo(w * 0.28, h * 0.85)
    ctx.closePath()
    fillStroke(ctx, '#8f8a86', '#4a4542', 2)
  },
  water(ctx, w, h) {
    roundRect(ctx, 1, 1, w - 2, h - 2, Math.min(w, h) * 0.3)
    fillStroke(ctx, 'rgba(74, 144, 217, 0.65)', '#2f6db0')
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'
    ctx.lineWidth = 1.5
    for (let y = h * 0.3; y < h; y += h * 0.3) {
      ctx.beginPath()
      ctx.moveTo(w * 0.15, y)
      ctx.quadraticCurveTo(w * 0.35, y - h * 0.08, w * 0.5, y)
      ctx.quadraticCurveTo(w * 0.65, y + h * 0.08, w * 0.85, y)
      ctx.stroke()
    }
  },
  table(ctx, w, h) {
    roundRect(ctx, w * 0.08, h * 0.15, w * 0.84, h * 0.7, 4)
    fillStroke(ctx, '#9b6a3c', '#4d3218')
  },
  chair(ctx, w, h) {
    roundRect(ctx, w * 0.25, h * 0.3, w * 0.5, h * 0.5, 3)
    fillStroke(ctx, '#a87444', '#4d3218')
    roundRect(ctx, w * 0.25, h * 0.15, w * 0.5, h * 0.15, 2)
    fillStroke(ctx, '#7a4f29', '#4d3218')
  },
  bed(ctx, w, h) {
    roundRect(ctx, w * 0.1, h * 0.05, w * 0.8, h * 0.9, 4)
    fillStroke(ctx, '#b33b3b', '#5c1d1d')
    roundRect(ctx, w * 0.2, h * 0.1, w * 0.6, h * 0.2, 4)
    fillStroke(ctx, '#f4efe6', '#8a8070')
  },
  barrel(ctx, w, h) {
    const r = Math.min(w, h) * 0.38
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2)
    fillStroke(ctx, '#8a5a2b', '#3d2712', 2)
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, r * 0.6, 0, Math.PI * 2)
    ctx.strokeStyle = '#3d2712'
    ctx.stroke()
  },
  crate(ctx, w, h) {
    roundRect(ctx, w * 0.12, h * 0.12, w * 0.76, h * 0.76, 2)
    fillStroke(ctx, '#b88a4e', '#5a3f1c', 2)
    ctx.beginPath()
    ctx.moveTo(w * 0.12, h * 0.12)
    ctx.lineTo(w * 0.88, h * 0.88)
    ctx.moveTo(w * 0.88, h * 0.12)
    ctx.lineTo(w * 0.12, h * 0.88)
    ctx.stroke()
  },
  pillar(ctx, w, h) {
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.4, 0, Math.PI * 2)
    fillStroke(ctx, '#c9c2b6', '#5f5a52', 2)
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.26, 0, Math.PI * 2)
    ctx.strokeStyle = '#8f887c'
    ctx.stroke()
  },
  statue(ctx, w, h) {
    roundRect(ctx, w * 0.15, h * 0.15, w * 0.7, h * 0.7, 3)
    fillStroke(ctx, '#bdb6a8', '#5f5a52', 2)
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.2, 0, Math.PI * 2)
    fillStroke(ctx, '#e0dbd1', '#5f5a52')
  },
  rug(ctx, w, h) {
    roundRect(ctx, w * 0.05, h * 0.05, w * 0.9, h * 0.9, 3)
    fillStroke(ctx, 'rgba(160, 40, 60, 0.75)', '#5c1424')
    roundRect(ctx, w * 0.15, h * 0.15, w * 0.7, h * 0.7, 2)
    ctx.strokeStyle = '#d9a441'
    ctx.lineWidth = 1.5
    ctx.stroke()
  },
  torch(ctx, w, h) {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.min(w, h) * 0.5)
    g.addColorStop(0, 'rgba(255, 200, 80, 0.9)')
    g.addColorStop(1, 'rgba(255, 140, 40, 0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.12, 0, Math.PI * 2)
    fillStroke(ctx, '#ffb347', '#a8551a')
  },
  stairs(ctx, w, h) {
    roundRect(ctx, w * 0.08, h * 0.08, w * 0.84, h * 0.84, 2)
    fillStroke(ctx, '#a39a8c', '#4e483f')
    ctx.strokeStyle = '#4e483f'
    for (let i = 1; i < 5; i++) {
      const y = h * 0.08 + (h * 0.84 * i) / 5
      ctx.beginPath()
      ctx.moveTo(w * 0.08, y)
      ctx.lineTo(w * 0.92, y)
      ctx.stroke()
    }
  },
  chest(ctx, w, h, el) {
    roundRect(ctx, w * 0.12, h * 0.25, w * 0.76, h * 0.55, 3)
    fillStroke(ctx, el.chest?.opened ? '#c99a52' : '#9c6b2f', '#3d2712', 2)
    ctx.fillStyle = '#d9a441'
    ctx.fillRect(w * 0.45, h * 0.35, w * 0.1, h * 0.18)
    ctx.strokeStyle = '#3d2712'
    ctx.beginPath()
    ctx.moveTo(w * 0.12, h * 0.42)
    ctx.lineTo(w * 0.88, h * 0.42)
    ctx.stroke()
  },
  trap(ctx, w, h, el) {
    ctx.setLineDash([4, 3])
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.4, 0, Math.PI * 2)
    fillStroke(
      ctx,
      el.trap?.triggered ? 'rgba(224, 82, 82, 0.35)' : 'rgba(224, 82, 82, 0.18)',
      '#c43d3d',
      2,
    )
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.moveTo(w * 0.32, h * 0.32)
    ctx.lineTo(w * 0.68, h * 0.68)
    ctx.moveTo(w * 0.68, h * 0.32)
    ctx.lineTo(w * 0.32, h * 0.68)
    ctx.strokeStyle = '#c43d3d'
    ctx.lineWidth = 2.5
    ctx.stroke()
  },
  lever(ctx, w, h, el) {
    roundRect(ctx, w * 0.3, h * 0.6, w * 0.4, h * 0.2, 2)
    fillStroke(ctx, '#7d7a75', INK)
    const on = el.lever?.on
    ctx.beginPath()
    ctx.moveTo(w / 2, h * 0.65)
    ctx.lineTo(on ? w * 0.75 : w * 0.25, h * 0.25)
    ctx.strokeStyle = INK
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(on ? w * 0.75 : w * 0.25, h * 0.25, Math.min(w, h) * 0.1, 0, Math.PI * 2)
    fillStroke(ctx, on ? '#3fa96b' : '#e05252', INK)
  },
  link(ctx, w, h) {
    roundRect(ctx, w * 0.15, h * 0.1, w * 0.7, h * 0.8, Math.min(w, h) * 0.3)
    fillStroke(ctx, 'rgba(109, 91, 208, 0.75)', '#3b2f84', 2)
    ctx.beginPath()
    ctx.moveTo(w * 0.35, h / 2)
    ctx.lineTo(w * 0.65, h / 2)
    ctx.moveTo(w * 0.55, h * 0.38)
    ctx.lineTo(w * 0.67, h / 2)
    ctx.lineTo(w * 0.55, h * 0.62)
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2.5
    ctx.stroke()
  },
  npc(ctx, w, h) {
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.4, 0, Math.PI * 2)
    fillStroke(ctx, '#e9d8a6', '#6b5a24', 2)
    ctx.fillStyle = '#6b5a24'
    ctx.font = `bold ${Math.round(Math.min(w, h) * 0.45)}px Inter, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('!', w / 2, h / 2 + 1)
  },
  note(ctx, w, h) {
    roundRect(ctx, w * 0.15, h * 0.15, w * 0.7, h * 0.7, 2)
    fillStroke(ctx, '#ffe68a', '#a68a1f')
    ctx.strokeStyle = '#a68a1f'
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.moveTo(w * 0.27, h * (0.35 + i * 0.12))
      ctx.lineTo(w * 0.73, h * (0.35 + i * 0.12))
      ctx.stroke()
    }
  },
}

export function drawElement(ctx: Ctx, el: MapElement, w: number, h: number) {
  ctx.save()
  DRAWERS[el.kind](ctx, w, h, el)
  ctx.restore()
}
