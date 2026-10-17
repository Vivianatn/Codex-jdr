import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
  Crosshair,
  ExternalLink,
  IdCard,
  ImagePlus,
  Map as MapIcon,
  MonitorPlay,
} from 'lucide-react'
import { GameIcon } from '@/components/GameIcon'
import { useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { buttonClasses } from '@/components/ui/buttonStyles'
import { EmptyState } from '@/components/ui/EmptyState'
import { assetRepository } from '@/db/assets'
import { turnActors, type PlayerDisplay } from '@/domain/turns'
import { useMapActions } from '@/features/game/useMapActions'
import { useBoardSlots } from '@/features/play/boardSlots'
import { TeleportPanel } from '@/features/play/TeleportPanel'
import { useCampaign } from '@/features/shell/campaignContext'
import { useT } from '@/i18n'
import { fitImage, imageFromFile } from '@/lib/images'
import { cn } from '@/lib/cn'
import { useCampaignStore } from '@/stores/campaignStore'
import { useMapViewStore, type MapTool } from '@/stores/mapViewStore'
import { useUiStore } from '@/stores/uiStore'
import { cameraControls } from './cameraControls'
import { MapCanvas, type MapChange } from './MapCanvas'
import { MapTreeMenu } from './MapTree'
import { AreaPanel, ElementPanel, WallPanel } from './MapPanels'
import { LayersMenu, MapToolbar, ToolOptions, ZoomControl, type ToolItem } from './MapToolbar'
import { TokenSheets } from './TokenSheets'
import { useCanvasLabels } from './useCanvasLabels'
import { useMapKeys } from './useMapKeys'
import { openViewChannel } from './viewChannel'

const PLAY_TOOLS: ToolItem[] = ['select', 'measure', 'area', 'fog', 'ping', 'annotate']
const PLAY_TOOL_KEYS: MapTool[] = [
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
  'flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-ink outline-none data-[highlighted]:bg-surface-2'

/** The map in play (D-228): tokens, doors, traps, areas, fog, and the players' view. */
export function PlayMap() {
  const t = useT()
  const campaign = useCampaign()
  const play = useCampaignStore((s) => s.play)
  const maps = useCampaignStore((s) => s.maps)
  const mapNames = useMemo(
    () => Object.fromEntries(Object.values(maps).map((m) => [m.id, m.name])),
    [maps],
  )
  const entities = useCampaignStore((s) => s.entities)
  const updateMap = useCampaignStore((s) => s.updateMap)
  const pinSheets = useMapViewStore((s) => s.pinPlayerSheets)
  const selection = useMapViewStore((s) => s.selection)
  const area = useMapViewStore((s) => s.area)
  const followTurn = useMapViewStore((s) => s.followTurn)
  const actions = useMapActions()
  const labels = useCanvasLabels()
  const map = play.mapId ? maps[play.mapId] : undefined
  const channel = useRef<ReturnType<typeof openViewChannel> | null>(null)
  const activeEntityId = play.turn.status === 'playing' ? play.turn.memberId : null
  // Familiars play with their master (D-269): highlighted with it.
  const actors = useMemo(() => turnActors(play, entities), [play, entities])
  const hasMaps = Object.keys(maps).length > 0

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
    if (p) cameraControls(map).centerOn(p, true)
    // Only when the turn changes, not on every map edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEntityId, followTurn, map?.id])

  useEffect(() => {
    const view = useMapViewStore.getState()
    view.select({ type: 'none' })
    view.openSheet(null)
    // Editor-only tools (walls, palette…) do not carry over into play.
    if (!PLAY_TOOL_KEYS.includes(view.tool)) view.setTool('select')
    else view.setArea(null)
  }, [mapId])

  const onChange: MapChange = useMemo(
    () => (recipe, label) => {
      if (mapId) updateMap(mapId, recipe, label)
    },
    [mapId, updateMap],
  )
  // Same shortcuts as in the editor: Delete removes the selection, R turns an element (D-260).
  useMapKeys(mapId ? onChange : null, { tokens: false })
  const setDiceOpen = useUiStore((s) => s.setDiceOpen)
  const slots = useBoardSlots()

  if (!map)
    return (
      <div className="relative flex size-full items-center justify-center">
        <div className="glass relative rounded-lg border border-line shadow-lifted">
          <EmptyState
            icon={<MapIcon />}
            title={t.play.noMapTitle}
            body={hasMaps ? t.maps.noMapBody : t.play.noMapBody}
            actions={
              <div className="flex flex-wrap items-center justify-center gap-2">
                {hasMaps ? (
                  <MapTreeMenu />
                ) : (
                  <Link to={`/c/${campaign.id}/prep/maps`} className={buttonClasses('secondary')}>
                    {t.play.goToMaps}
                  </Link>
                )}
                <PlayerViewMenu campaignId={campaign.id} display={play.display} />
              </div>
            }
          />
        </div>
      </div>
    )

  const element =
    selection.type === 'element' ? map.elements.find((e) => e.id === selection.id) : undefined
  const wall = selection.type === 'wall' ? map.walls.find((w) => w.id === selection.id) : undefined

  // Compact toggles: icon + checkbox, the words from wide screens on (D-272).
  const toggle =
    'flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-medium text-ink-muted hover:bg-surface-2 hover:text-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus pointer-coarse:h-10'
  const controls = (
    <div
      role="group"
      aria-label={t.play.boardOptions}
      className="codex-glass flex flex-wrap items-center gap-0.5 !rounded-xl p-1"
    >
      <MapTreeMenu />
      <TeleportPanel />
      <label className={toggle} title={t.maps.followTurn}>
        <input
          type="checkbox"
          checked={followTurn}
          onChange={(e) => useMapViewStore.getState().setFollowTurn(e.target.checked)}
          className="size-4 accent-[var(--codex-accent)]"
        />
        <Crosshair className="size-4 @5xl/board:hidden" aria-hidden />
        <span className="sr-only @5xl/board:not-sr-only">{t.maps.followTurn}</span>
      </label>
      <label className={toggle} title={t.mini.pinPlayersHint}>
        <input
          type="checkbox"
          checked={pinSheets}
          onChange={(e) => useMapViewStore.getState().setPinPlayerSheets(e.target.checked)}
          className="size-4 accent-[var(--codex-accent)]"
        />
        <IdCard className="size-4 @5xl/board:hidden" aria-hidden />
        <span className="sr-only @5xl/board:not-sr-only">{t.mini.pinPlayers}</span>
      </label>
      <LayersMenu />
    </div>
  )
  const tools = (
    <div className="flex min-w-0 flex-col items-center gap-2">
      <ToolOptions />
      <MapToolbar tools={PLAY_TOOLS}>
        <span className="mx-0.5 h-7 w-px bg-line" aria-hidden />
        <button
          type="button"
          onClick={() => setDiceOpen(true)}
          aria-label={t.maps.rollDice}
          title={t.maps.rollDice}
          className="inline-flex size-11 items-center justify-center rounded-md text-ink-muted hover:bg-surface-2 hover:text-ink [&_svg]:size-5"
        >
          <GameIcon name="rolling-dices" aria-hidden />
        </button>
        <PlayerViewMenu campaignId={campaign.id} display={play.display} />
      </MapToolbar>
    </div>
  )
  return (
    <div className="relative size-full">
      <MapCanvas
        map={map}
        entities={entities}
        rules={campaign.rules}
        viewer="gm"
        mode="play"
        labels={labels}
        mapNames={mapNames}
        activeEntityId={activeEntityId}
        activeEntityIds={actors}
        onChange={onChange}
        onTokenOpen={(id) => {
          const view = useMapViewStore.getState()
          view.openSheet(view.sheetId === id ? null : id)
        }}
        onDoorOpen={(id) => useMapViewStore.getState().select({ type: 'wall', id })}
        onTokenMove={(tokenId, cell) => actions.moveToken(map.id, tokenId, cell)}
        onDropEntity={(entityId, cell) => actions.placeToken(map.id, entityId, cell)}
        onBlocked={(m) => toast(m)}
        onPing={(point) => {
          useMapViewStore.getState().addPing(point)
          channel.current?.post({ type: 'ping', mapId: map.id, point })
        }}
      />
      <TokenSheets map={map} entities={entities} />

      {/* Board chrome: in the play layout slots (D-272), else floating over the board (DA §10.6). */}
      {slots?.top ? (
        createPortal(controls, slots.top)
      ) : (
        <div className="absolute top-4 right-4 z-10">{controls}</div>
      )}
      {slots?.bottom ? (
        createPortal(
          <div className="grid w-full grid-cols-[1fr_minmax(0,auto)_1fr] items-end gap-2">
            <span aria-hidden />
            <div className="pointer-events-auto min-w-0">{tools}</div>
            <ZoomControl
              map={map}
              className="pointer-events-auto hidden justify-self-end @4xl/board:flex"
            />
          </div>,
          slots.bottom,
        )
      ) : (
        <>
          <div className="pointer-events-none absolute inset-x-0 bottom-5 z-10 flex justify-center px-4">
            <div className="pointer-events-auto min-w-0">{tools}</div>
          </div>
          <ZoomControl map={map} className="absolute right-4 bottom-5 z-10 hidden md:flex" />
        </>
      )}

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
              'inline-flex h-11 items-center gap-1.5 rounded-md px-3 text-sm font-medium [&_svg]:size-5',
              display.mode === 'map'
                ? 'text-ink-muted hover:bg-surface-2 hover:text-ink'
                : 'bg-gold-soft text-gold-text',
            )}
          >
            <MonitorPlay aria-hidden />
            <span className="sr-only @2xl/board:not-sr-only">{t.maps.playerView}</span>
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="z-50 min-w-60 rounded-xl border border-line bg-surface-raised p-1 shadow-lifted"
            side="top"
            align="end"
            sideOffset={8}
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
