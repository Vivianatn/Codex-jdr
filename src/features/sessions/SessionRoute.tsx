import { useLiveQuery } from 'dexie-react-hooks'
import {
  ArrowDown,
  ArrowUp,
  DoorOpen,
  GripVertical,
  Map as MapIcon,
  Pencil,
  Plus,
  X,
} from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Button, IconButton } from '@/components/ui/Button'
import { SelectField } from '@/components/ui/fields'
import { TextField } from '@/components/ui/TextField'
import { activeDb } from '@/db/db'
import { newMap, type GameMap } from '@/domain/maps'
import { moveSessionMap, type SessionPlan } from '@/domain/sessions'
import { useCampaign } from '@/features/shell/campaignContext'
import { useT } from '@/i18n'
import { cn } from '@/lib/cn'
import { compareText } from '@/lib/text'
import { useCampaignStore } from '@/stores/campaignStore'

// The door dialog carries the map canvas (Konva): loaded when first opened.
const DoorDialog = lazy(() => import('./DoorDialog').then((m) => ({ default: m.DoorDialog })))

/**
 * The session as a route of maps (D-258): cards in their order of appearance,
 * reordered by dragging or with the arrows, with the doors between them.
 */
export function SessionRoute({
  plan,
  save,
}: {
  plan: SessionPlan
  save: (patch: Partial<SessionPlan>) => Promise<void>
}) {
  const t = useT()
  const campaign = useCampaign()
  const maps = useCampaignStore((s) => s.maps)
  const addMap = useCampaignStore((s) => s.addMap)
  const updateMap = useCampaignStore((s) => s.updateMap)
  const [pick, setPick] = useState('')
  const [newName, setNewName] = useState('')
  const [dragged, setDragged] = useState<number | null>(null)
  const [doorFrom, setDoorFrom] = useState<string | null>(null)

  const route = plan.mapIds.filter((id) => maps[id])
  const step = (id: string) => {
    const i = route.indexOf(id)
    return i >= 0 ? `${i + 1}. ` : ''
  }
  const unused = Object.values(maps)
    .filter((m) => !route.includes(m.id))
    .sort((a, b) => compareText(a.name, b.name))
  const chosen = unused.some((m) => m.id === pick) ? pick : (unused[0]?.id ?? '')

  const setRoute = (mapIds: string[]) => void save({ mapIds })
  const append = (map: GameMap) => {
    setRoute([...route, map.id])
    toast(t.sessions.routeAdded(map.name))
  }
  const createMap = () => {
    const map = newMap(campaign.id, {
      name: newName.trim() || t.sessions.routeNewMapDefault(route.length + 1),
    })
    addMap(map, t.sessions.routeAdded(map.name))
    append(map)
    setNewName('')
  }

  return (
    <div className="space-y-4">
      {route.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line p-4 text-sm text-ink-muted">
          {t.sessions.routeEmpty}
        </p>
      ) : (
        <>
          {route.length > 1 && <p className="text-xs text-ink-muted">{t.sessions.routeDragHint}</p>}
          <ol className="grid gap-3 sm:grid-cols-2" aria-label={t.sessions.route}>
            {route.map((id, index) => {
              const map = maps[id]!
              const doorsOut = map.elements.filter((el) => el.link?.mapId && maps[el.link.mapId])
              const doorsIn = Object.values(maps).filter(
                (m) => m.id !== id && m.elements.some((el) => el.link?.mapId === id),
              )
              return (
                <li
                  key={id}
                  draggable
                  onDragStart={(e) => {
                    setDragged(index)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragEnd={() => setDragged(null)}
                  onDragOver={(e) => {
                    if (dragged !== null) e.preventDefault()
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    if (dragged !== null) setRoute(moveSessionMap(route, dragged, index))
                    setDragged(null)
                  }}
                  className={cn(
                    'flex flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-soft',
                    dragged === index && 'opacity-50',
                  )}
                  data-testid="route-step"
                >
                  <MapThumbnail map={map} step={index + 1} />
                  <div className="flex flex-1 flex-col gap-2 p-3">
                    <div className="flex items-start gap-1">
                      <GripVertical
                        className="mt-0.5 size-4 shrink-0 cursor-grab text-ink-faint"
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className="type-eyebrow">{t.sessions.routeStep(index + 1)}</p>
                        <h3 className="type-card-title break-words text-ink">{map.name}</h3>
                      </div>
                      <IconButton
                        size="sm"
                        label={t.sessions.routeMoveUp(map.name)}
                        icon={<ArrowUp />}
                        disabled={index === 0}
                        onClick={() => setRoute(moveSessionMap(route, index, index - 1))}
                      />
                      <IconButton
                        size="sm"
                        label={t.sessions.routeMoveDown(map.name)}
                        icon={<ArrowDown />}
                        disabled={index === route.length - 1}
                        onClick={() => setRoute(moveSessionMap(route, index, index + 1))}
                      />
                      <IconButton
                        size="sm"
                        label={t.sessions.routeRemove(map.name)}
                        icon={<X />}
                        onClick={() => setRoute(route.filter((x) => x !== id))}
                      />
                    </div>

                    <div className="space-y-1 text-sm">
                      <p className="text-xs font-semibold text-ink-muted">
                        {t.sessions.routeDoors}
                      </p>
                      {doorsOut.length === 0 && doorsIn.length === 0 && (
                        <p className="text-xs text-ink-muted">{t.sessions.routeNoDoor}</p>
                      )}
                      <ul className="space-y-0.5">
                        {doorsOut.map((el) => {
                          const target = maps[el.link!.mapId!]!
                          return (
                            <li key={el.id} className="flex items-center gap-1.5 text-ink">
                              <DoorOpen className="size-4 shrink-0 text-gold-text" aria-hidden />
                              <span className="min-w-0 flex-1 break-words">
                                {t.sessions.routeDoorTo(step(target.id), target.name)}
                              </span>
                              <IconButton
                                size="sm"
                                label={t.sessions.routeRemoveDoor(target.name)}
                                icon={<X />}
                                onClick={() =>
                                  updateMap(
                                    map.id,
                                    (m) => ({
                                      ...m,
                                      elements: m.elements.filter((x) => x.id !== el.id),
                                    }),
                                    t.sessions.routeDoorRemoved(target.name),
                                  )
                                }
                              />
                            </li>
                          )
                        })}
                        {doorsIn.map((m) => (
                          <li key={m.id} className="flex items-center gap-1.5 text-ink-muted">
                            <DoorOpen className="size-4 shrink-0 -scale-x-100" aria-hidden />
                            <span className="min-w-0 break-words">
                              {t.sessions.routeDoorFrom(step(m.id), m.name)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-auto flex flex-wrap gap-2 pt-1">
                      <Button
                        size="sm"
                        icon={<DoorOpen />}
                        disabled={route.length < 2}
                        onClick={() => setDoorFrom(id)}
                      >
                        {t.sessions.placeDoor}
                      </Button>
                      <Link
                        to={`/c/${campaign.id}/prep/maps/m/${id}`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm text-ink-muted hover:bg-surface-2 hover:text-ink"
                      >
                        <Pencil className="size-4" aria-hidden />
                        {t.sessions.routeOpen}
                      </Link>
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        </>
      )}

      <div className="grid gap-3 rounded-lg border border-line p-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          {unused.length === 0 ? (
            <p className="text-sm text-ink-muted">{t.sessions.routeAllUsed}</p>
          ) : (
            <>
              <SelectField<string>
                label={t.sessions.routeAddExisting}
                value={chosen}
                onChange={setPick}
                options={unused.map((m) => ({ value: m.id, label: m.name }))}
              />
              <Button
                icon={<Plus />}
                className="self-start"
                onClick={() => maps[chosen] && append(maps[chosen])}
              >
                {t.sessions.routeAdd}
              </Button>
            </>
          )}
        </div>
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            createMap()
          }}
        >
          <TextField
            label={t.sessions.routeNewMapName}
            placeholder={t.sessions.routeNewMapDefault(route.length + 1)}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Button type="submit" icon={<Plus />} className="self-start">
            {t.sessions.routeNewMap}
          </Button>
        </form>
      </div>

      {doorFrom && (
        <Suspense fallback={null}>
          <DoorDialog fromId={doorFrom} routeIds={route} onClose={() => setDoorFrom(null)} />
        </Suspense>
      )}
    </div>
  )
}

/** The map's picture when it has one, else its grid, with the step number. */
function MapThumbnail({ map, step }: { map: GameMap; step: number }) {
  const assetId = map.background.assetId
  const src = useLiveQuery(
    async () => (assetId ? ((await activeDb().assets.get(assetId))?.data ?? null) : null),
    [assetId],
  )
  return (
    <div className="relative aspect-[16/7] bg-surface-2">
      {src ? (
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <div
          className="flex size-full items-center justify-center text-ink-faint"
          style={{
            backgroundImage:
              'linear-gradient(var(--codex-line) 1px, transparent 1px), linear-gradient(90deg, var(--codex-line) 1px, transparent 1px)',
            backgroundSize: '16px 16px',
          }}
        >
          <MapIcon className="size-8" aria-hidden />
        </div>
      )}
      <span className="absolute top-2 left-2 flex size-7 items-center justify-center rounded-full bg-accent font-title text-sm font-bold text-accent-contrast shadow-soft">
        {step}
      </span>
    </div>
  )
}
