import { useLiveQuery } from 'dexie-react-hooks'
import { Maximize, Video, VideoOff } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { useSurface } from '@/app/useSurface'
import { db } from '@/db/db'
import { normalizeEntityShape } from '@/domain/entity'
import { normalizeMap } from '@/domain/maps'
import { normalizePlayState } from '@/domain/turns'
import type { Entity } from '@/domain/types'
import { useT } from '@/i18n'
import { withDefaultRules } from '@/rules'
import { useMapViewStore, type Camera } from '@/stores/mapViewStore'
import { MapCanvas } from './MapCanvas'
import { useCanvasLabels } from './useCanvasLabels'
import { useImage } from './useImage'
import { openViewChannel } from './viewChannel'

interface GmCamera {
  mapId: string
  camera: Camera
  width: number
  height: number
}

/**
 * Players' window (SPEC §5.3), opened on a second screen. It never loads the
 * campaign store (no autosave race with the GM window): it reads IndexedDB
 * live and listens to the GM camera and pings.
 */
export function PlayerView() {
  const t = useT()
  useSurface('players')
  const labels = useCanvasLabels()
  const { campaignId = '' } = useParams()
  const [follow, setFollow] = useState(true)
  const [gm, setGm] = useState<GmCamera | null>(null)
  const viewport = useMapViewStore((s) => s.viewport)

  const campaign = useLiveQuery(() => db.campaigns.get(campaignId), [campaignId])
  const play = useMemo(() => normalizePlayState(campaign?.play), [campaign?.play])
  const rules = useMemo(() => withDefaultRules(campaign?.rules), [campaign?.rules])
  const rawMap = useLiveQuery(
    async () => (play.mapId ? ((await db.maps.get(play.mapId)) ?? null) : null),
    [play.mapId],
  )
  const map = useMemo(() => (rawMap ? normalizeMap(rawMap) : null), [rawMap])
  const entityList = useLiveQuery(
    () => db.entities.where('campaignId').equals(campaignId).toArray(),
    [campaignId],
  )
  const entities = useMemo(() => {
    const out: Record<string, Entity> = {}
    for (const e of entityList ?? []) out[e.id] = normalizeEntityShape(e)
    return out
  }, [entityList])
  const imageData = useLiveQuery(
    async () =>
      play.display.imageAssetId
        ? ((await db.assets.get(play.display.imageAssetId))?.data ?? null)
        : null,
    [play.display.imageAssetId],
  )
  const image = useImage(imageData)

  useEffect(() => {
    document.title = `${t.maps.playerView} — Codex`
    const channel = openViewChannel(campaignId, (message) => {
      if (message.type === 'camera') setGm(message)
      else useMapViewStore.getState().addPing(message.point)
    })
    return channel.close
  }, [campaignId, t])

  // The GM camera, scaled to this window: same centre, same visible area.
  const camera = useMemo<Camera | null>(() => {
    if (!follow || !gm || !map || gm.mapId !== map.id || !viewport.width) return null
    const cx = (gm.width / 2 - gm.camera.x) / gm.camera.scale
    const cy = (gm.height / 2 - gm.camera.y) / gm.camera.scale
    const scale = gm.camera.scale * Math.min(viewport.width / gm.width, viewport.height / gm.height)
    return { scale, x: viewport.width / 2 - cx * scale, y: viewport.height / 2 - cy * scale }
  }, [follow, gm, map, viewport])

  const mode = play.display.mode

  return (
    <div className="group relative h-dvh w-screen overflow-hidden bg-[#0f0e15] text-white">
      <h1 className="sr-only">{t.maps.playerView}</h1>
      {mode === 'pause' ? (
        <Centered>
          <p className="font-display text-5xl font-semibold">{t.maps.pause}</p>
          <p className="mt-3 text-lg text-white/70">{t.maps.pauseBody}</p>
        </Centered>
      ) : mode === 'image' && image ? (
        <img src={image.src} alt="" className="size-full object-contain" />
      ) : map ? (
        <MapCanvas
          map={map}
          entities={entities}
          rules={rules}
          viewer="players"
          mode="view"
          labels={labels}
          activeEntityId={play.turn.status === 'playing' ? play.turn.memberId : null}
          camera={camera}
          className="relative size-full overflow-hidden bg-[#0f0e15]"
        />
      ) : (
        <Centered>
          <p className="text-lg text-white/70">{t.maps.waiting}</p>
        </Centered>
      )}

      <div className="absolute right-3 bottom-3 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          onClick={() => setFollow((f) => !f)}
          aria-pressed={follow}
          className="inline-flex h-9 items-center gap-2 rounded-md bg-black/70 px-3 text-sm text-white hover:bg-black/90"
        >
          {follow ? (
            <Video className="size-4" aria-hidden />
          ) : (
            <VideoOff className="size-4" aria-hidden />
          )}
          {follow ? t.maps.followGm : t.maps.freeCamera}
        </button>
        <button
          type="button"
          onClick={() => void document.documentElement.requestFullscreen?.()}
          className="inline-flex h-9 items-center gap-2 rounded-md bg-black/70 px-3 text-sm text-white hover:bg-black/90"
        >
          <Maximize className="size-4" aria-hidden />
          {t.maps.fullscreen}
        </button>
      </div>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex size-full flex-col items-center justify-center text-center">
      {children}
    </div>
  )
}
