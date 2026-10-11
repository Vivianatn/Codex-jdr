import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ExternalLink, ImagePlus, Map as MapIcon, MonitorPlay } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { buttonClasses } from '@/components/ui/buttonStyles'
import { EmptyState } from '@/components/ui/EmptyState'
import { assetRepository } from '@/db/assets'
import type { PlayerDisplay } from '@/domain/turns'
import { useMapActions } from '@/features/game/useMapActions'
import { useCampaign } from '@/features/shell/campaignContext'
import { useT } from '@/i18n'
import { fitImage, imageFromFile } from '@/lib/images'
import { cn } from '@/lib/cn'
import { useCampaignStore } from '@/stores/campaignStore'
import { useMapViewStore, type MapTool } from '@/stores/mapViewStore'
import { useUiStore } from '@/stores/uiStore'
import { cameraControls } from './cameraControls'
import { MapCanvas, type MapChange } from './MapCanvas'
import { AreaPanel, ElementPanel, WallPanel } from './MapPanels'
import { MapToolbar } from './MapToolbar'
import { useCanvasLabels } from './useCanvasLabels'
import { openViewChannel } from './viewChannel'

const PLAY_TOOLS: MapTool[] = [
  'select',
  'measure',
  'ping',
  'areaCircle',
  'areaCone',
  'areaLine',
  'areaSquare',
  'fogReveal',
  'fogHide',
  'fogRect',
  'draw',
  'erase',
]

const ITEM =
  'flex min-h-9 cursor-pointer items-center gap-2 rounded-sm px-2.5 py-1.5 text-sm text-ink outline-none data-[highlighted]:bg-surface-2'

/** The map in play (D-228): tokens, doors, traps, areas, fog, and the players' view. */
export function PlayMap() {
  const t = useT()
  const campaign = useCampaign()
  const play = useCampaignStore((s) => s.play)
  const maps = useCampaignStore((s) => s.maps)
  const entities = useCampaignStore((s) => s.entities)
  const updateMap = useCampaignStore((s) => s.updateMap)
  const updatePlay = useCampaignStore((s) => s.updatePlay)
  const openQuick = useUiStore((s) => s.openQuick)
  const selection = useMapViewStore((s) => s.selection)
  const area = useMapViewStore((s) => s.area)
  const followTurn = useMapViewStore((s) => s.followTurn)
  const actions = useMapActions()
  const labels = useCanvasLabels()
  const map = play.mapId ? maps[play.mapId] : undefined
  const channel = useRef<ReturnType<typeof openViewChannel> | null>(null)
  const activeEntityId = play.turn.status === 'playing' ? play.turn.memberId : null
  const mapList = Object.values(maps).sort((a, b) => a.name.localeCompare(b.name, 'fr'))

  useEffect(() => {
    channel.current = openViewChannel(campaign.id)
    return () => channel.current?.close()
  }, [campaign.id])

  // The players' window follows the GM camera.
  const mapId = map?.id
  useEffect(() => {
    if (!mapId) return
    const post = (s: ReturnType<typeof useMapViewStore.getState>) => {
      const camera = s.cameras[mapId]
      if (camera && s.viewport.width)
        channel.current?.post({ type: 'camera', mapId, camera, ...s.viewport })
    }
    post(useMapViewStore.getState())
    return useMapViewStore.subscribe((s, prev) => {
      if (s.cameras[mapId] !== prev.cameras[mapId] || s.viewport !== prev.viewport) post(s)
    })
  }, [mapId])

  // Follow the turn: centre the camera on whoever plays.
  useEffect(() => {
    if (!map || !followTurn || !activeEntityId) return
    const p = actions.tokenPoint(map.id, activeEntityId)
    if (p) cameraControls(map).centerOn(p)
    // Only when the turn changes, not on every map edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEntityId, followTurn, map?.id])

  useEffect(() => {
    const view = useMapViewStore.getState()
    view.select({ type: 'none' })
    // Editor-only tools (walls, palette…) do not carry over into play.
    if (!PLAY_TOOLS.includes(view.tool)) view.setTool('select')
    else view.setArea(null)
  }, [mapId])

  const onChange: MapChange = useMemo(
    () => (recipe, label) => {
      if (mapId) updateMap(mapId, recipe, label)
    },
    [mapId, updateMap],
  )
  const controls = useMemo(() => (map ? cameraControls(map) : null), [map])

  const mapSelect = (
    <label className="flex items-center gap-1.5 text-xs text-ink-muted">
      <MapIcon className="size-4" aria-hidden />
      <span className="sr-only">{t.maps.chooseMap}</span>
      <select
        className="h-8 max-w-44 rounded-md border border-line bg-surface px-2 text-sm text-ink"
        value={play.mapId ?? ''}
        onChange={(e) => {
          const id = e.target.value || null
          updatePlay(
            (p) => ({ ...p, mapId: id }),
            id ? t.maps.wentTo(maps[id]!.name) : t.maps.noMap,
          )
        }}
      >
        <option value="">{t.maps.noMap}</option>
        {mapList.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </label>
  )

  if (!map)
    return (
      <div className="relative flex size-full items-center justify-center">
        <div className="glass relative rounded-lg border border-line shadow-lifted">
          <EmptyState
            icon={<MapIcon />}
            title={t.play.noMapTitle}
            body={mapList.length ? t.maps.noMapBody : t.play.noMapBody}
            actions={
              mapList.length ? (
                mapSelect
              ) : (
                <Link to={`/c/${campaign.id}/prep/maps`} className={buttonClasses('secondary')}>
                  {t.play.goToMaps}
                </Link>
              )
            }
          />
        </div>
        <div className="absolute top-2 right-2">
          <PlayerViewMenu campaignId={campaign.id} display={play.display} />
        </div>
      </div>
    )

  const element =
    selection.type === 'element' ? map.elements.find((e) => e.id === selection.id) : undefined
  const wall = selection.type === 'wall' ? map.walls.find((w) => w.id === selection.id) : undefined

  return (
    <div className="flex size-full flex-col">
      <MapToolbar
        tools={PLAY_TOOLS}
        onZoom={(f) => controls?.zoom(f)}
        onFit={() => controls?.fit()}
      >
        {mapSelect}
        <label className="flex items-center gap-1.5 text-xs text-ink-muted">
          <input
            type="checkbox"
            checked={followTurn}
            onChange={(e) => useMapViewStore.getState().setFollowTurn(e.target.checked)}
            className="size-4 accent-[var(--codex-accent)]"
          />
          {t.maps.followTurn}
        </label>
        <PlayerViewMenu campaignId={campaign.id} display={play.display} />
      </MapToolbar>
      <div className="relative min-h-0 flex-1">
        <MapCanvas
          map={map}
          entities={entities}
          rules={campaign.rules}
          viewer="gm"
          mode="play"
          labels={labels}
          activeEntityId={activeEntityId}
          onChange={onChange}
          onTokenOpen={openQuick}
          onDoorOpen={(id) => useMapViewStore.getState().select({ type: 'wall', id })}
          onTokenMove={(tokenId, cell) => actions.moveToken(map.id, tokenId, cell)}
          onDropEntity={(entityId, cell) => actions.placeToken(map.id, entityId, cell)}
          onBlocked={(m) => toast(m)}
          onPing={(point) => {
            useMapViewStore.getState().addPing(point)
            channel.current?.post({ type: 'ping', mapId: map.id, point })
          }}
        />
        {area ? (
          <AreaPanel map={map} area={area} />
        ) : element ? (
          <ElementPanel
            key={element.id}
            map={map}
            element={element}
            mode="play"
            onChange={onChange}
          />
        ) : wall ? (
          <WallPanel key={wall.id} map={map} wall={wall} mode="play" onChange={onChange} />
        ) : null}
      </div>
    </div>
  )
}

function PlayerViewMenu({ campaignId, display }: { campaignId: string; display: PlayerDisplay }) {
  const t = useT()
  const updatePlay = useCampaignStore((s) => s.updatePlay)
  const file = useRef<HTMLInputElement>(null)
  const setDisplay = (patch: Partial<PlayerDisplay>) =>
    updatePlay((p) => ({ ...p, display: { ...p.display, ...patch } }), t.maps.display)

  async function importImage(f: File | undefined) {
    if (!f) return
    if (f.size > 15 * 1024 * 1024) return toast.error(t.maps.imageTooBig)
    try {
      const data = fitImage(await imageFromFile(f), 3840, 2160)
      const asset = await assetRepository.add(campaignId, data, f.name)
      setDisplay({ mode: 'image', imageAssetId: asset.id })
    } catch {
      toast.error(t.identity.invalidImage)
    }
  }

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-sm',
              display.mode === 'map'
                ? 'text-ink-muted hover:bg-surface-2 hover:text-ink'
                : 'bg-gold-soft text-gold-text',
            )}
          >
            <MonitorPlay className="size-4" aria-hidden />
            {t.maps.playerView}
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="z-50 min-w-60 rounded-md border border-line bg-surface p-1 shadow-overlay"
            align="end"
            sideOffset={4}
          >
            <DropdownMenu.Item
              className={ITEM}
              onSelect={() => window.open(`#/c/${campaignId}/view`, 'codex-players')}
            >
              <ExternalLink className="size-4" aria-hidden />
              {t.maps.openPlayerView}
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="my-1 h-px bg-line" />
            <DropdownMenu.Label className="px-2.5 py-1 text-xs font-semibold text-ink-muted">
              {t.maps.display}
            </DropdownMenu.Label>
            <DropdownMenu.RadioGroup
              value={display.mode}
              onValueChange={(mode) => setDisplay({ mode: mode as PlayerDisplay['mode'] })}
            >
              {(['map', 'image', 'pause'] as const).map((mode) => (
                <DropdownMenu.RadioItem
                  key={mode}
                  value={mode}
                  className={ITEM}
                  disabled={mode === 'image' && !display.imageAssetId}
                >
                  <span
                    className={cn(
                      'size-2 rounded-full',
                      display.mode === mode ? 'bg-accent' : 'bg-line-strong',
                    )}
                    aria-hidden
                  />
                  {t.maps.displayModes[mode]}
                </DropdownMenu.RadioItem>
              ))}
            </DropdownMenu.RadioGroup>
            <DropdownMenu.Item className={ITEM} onSelect={() => file.current?.click()}>
              <ImagePlus className="size-4" aria-hidden />
              {t.maps.displayImageImport}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <input
        ref={file}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          void importImage(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </>
  )
}
