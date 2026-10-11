import { ImagePlus, PersonStanding, Trash } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'
import { toast } from 'sonner'
import { IconButton } from '@/components/ui/Button'
import { useT } from '@/i18n'
import { cn } from '@/lib/cn'
import { fitImage, imageFromFile } from '@/lib/images'

/** Max size of the stored body image (portrait-oriented, transparency kept). */
const MAX_WIDTH = 768
const MAX_HEIGHT = 1152

/** Full-body figure, or a silhouette when there is none. */
export function BodyImage({ src, className }: { src: string | null; className?: string }) {
  return (
    <div
      className={cn(
        'flex items-end justify-center overflow-hidden rounded-lg bg-gradient-to-b from-surface-2 to-accent-soft/60',
        className,
      )}
      aria-hidden
    >
      {src ? (
        <img src={src} alt="" className="size-full object-contain" draggable={false} />
      ) : (
        <PersonStanding className="h-3/4 w-auto text-ink-muted/30" strokeWidth={1} />
      )}
    </div>
  )
}

/** Click or drop an image to set the character's body; no cropping, ratio kept. */
export function BodyPicker({
  src,
  onChange,
  className,
}: {
  src: string | null
  onChange: (body: string | null) => void
  className?: string
}) {
  const t = useT()
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  async function open(file: File | undefined) {
    if (!file) return
    try {
      onChange(fitImage(await imageFromFile(file), MAX_WIDTH, MAX_HEIGHT))
    } catch {
      toast.error(t.identity.invalidImage)
    }
  }

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e: DragEvent) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e: DragEvent) => {
          e.preventDefault()
          setOver(false)
          void open(e.dataTransfer.files[0])
        }}
        aria-label={src ? t.identity.changeBody : t.identity.addBody}
        className={cn(
          'group relative block size-full rounded-lg border border-dashed transition-colors',
          over ? 'border-accent' : 'border-line-strong hover:border-accent',
        )}
      >
        <BodyImage src={src} className="size-full" />
        <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 rounded-b-lg bg-black/50 py-1.5 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <ImagePlus className="size-3.5" aria-hidden />
          {src ? t.identity.changeBody : t.identity.addBody}
        </span>
      </button>
      {src && (
        <IconButton
          size="sm"
          label={t.identity.removeBody}
          icon={<Trash />}
          className="absolute top-1.5 right-1.5 bg-surface/80"
          onClick={() => onChange(null)}
        />
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          void open(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
