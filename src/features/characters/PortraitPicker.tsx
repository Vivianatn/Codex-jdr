import { Camera, Trash } from 'lucide-react'
import { useRef, useState, type DragEvent, type PointerEvent } from 'react'
import { toast } from 'sonner'
import { Button, IconButton } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { useT } from '@/i18n'
import { cn } from '@/lib/cn'
import { imageFromFile } from '@/lib/images'
import { Portrait } from './Portrait'

const VIEW = 256
const OUTPUT = 384

/** Medallion that accepts a click or a dropped image, then opens the cropper. */
export function PortraitPicker({
  src,
  name,
  onChange,
}: {
  src: string | null
  name: string
  onChange: (portrait: string | null) => void
}) {
  const t = useT()
  const input = useRef<HTMLInputElement>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [dragOver, setDragOver] = useState(false)

  async function open(file: File | undefined) {
    if (!file) return
    try {
      setImage(await imageFromFile(file))
    } catch {
      toast.error(t.identity.invalidImage)
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e: DragEvent) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e: DragEvent) => {
          e.preventDefault()
          setDragOver(false)
          void open(e.dataTransfer.files[0])
        }}
        aria-label={src ? t.identity.changePortrait : t.identity.addPortrait}
        className={cn(
          'group relative rounded-full transition-transform hover:scale-[1.02]',
          dragOver && 'scale-105',
        )}
      >
        <Portrait src={src} name={name} size="lg" />
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <Camera className="size-6" aria-hidden />
        </span>
      </button>
      {src && (
        <IconButton
          label={t.identity.removePortrait}
          icon={<Trash />}
          size="sm"
          onClick={() => onChange(null)}
        />
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label={t.identity.addPortrait}
        data-testid="portrait-input"
        onChange={(e) => {
          void open(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      {image && (
        <CropDialog
          image={image}
          onCancel={() => setImage(null)}
          onConfirm={(dataUrl) => {
            setImage(null)
            onChange(dataUrl)
          }}
        />
      )}
    </div>
  )
}

function CropDialog({
  image,
  onCancel,
  onConfirm,
}: {
  image: HTMLImageElement
  onCancel: () => void
  onConfirm: (dataUrl: string) => void
}) {
  const t = useT()
  const cover = VIEW / Math.min(image.naturalWidth, image.naturalHeight)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  const scale = cover * zoom
  const w = image.naturalWidth * scale
  const h = image.naturalHeight * scale
  // Keep the image covering the viewport.
  const clamp = (o: { x: number; y: number }, s = scale) => {
    const maxX = (image.naturalWidth * s - VIEW) / 2
    const maxY = (image.naturalHeight * s - VIEW) / 2
    return { x: Math.max(-maxX, Math.min(maxX, o.x)), y: Math.max(-maxY, Math.min(maxY, o.y)) }
  }
  const pos = clamp(offset)

  function confirm() {
    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT
    canvas.height = OUTPUT
    const ctx = canvas.getContext('2d')
    if (!ctx) return onCancel()
    const k = OUTPUT / VIEW
    ctx.drawImage(
      image,
      (VIEW / 2 - w / 2 + pos.x) * k,
      (VIEW / 2 - h / 2 + pos.y) * k,
      w * k,
      h * k,
    )
    onConfirm(canvas.toDataURL('image/webp', 0.85))
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onCancel()}
      title={t.identity.cropTitle}
      description={t.identity.cropHelp}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            {t.common.cancel}
          </Button>
          <Button variant="primary" onClick={confirm}>
            {t.common.confirm}
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-4">
        <button
          type="button"
          aria-label={t.identity.cropArea}
          className="relative block cursor-grab touch-none overflow-hidden rounded-md bg-surface-2 active:cursor-grabbing"
          style={{ width: VIEW, height: VIEW }}
          onPointerDown={(e: PointerEvent) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            drag.current = { x: e.clientX, y: e.clientY, ox: pos.x, oy: pos.y }
          }}
          onPointerMove={(e: PointerEvent) => {
            const d = drag.current
            if (d) setOffset(clamp({ x: d.ox + e.clientX - d.x, y: d.oy + e.clientY - d.y }))
          }}
          onPointerUp={() => (drag.current = null)}
          onKeyDown={(e) => {
            const step = e.shiftKey ? 20 : 5
            const moves: Record<string, [number, number]> = {
              ArrowLeft: [step, 0],
              ArrowRight: [-step, 0],
              ArrowUp: [0, step],
              ArrowDown: [0, -step],
            }
            const move = moves[e.key]
            if (!move) return
            e.preventDefault()
            setOffset(clamp({ x: pos.x + move[0], y: pos.y + move[1] }))
          }}
        >
          <img
            src={image.src}
            alt=""
            draggable={false}
            className="pointer-events-none absolute max-w-none select-none"
            style={{
              width: w,
              height: h,
              left: VIEW / 2 - w / 2 + pos.x,
              top: VIEW / 2 - h / 2 + pos.y,
            }}
          />
          {/* Circle guide: the medallion shows the inscribed circle. */}
          <div
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{ boxShadow: '0 0 0 999px rgb(0 0 0 / 0.45)' }}
            aria-hidden
          />
        </button>
        <label className="flex w-full max-w-64 items-center gap-3 text-sm text-ink">
          {t.identity.zoom}
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(e) => {
              const next = Number(e.target.value)
              setZoom(next)
              setOffset((o) => clamp(o, cover * next))
            }}
            className="flex-1 accent-[var(--codex-accent)]"
          />
        </label>
      </div>
    </Dialog>
  )
}
