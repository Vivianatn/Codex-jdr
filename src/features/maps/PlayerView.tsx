import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion } from 'framer-motion'
import { Maximize, Video, VideoOff } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { useSurface } from '@/app/useSurface'
import { activeDb } from '@/db/db'
import { CandleOrnament, Ornament } from '@/components/Brand'
import { entityName, normalizeEntityShape } from '@/domain/entity'
import { normalizeMap } from '@/domain/maps'
import { normalizePlayState } from '@/domain/turns'
import type { Entity } from '@/domain/types'
import { useT } from '@/i18n'
import { cn } from '@/lib/cn'
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

  const campaign = useLiveQuery(() => activeDb().campaigns.get(campaignId), [campaignId])
  const play = useMemo(() => normalizePlayState(campaign?.play), [campaign?.play])
  const rules = useMemo(() => withDefaultRules(campaign?.rules), [campaign?.rules])
  const rawMap = useLiveQuery(
    async () => (play.mapId ? ((await activeDb().maps.get(play.mapId)) ?? null) : null),
    [play.mapId],
  )
  const map = useMemo(() => (rawMap ? normalizeMap(rawMap) : null), [rawMap])
  const entityList = useLiveQuery(
    () => activeDb().entities.where('campaignId').equals(campaignId).toArray(),
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
        ? ((await activeDb().assets.get(play.display.imageAssetId))?.data ?? null)
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

  const turn = play.turn
  const active = turn.status === 'playing' ? entities[turn.memberId] : undefined
  const turnText =
    turn.status === 'gm' ? t.turns.gmTurn : active ? t.turns.yourTurn(entityName(active)) : null
  // The screen shown; a missing image falls back to the map.
  const screen =
    mode === 'pause' ? 'pause' : mode === 'image' && image ? 'image' : map ? 'map' : 'waiting'

  return (
    <div className="group relative h-dvh w-screen overflow-hidden bg-[#0B0907] text-[#F2EADD]">
      <h1 className="sr-only">{t.maps.playerView}</h1>
      <AnimatePresence mode="wait">
        <motion.div
          key={screen}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.4 } }}
          exit={{ opacity: 0, transition: { duration: 0.3 } }}
        >
          {screen === 'pause' ? (
            <PauseScreen title={campaign?.name ?? ''} />
          ) : screen === 'image' ? (
            <img src={image!.src} alt="" className="size-full object-cover" />
          ) : screen === 'map' ? (
            <MapCanvas
              map={map!}
              entities={entities}
              rules={rules}
              viewer="players"
              mode="view"
              labels={labels}
              activeEntityId={turn.status === 'playing' ? turn.memberId : null}
              camera={camera}
              className="relative size-full overflow-hidden"
            />
          ) : (
            <Centered>
              <CandleOrnament className="h-[8.9vh] w-[5.9vh] text-[#C9963A]" />
              <p className="mt-[3vh] font-title text-[3vh] text-[#D9CFBE]">{t.maps.waiting}</p>
            </Centered>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Turn banner, inside the 5 % TV safety margin (DA §10.8). */}
      {screen === 'map' && turn.status !== 'stopped' && (
        <div
          className="absolute top-[5%] left-[5%] flex items-baseline gap-[1.4vh] rounded-lg border border-[rgba(201,150,58,0.6)] bg-[rgba(21,17,13,0.86)] px-[2vh] py-[1.2vh]"
          aria-live="polite"
        >
          <span className="font-display text-[2.4vh] font-bold tracking-[0.14em] text-[#EBC274] uppercase">
            {t.turns.round(turn.round)}
          </span>
          {turnText && <span className="text-[3.15vh] font-semibold">{turnText}</span>}
        </div>
      )}

      <div className="absolute right-[5%] bottom-[5%] flex gap-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          onClick={() => setFollow((f) => !f)}
          aria-pressed={follow}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-[rgba(21,17,13,0.86)] px-3 text-sm font-semibold text-[#F2EADD] hover:bg-[rgba(21,17,13,0.96)]"
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
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-[rgba(21,17,13,0.86)] px-3 text-sm font-semibold text-[#F2EADD] hover:bg-[rgba(21,17,13,0.96)]"
        >
          <Maximize className="size-4" aria-hidden />
          {t.maps.fullscreen}
        </button>
      </div>
    </div>
  )
}

/** Pause (DA §10.8): candlelight on warm black, the campaign's title, a rule. */
function PauseScreen({ title }: { title: string }) {
  const t = useT()
  return (
    <Centered className="bg-[#15110D] bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(224,174,78,0.10),transparent)]">
      <CandleOrnament className="h-[8.9vh] w-[5.9vh] text-[#C9963A]" />
      <p className="mt-[3vh] font-display text-[1.5vh] font-bold tracking-[0.22em] text-[#EBC274] uppercase">
        {t.maps.pause}
      </p>
      {title && (
        <p className="mt-[1.5vh] max-w-[90vw] font-display text-[7.96vh] leading-[1.1] font-semibold tracking-[0.04em]">
          {title}
        </p>
      )}
      <Ornament width={360} height={24} stroke={1.5} className="mt-[3vh] text-[#C9963A]" />
      <p className="mt-[3vh] max-w-[80vw] font-title text-[3.98vh] leading-[1.3] font-medium text-[#D9CFBE]">
        {t.maps.pauseBody}
      </p>
    </Centered>
  )
}

function Centered({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex size-full flex-col items-center justify-center p-[5%] text-center',
        className,
      )}
    >
      {children}
    </div>
  )
}
