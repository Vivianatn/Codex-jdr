import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Shapes } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useResolvedTheme } from '@/app/usePreferences'
import { DECOR_KINDS, newElement, OBJECT_KINDS, type ElementKind } from '@/domain/maps'
import { useT } from '@/i18n'
import { cn } from '@/lib/cn'
import { useMapViewStore } from '@/stores/mapViewStore'
import { BOARD_DARK, BOARD_LIGHT } from './boardTheme'
import { drawElement } from './drawElements'
import { LayersList } from './MapToolbar'

const TILE = 64

/** Element preview drawn by the same code as the board. */
function ElementPreview({ kind }: { kind: ElementKind }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const dark = useResolvedTheme() === 'dark'
  useEffect(() => {
    const c = canvas.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    const ratio = window.devicePixelRatio || 1
    c.width = 44 * ratio
    c.height = 44 * ratio
    ctx.scale(ratio, ratio)
    ctx.clearRect(0, 0, 44, 44)
    const el = newElement(kind, { col: 0, row: 0 }, { hidden: false })
    drawElement(ctx, el, 44, 44, dark ? BOARD_DARK : BOARD_LIGHT, 44)
  }, [kind, dark])
  return <canvas ref={canvas} className="size-11" aria-hidden />
}

/** Editor palette (DA §10.5): elements as tiles, then the layers. */
export function MapPalette() {
  const t = useT()
  const tool = useMapViewStore((s) => s.tool)
  const placeKind = useMapViewStore((s) => s.placeKind)
  const setPlaceKind = useMapViewStore((s) => s.setPlaceKind)

  const tiles = (kinds: readonly ElementKind[]) => (
    <ul className="grid grid-cols-3 gap-1.5">
      {kinds.map((kind) => {
        const active = tool === 'place' && placeKind === kind
        return (
          <li key={kind}>
            <button
              type="button"
              aria-pressed={active}
              onClick={() => setPlaceKind(kind)}
              style={{ height: TILE }}
              className={cn(
                'flex w-full flex-col items-center justify-center gap-0.5 rounded-lg border text-[0.65rem] leading-tight font-medium transition-colors',
                active
                  ? 'border-accent bg-accent-soft text-accent-text'
                  : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink',
              )}
            >
              <ElementPreview kind={kind} />
              <span className="max-w-full truncate px-1">{t.maps.kinds[kind]}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )

  return (
    <aside
      aria-label={t.maps.palette}
      className="hidden w-[232px] shrink-0 space-y-5 overflow-y-auto border-r border-line bg-surface p-3 xl:block"
    >
      <section className="space-y-2">
        <h2 className="type-eyebrow !text-ink-muted">{t.maps.objects}</h2>
        {tiles(OBJECT_KINDS)}
      </section>
      <section className="space-y-2">
        <h2 className="type-eyebrow !text-ink-muted">{t.maps.decor}</h2>
        {tiles(DECOR_KINDS)}
      </section>
      <section className="space-y-2">
        <h2 className="type-eyebrow !text-ink-muted">{t.maps.layers}</h2>
        <LayersList />
      </section>
    </aside>
  )
}

/** Under 1280 px the palette folds into a menu opened from the rail (DA §10.5). */
export function PaletteMenu() {
  const t = useT()
  const tool = useMapViewStore((s) => s.tool)
  const placeKind = useMapViewStore((s) => s.placeKind)
  const setPlaceKind = useMapViewStore((s) => s.setPlaceKind)
  const item =
    'flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm text-ink outline-none data-[highlighted]:bg-surface-2'
  const section = (title: string, kinds: readonly ElementKind[]) => (
    <>
      <DropdownMenu.Label className="px-2 py-1 text-xs font-semibold text-ink-muted">
        {title}
      </DropdownMenu.Label>
      {kinds.map((kind) => (
        <DropdownMenu.Item key={kind} className={item} onSelect={() => setPlaceKind(kind)}>
          <ElementPreview kind={kind} />
          {t.maps.kinds[kind]}
        </DropdownMenu.Item>
      ))}
    </>
  )
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={t.maps.palette}
          aria-pressed={tool === 'place'}
          className={cn(
            'inline-flex size-11 items-center justify-center rounded-md text-ink-muted hover:bg-surface-2 hover:text-ink xl:hidden [&_svg]:size-5',
            tool === 'place' && 'bg-accent-soft text-accent-text',
          )}
        >
          <Shapes aria-hidden />
          <span className="sr-only">{t.maps.kinds[placeKind]}</span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="right"
          sideOffset={8}
          className="z-50 max-h-[70vh] min-w-56 overflow-y-auto rounded-xl border border-line bg-surface-raised p-1 shadow-lifted"
        >
          {section(t.maps.objects, OBJECT_KINDS)}
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          {section(t.maps.decor, DECOR_KINDS)}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
