import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
  Circle as CircleIcon,
  Crosshair,
  DoorOpen,
  Eraser,
  Eye,
  EyeOff,
  Grid3x3,
  Layers,
  Maximize,
  Minus,
  MousePointer2,
  PaintBucket,
  Pencil,
  Plus,
  Ruler,
  Shapes,
  Slash,
  Square,
  SquareDashed,
  Triangle,
  Brush,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { IconButton } from '@/components/ui/Button'
import { DECOR_KINDS, OBJECT_KINDS, type ElementKind } from '@/domain/maps'
import { useT } from '@/i18n'
import { cn } from '@/lib/cn'
import { MAP_LAYERS, useMapViewStore, type MapTool } from '@/stores/mapViewStore'

const TOOL_ICONS: Record<MapTool, LucideIcon> = {
  select: MousePointer2,
  measure: Ruler,
  fogReveal: Brush,
  fogHide: PaintBucket,
  fogRect: SquareDashed,
  wall: Slash,
  door: DoorOpen,
  draw: Pencil,
  erase: Eraser,
  areaCircle: CircleIcon,
  areaCone: Triangle,
  areaLine: Minus,
  areaSquare: Square,
  ping: Crosshair,
  calibrate: Grid3x3,
  place: Shapes,
}

const ITEM =
  'flex min-h-9 cursor-pointer items-center gap-2 rounded-sm px-2.5 py-1.5 text-sm text-ink outline-none data-[highlighted]:bg-surface-2'
const MENU =
  'z-50 max-h-[70vh] min-w-52 overflow-y-auto rounded-md border border-line bg-surface p-1 shadow-overlay'

/** Tool bar over the map; `tools` lists what this screen offers. */
export function MapToolbar({
  tools,
  palette = false,
  onZoom,
  onFit,
  children,
}: {
  tools: MapTool[]
  palette?: boolean
  onZoom: (factor: number) => void
  onFit: () => void
  children?: ReactNode
}) {
  const t = useT()
  const tool = useMapViewStore((s) => s.tool)
  const setTool = useMapViewStore((s) => s.setTool)
  const placeKind = useMapViewStore((s) => s.placeKind)
  const setPlaceKind = useMapViewStore((s) => s.setPlaceKind)
  const brush = useMapViewStore((s) => s.brush)
  const setBrush = useMapViewStore((s) => s.setBrush)
  const drawColor = useMapViewStore((s) => s.drawColor)
  const drawGmOnly = useMapViewStore((s) => s.drawGmOnly)
  const setDraw = useMapViewStore((s) => s.setDraw)
  const hidden = useMapViewStore((s) => s.hiddenLayers)
  const toggleLayer = useMapViewStore((s) => s.toggleLayer)
  const hint = tool.startsWith('area')
    ? t.maps.toolHint.area
    : ((t.maps.toolHint as Record<string, string>)[tool] ?? '')

  return (
    <div className="glass flex flex-wrap items-center gap-1 border-b border-line px-2 py-1.5">
      <div role="toolbar" aria-label={t.maps.tools} className="flex flex-wrap items-center gap-0.5">
        {tools.map((key) => {
          const Icon = TOOL_ICONS[key]
          return (
            <IconButton
              key={key}
              size="sm"
              label={t.maps.tool[key]}
              icon={<Icon />}
              variant={tool === key ? 'secondary' : 'ghost'}
              aria-pressed={tool === key}
              className={cn(tool === key && 'bg-accent-soft text-accent-text')}
              onClick={() => setTool(key)}
            />
          )
        })}
        {palette && (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                aria-label={t.maps.palette}
                aria-pressed={tool === 'place'}
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-sm',
                  tool === 'place'
                    ? 'bg-accent-soft text-accent-text'
                    : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
                )}
              >
                <Shapes className="size-4" aria-hidden />
                {t.maps.kinds[placeKind]}
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className={MENU} sideOffset={4}>
                <DropdownMenu.Label className="px-2.5 py-1 text-xs font-semibold text-ink-muted">
                  {t.maps.decor}
                </DropdownMenu.Label>
                {DECOR_KINDS.map((k) => (
                  <PaletteItem key={k} kind={k} onPick={setPlaceKind} />
                ))}
                <DropdownMenu.Separator className="my-1 h-px bg-line" />
                <DropdownMenu.Label className="px-2.5 py-1 text-xs font-semibold text-ink-muted">
                  {t.maps.objects}
                </DropdownMenu.Label>
                {OBJECT_KINDS.map((k) => (
                  <PaletteItem key={k} kind={k} onPick={setPlaceKind} />
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        )}
      </div>

      {(tool === 'fogReveal' || tool === 'fogHide') && (
        <label className="ml-2 flex items-center gap-2 text-xs text-ink-muted">
          {t.maps.brush}
          <input
            type="range"
            min={1}
            max={10}
            value={brush}
            onChange={(e) => setBrush(Number(e.target.value))}
            className="w-24 accent-[var(--codex-accent)]"
          />
        </label>
      )}
      {tool === 'draw' && (
        <div className="ml-2 flex items-center gap-3 text-xs text-ink-muted">
          <label className="flex items-center gap-1.5">
            {t.maps.color}
            <input
              type="color"
              value={drawColor}
              onChange={(e) => setDraw({ drawColor: e.target.value })}
              className="h-7 w-9 cursor-pointer rounded border border-line bg-transparent"
            />
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={drawGmOnly}
              onChange={(e) => setDraw({ drawGmOnly: e.target.checked })}
              className="size-4 accent-[var(--codex-accent)]"
            />
            {t.maps.gmOnly}
          </label>
        </div>
      )}

      <p className="hidden min-w-0 flex-1 truncate px-2 text-xs text-ink-muted xl:block">{hint}</p>
      {children}

      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <IconButton size="sm" label={t.maps.layers} icon={<Layers />} />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className={MENU} align="end" sideOffset={4}>
            {MAP_LAYERS.map((layer) => (
              <DropdownMenu.CheckboxItem
                key={layer}
                className={ITEM}
                checked={!hidden.includes(layer)}
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={() => toggleLayer(layer)}
              >
                {hidden.includes(layer) ? (
                  <EyeOff className="size-4 text-ink-muted" aria-hidden />
                ) : (
                  <Eye className="size-4 text-accent-text" aria-hidden />
                )}
                {t.maps.layer[layer]}
              </DropdownMenu.CheckboxItem>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <IconButton
        size="sm"
        label={t.maps.zoomOut}
        icon={<Minus />}
        onClick={() => onZoom(1 / 1.25)}
      />
      <IconButton size="sm" label={t.maps.zoomIn} icon={<Plus />} onClick={() => onZoom(1.25)} />
      <IconButton size="sm" label={t.maps.fit} icon={<Maximize />} onClick={onFit} />
    </div>
  )
}

function PaletteItem({ kind, onPick }: { kind: ElementKind; onPick: (k: ElementKind) => void }) {
  const t = useT()
  return (
    <DropdownMenu.Item className={ITEM} onSelect={() => onPick(kind)}>
      {t.maps.kinds[kind]}
    </DropdownMenu.Item>
  )
}
