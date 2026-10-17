import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as Tooltip from '@radix-ui/react-tooltip'
import {
  Brush,
  Check,
  Circle as CircleIcon,
  Cloud,
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
  type LucideIcon,
} from 'lucide-react'
import {
  forwardRef,
  useEffect,
  useMemo,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react'
import type { GameMap } from '@/domain/maps'
import { useT } from '@/i18n'
import { cn } from '@/lib/cn'
import { isTypingTarget } from '@/lib/dom'
import { MAP_LAYERS, useMapViewStore, type MapTool } from '@/stores/mapViewStore'
import { cameraControls, useCameraScale } from './cameraControls'

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

export type ToolGroupKey = 'area' | 'fog' | 'annotate'

const TOOL_GROUPS: Record<ToolGroupKey, { icon: LucideIcon; tools: MapTool[]; key: string }> = {
  area: { icon: CircleIcon, tools: ['areaCircle', 'areaCone', 'areaLine', 'areaSquare'], key: 'z' },
  fog: { icon: Cloud, tools: ['fogReveal', 'fogHide', 'fogRect'], key: 'f' },
  annotate: { icon: Pencil, tools: ['draw', 'erase'], key: 'n' },
}

/** Keyboard shortcuts of single tools (DA §8.23). */
const TOOL_KEYS: Partial<Record<MapTool, string>> = {
  select: 'v',
  measure: 'm',
  ping: 'p',
  wall: 'w',
  door: 'd',
  calibrate: 'c',
}

export type ToolItem = MapTool | ToolGroupKey

const isGroup = (item: ToolItem): item is ToolGroupKey => item in TOOL_GROUPS

const BUTTON =
  'inline-flex size-11 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink [&_svg]:size-5 [&_svg]:stroke-[1.75]'
const ACTIVE = 'bg-accent-soft text-accent-text hover:bg-accent-soft hover:text-accent-text'
const MENU =
  'z-50 max-h-[70vh] min-w-52 overflow-y-auto rounded-xl border border-line bg-surface-raised p-1 shadow-lifted'
const ITEM =
  'flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-ink outline-none data-[highlighted]:bg-surface-2 [&_svg]:size-4'

function Tip({
  label,
  children,
  side,
}: {
  label: string
  children: ReactNode
  side: 'top' | 'right'
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side={side}
          sideOffset={8}
          className="z-50 max-w-64 rounded-lg bg-ink px-2 py-1.5 text-xs font-medium text-bg shadow-lifted"
        >
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

const ToolButton = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<'button'> & { active: boolean; label: string }
>(function ToolButton({ active, label, className, children, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-pressed={active}
      className={cn(BUTTON, active && ACTIVE, className)}
      {...props}
    >
      {children}
    </button>
  )
})

/**
 * Map tools (DA §8.23): a floating bar centred at the bottom during play, a
 * vertical rail in the editor. Areas, fog and annotations are grouped.
 */
export function MapToolbar({
  tools,
  orientation = 'bar',
  children,
}: {
  tools: ToolItem[]
  orientation?: 'bar' | 'rail'
  children?: ReactNode
}) {
  const t = useT()
  const tool = useMapViewStore((s) => s.tool)
  const setTool = useMapViewStore((s) => s.setTool)
  const side = orientation === 'bar' ? 'top' : 'right'
  useToolShortcuts(tools)

  const label = (key: MapTool) =>
    TOOL_KEYS[key] ? `${t.maps.tool[key]} (${TOOL_KEYS[key]!.toUpperCase()})` : t.maps.tool[key]

  return (
    <div
      role="toolbar"
      aria-label={t.maps.tools}
      aria-orientation={orientation === 'bar' ? 'horizontal' : 'vertical'}
      className={cn(
        'flex gap-1 p-1',
        orientation === 'bar'
          ? 'codex-glass flex-wrap items-center justify-center !rounded-lg'
          : 'w-[60px] flex-col items-center border-r border-line bg-surface py-2',
      )}
    >
      {tools.map((item) => {
        if (!isGroup(item)) {
          const Icon = TOOL_ICONS[item]
          return (
            <Tip key={item} label={label(item)} side={side}>
              <ToolButton active={tool === item} label={label(item)} onClick={() => setTool(item)}>
                <Icon aria-hidden />
              </ToolButton>
            </Tip>
          )
        }
        const group = TOOL_GROUPS[item]
        const active = group.tools.includes(tool)
        const Icon = active ? TOOL_ICONS[tool] : group.icon
        const groupLabel = `${t.maps.toolGroups[item]} (${group.key.toUpperCase()})`
        return (
          <DropdownMenu.Root key={item}>
            <Tip label={groupLabel} side={side}>
              <DropdownMenu.Trigger asChild>
                <ToolButton active={active} label={groupLabel}>
                  <Icon aria-hidden />
                </ToolButton>
              </DropdownMenu.Trigger>
            </Tip>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className={MENU}
                side={side}
                sideOffset={8}
                aria-label={t.maps.toolGroups[item]}
              >
                {group.tools.map((key) => {
                  const ItemIcon = TOOL_ICONS[key]
                  return (
                    <DropdownMenu.Item key={key} className={ITEM} onSelect={() => setTool(key)}>
                      <ItemIcon className="text-ink-muted" aria-hidden />
                      <span className="flex-1">{t.maps.tool[key]}</span>
                      {tool === key && <Check className="text-accent-text" aria-hidden />}
                    </DropdownMenu.Item>
                  )
                })}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        )
      })}
      {children}
    </div>
  )
}

/** Single-letter shortcuts for the tools on screen; a group key cycles its tools. */
function useToolShortcuts(tools: ToolItem[]) {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (isTypingTarget(e.target)) return
      const key = e.key.toLowerCase()
      const { tool, setTool } = useMapViewStore.getState()
      for (const item of tools) {
        if (isGroup(item)) {
          const group = TOOL_GROUPS[item]
          if (group.key !== key) continue
          const i = group.tools.indexOf(tool)
          setTool(group.tools[(i + 1) % group.tools.length]!)
          return
        }
        if (TOOL_KEYS[item] === key) {
          setTool(item)
          return
        }
      }
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [tools])
}

/** Options of the current tool (brush size, drawing colour) and its hint. */
export function ToolOptions({ className }: { className?: string }) {
  const t = useT()
  const tool = useMapViewStore((s) => s.tool)
  const brush = useMapViewStore((s) => s.brush)
  const setBrush = useMapViewStore((s) => s.setBrush)
  const drawColor = useMapViewStore((s) => s.drawColor)
  const drawGmOnly = useMapViewStore((s) => s.drawGmOnly)
  const setDraw = useMapViewStore((s) => s.setDraw)
  if (tool === 'select') return null
  const hint = tool.startsWith('area')
    ? t.maps.toolHint.area
    : ((t.maps.toolHint as Record<string, string>)[tool] ?? '')
  return (
    <div
      className={cn(
        'codex-glass flex max-w-[min(42rem,calc(100%-2rem))] flex-wrap items-center gap-x-4 gap-y-1 !rounded-xl px-3 py-1.5 text-xs text-ink-muted',
        className,
      )}
    >
      {(tool === 'fogReveal' || tool === 'fogHide') && (
        <label className="flex items-center gap-2">
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
        <>
          <label className="flex items-center gap-1.5">
            {t.maps.color}
            <input
              type="color"
              value={drawColor}
              onChange={(e) => setDraw({ drawColor: e.target.value })}
              className="h-7 w-9 cursor-pointer rounded-md border border-line-strong bg-transparent"
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
        </>
      )}
      {hint && <p className="min-w-0 flex-1 basis-48">{hint}</p>}
    </div>
  )
}

/**
 * Zoom control in glass: − 100 % + and "see the whole map" (DA §10.5). It
 * reads the camera itself so camera moves never re-render the whole page.
 */
export function ZoomControl({ map, className }: { map: GameMap; className?: string }) {
  const t = useT()
  const scale = useCameraScale(map)
  const controls = useMemo(() => cameraControls(map), [map])
  const onZoom = (factor: number) => controls.zoom(factor)
  const onFit = () => controls.fit()
  const small =
    'inline-flex size-9 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-2 hover:text-ink [&_svg]:size-4'
  return (
    <div className={cn('codex-glass flex items-center gap-0.5 !rounded-xl p-1', className)}>
      <button
        type="button"
        className={small}
        aria-label={t.maps.zoomOut}
        onClick={() => onZoom(1 / 1.25)}
      >
        <Minus aria-hidden />
      </button>
      <span className="tabular w-12 text-center text-xs font-semibold text-ink">
        {Math.round(scale * 100)} %
      </span>
      <button
        type="button"
        className={small}
        aria-label={t.maps.zoomIn}
        onClick={() => onZoom(1.25)}
      >
        <Plus aria-hidden />
      </button>
      <button type="button" className={small} aria-label={t.maps.fit} onClick={onFit}>
        <Maximize aria-hidden />
      </button>
    </div>
  )
}

/** Layer visibility, as a menu (play). */
export function LayersMenu({ className }: { className?: string }) {
  const t = useT()
  const hidden = useMapViewStore((s) => s.hiddenLayers)
  const toggleLayer = useMapViewStore((s) => s.toggleLayer)
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={t.maps.layers}
          className={cn(
            'inline-flex size-9 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-2 hover:text-ink [&_svg]:size-4',
            className,
          )}
        >
          <Layers aria-hidden />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={MENU} align="end" sideOffset={6}>
          {MAP_LAYERS.map((layer) => (
            <DropdownMenu.CheckboxItem
              key={layer}
              className={ITEM}
              checked={!hidden.includes(layer)}
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={() => toggleLayer(layer)}
            >
              {hidden.includes(layer) ? (
                <EyeOff className="text-ink-muted" aria-hidden />
              ) : (
                <Eye className="text-accent-text" aria-hidden />
              )}
              {t.maps.layer[layer]}
            </DropdownMenu.CheckboxItem>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

/** Layer visibility, as a list with eye toggles (editor palette). */
export function LayersList() {
  const t = useT()
  const hidden = useMapViewStore((s) => s.hiddenLayers)
  const toggleLayer = useMapViewStore((s) => s.toggleLayer)
  return (
    <ul className="space-y-0.5">
      {[...MAP_LAYERS].reverse().map((layer) => {
        const off = hidden.includes(layer)
        return (
          <li key={layer}>
            <button
              type="button"
              aria-pressed={!off}
              onClick={() => toggleLayer(layer)}
              className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-sm text-ink hover:bg-surface-2"
            >
              {off ? (
                <EyeOff className="size-4 text-ink-faint" aria-hidden />
              ) : (
                <Eye className="size-4 text-accent-text" aria-hidden />
              )}
              <span className={cn('flex-1 text-left', off && 'text-ink-muted')}>
                {t.maps.layer[layer]}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
