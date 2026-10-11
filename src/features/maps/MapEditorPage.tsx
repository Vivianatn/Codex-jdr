import { ArrowLeft, Play } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { useCampaign } from '@/features/shell/campaignContext'
import { useT } from '@/i18n'
import { useCampaignStore } from '@/stores/campaignStore'
import { useMapViewStore } from '@/stores/mapViewStore'
import { cameraControls, useCameraScale } from './cameraControls'
import { MapCanvas, type MapChange } from './MapCanvas'
import { ElementPanel, MapSettingsPanel, WallPanel } from './MapPanels'
import { PanelDock } from './panelDock'
import { MapPalette, PaletteMenu } from './MapPalette'
import { MapToolbar, ToolOptions, ZoomControl, type ToolItem } from './MapToolbar'
import { useCanvasLabels } from './useCanvasLabels'

const EDIT_TOOLS: ToolItem[] = ['select', 'wall', 'door', 'calibrate', 'fog', 'annotate', 'measure']

/** Préparation › Cartes › one map: grid, background, decor, walls, objects, fog. */
export function MapEditorPage() {
  const t = useT()
  const campaign = useCampaign()
  const navigate = useNavigate()
  const { mapId } = useParams()
  const map = useCampaignStore((s) => (mapId ? s.maps[mapId] : undefined))
  const entities = useCampaignStore((s) => s.entities)
  const maps = useCampaignStore((s) => s.maps)
  const mapNames = useMemo(
    () => Object.fromEntries(Object.values(maps).map((m) => [m.id, m.name])),
    [maps],
  )
  const updateMap = useCampaignStore((s) => s.updateMap)
  const updatePlay = useCampaignStore((s) => s.updatePlay)
  const selection = useMapViewStore((s) => s.selection)
  const labels = useCanvasLabels()
  const [calibrateCells, setCalibrateCells] = useState(1)

  // A fresh editor starts with the selection tool and nothing selected.
  useEffect(() => {
    useMapViewStore.getState().setTool('select')
    useMapViewStore.getState().select({ type: 'none' })
  }, [mapId])

  const onChange: MapChange = useCallback(
    (recipe, label) => {
      if (mapId) updateMap(mapId, recipe, label)
    },
    [mapId, updateMap],
  )

  // Delete removes the selection, R rotates the selected element.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)))
        return
      const sel = useMapViewStore.getState().selection
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (sel.type === 'element')
          onChange(
            (m) => ({ ...m, elements: m.elements.filter((x) => x.id !== sel.id) }),
            t.maps.elementDeleted,
          )
        else if (sel.type === 'wall')
          onChange(
            (m) => ({ ...m, walls: m.walls.filter((x) => x.id !== sel.id) }),
            t.maps.wallDeleted,
          )
        else return
        useMapViewStore.getState().select({ type: 'none' })
      } else if (
        (e.key === 'r' || e.key === 'R') &&
        sel.type === 'element' &&
        !e.ctrlKey &&
        !e.metaKey
      ) {
        onChange(
          (m) => ({
            ...m,
            elements: m.elements.map((x) =>
              x.id === sel.id ? { ...x, rotation: (x.rotation + 90) % 360 } : x,
            ),
          }),
          t.maps.elementChanged,
        )
      }
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [onChange, t])

  const controls = useMemo(() => (map ? cameraControls(map) : null), [map])
  const scale = useCameraScale(map)

  if (!map) return <Navigate to={`/c/${campaign.id}/prep/maps`} replace />

  const element =
    selection.type === 'element' ? map.elements.find((e) => e.id === selection.id) : undefined
  const wall = selection.type === 'wall' ? map.walls.find((w) => w.id === selection.id) : undefined

  return (
    <div className="flex h-full min-h-[32rem] flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-4">
        <nav
          aria-label={t.maps.breadcrumb}
          className="flex min-w-0 flex-1 items-center gap-2 text-sm"
        >
          <Link
            to={`/c/${campaign.id}/prep/maps`}
            className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-ink-muted hover:bg-surface-2 hover:text-ink"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {t.maps.pageTitle}
          </Link>
          <span className="text-ink-faint" aria-hidden>
            /
          </span>
          <h1 className="min-w-0 truncate font-title text-base font-semibold text-ink">
            {map.name}
          </h1>
        </nav>
        <Button
          variant="primary"
          size="sm"
          icon={<Play />}
          onClick={() => {
            updatePlay((p) => ({ ...p, mapId: map.id }), t.maps.wentTo(map.name))
            navigate(`/c/${campaign.id}/play`)
          }}
        >
          {t.maps.play}
        </Button>
      </header>
      <div className="flex min-h-0 flex-1">
        <MapToolbar tools={EDIT_TOOLS} orientation="rail">
          <PaletteMenu />
        </MapToolbar>
        <MapPalette />
        <section aria-label={t.maps.canvas(map.name)} className="relative min-w-0 flex-1">
          <MapCanvas
            map={map}
            entities={entities}
            rules={campaign.rules}
            viewer="gm"
            mode="edit"
            labels={labels}
            mapNames={mapNames}
            onChange={onChange}
            onBlocked={(m) => toast(m)}
            calibrateCells={calibrateCells}
          />
          <ToolOptions className="absolute top-3 left-1/2 z-10 -translate-x-1/2" />
          <ZoomControl
            scale={scale}
            onZoom={(f) => controls?.zoom(f)}
            onFit={() => controls?.fit()}
            className="absolute right-4 bottom-4 z-10"
          />
        </section>
        <PanelDock.Provider value>
          {element ? (
            <ElementPanel
              key={element.id}
              map={map}
              element={element}
              mode="edit"
              onChange={onChange}
            />
          ) : wall ? (
            <WallPanel key={wall.id} map={map} wall={wall} mode="edit" onChange={onChange} />
          ) : (
            <MapSettingsPanel
              map={map}
              onChange={onChange}
              calibrateCells={calibrateCells}
              setCalibrateCells={setCalibrateCells}
            />
          )}
        </PanelDock.Provider>
      </div>
    </div>
  )
}
