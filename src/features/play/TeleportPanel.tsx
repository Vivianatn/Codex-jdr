import * as Popover from '@radix-ui/react-popover'
import { WandSparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { entityName } from '@/domain/entity'
import { entityMapId } from '@/domain/maps'
import { useMapActions } from '@/features/game/useMapActions'
import { useT } from '@/i18n'
import { cn } from '@/lib/cn'
import { useCampaignStore } from '@/stores/campaignStore'
import { useMapViewStore } from '@/stores/mapViewStore'
import { sortedMaps, teleportCandidates } from './teleport'

const SELECT =
  'h-9 min-w-0 rounded-lg border border-line-strong bg-surface px-2 text-sm text-ink pointer-coarse:h-10'
const CHIP =
  'h-8 rounded-full border border-line px-3 text-xs font-medium text-ink-muted hover:bg-surface-2 hover:text-ink pointer-coarse:h-10'

/**
 * Teleporting characters by force (D-276), never blocking the table: tick the
 * characters, give each a destination (or send them all at once), go.
 */
export function TeleportPanel() {
  const t = useT()
  const [open, setOpen] = useState(false)
  const maps = useCampaignStore((s) => s.maps)
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className="flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-medium text-ink-muted hover:bg-surface-2 hover:text-ink disabled:opacity-50 pointer-coarse:h-10"
        aria-label={t.teleport.open}
        title={t.teleport.open}
        disabled={Object.keys(maps).length === 0}
        data-testid="teleport-open"
      >
        <WandSparkles className="size-4" aria-hidden />
        <span className="sr-only @5xl/board:not-sr-only">{t.teleport.title}</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          collisionPadding={16}
          aria-label={t.teleport.open}
          className="z-50 max-h-[80vh] w-[28rem] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-line bg-surface-raised p-3 shadow-lifted"
        >
          <TeleportForm onDone={() => setOpen(false)} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

export function TeleportForm({ onDone }: { onDone?: () => void }) {
  const t = useT()
  const actions = useMapActions()
  const maps = useCampaignStore((s) => s.maps)
  const entities = useCampaignStore((s) => s.entities)
  const playMapId = useCampaignStore((s) => s.play.mapId)
  const selection = useMapViewStore((s) => s.selection)
  const people = useMemo(() => teleportCandidates(entities, maps), [entities, maps])
  const mapList = useMemo(() => sortedMaps(maps), [maps])
  const fallback = (playMapId && maps[playMapId] ? playMapId : mapList[0]?.id) ?? ''
  // Selected tokens of the board in play, as characters.
  const selected = useMemo(() => {
    const map = playMapId ? maps[playMapId] : undefined
    if (!map || selection.type !== 'tokens') return []
    return map.tokens.filter((tk) => selection.ids.includes(tk.id)).map((tk) => tk.entityId)
  }, [maps, playMapId, selection])

  // Opening the panel with tokens selected ticks them already.
  const [checked, setChecked] = useState<ReadonlySet<string>>(() => new Set(selected))
  const [dest, setDest] = useState<Record<string, string>>({})
  const [allTo, setAllTo] = useState('')
  const [familiarsFollow, setFamiliarsFollow] = useState(true)

  const destOf = (id: string) => (dest[id] && maps[dest[id]] ? dest[id] : fallback)
  const tick = (ids: string[]) => setChecked(new Set(ids))
  const toggle = (id: string, on: boolean) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  if (mapList.length === 0) return <p className="text-sm text-ink-muted">{t.teleport.noMaps}</p>

  const chosen = people.filter((e) => checked.has(e.id))
  const submit = () => {
    actions.teleportCharacters(
      chosen.map((e) => ({ entityId: e.id, toMapId: destOf(e.id) })),
      { familiarsFollow },
    )
    setChecked(new Set())
    onDone?.()
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (chosen.length) submit()
      }}
      className="space-y-3"
    >
      <div>
        <p className="type-section">{t.teleport.title}</p>
        <p className="text-xs text-ink-muted">{t.teleport.hint}</p>
      </div>

      <div role="group" aria-label={t.teleport.filters} className="flex flex-wrap gap-1.5">
        <button
          type="button"
          className={CHIP}
          onClick={() => tick(people.filter((e) => e.kind === 'player').map((e) => e.id))}
        >
          {t.teleport.filterPlayers}
        </button>
        <button
          type="button"
          className={CHIP}
          onClick={() => tick(people.filter((e) => e.kind === 'enemy').map((e) => e.id))}
        >
          {t.teleport.filterEnemies}
        </button>
        {selected.length > 0 && (
          <button type="button" className={CHIP} onClick={() => tick(selected)}>
            {t.teleport.filterSelection}
          </button>
        )}
        <button type="button" className={CHIP} onClick={() => tick(people.map((e) => e.id))}>
          {t.teleport.filterAll}
        </button>
        <button type="button" className={CHIP} onClick={() => tick([])}>
          {t.teleport.filterNone}
        </button>
      </div>

      <label className="flex flex-wrap items-center gap-2 text-sm text-ink">
        <span>{t.teleport.allTo}</span>
        <select
          value={allTo}
          onChange={(e) => {
            const to = e.target.value
            setAllTo(to)
            if (to)
              setDest((prev) => ({
                ...prev,
                ...Object.fromEntries([...checked].map((id) => [id, to])),
              }))
          }}
          className={cn(SELECT, 'flex-1')}
        >
          <option value="">…</option>
          {mapList.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>

      {people.length === 0 ? (
        <p className="text-sm text-ink-muted">{t.teleport.nobody}</p>
      ) : (
        <ul className="space-y-1" data-testid="teleport-list">
          {people.map((e) => {
            const name = entityName(e)
            const here = entityMapId(Object.values(maps), e.id, playMapId)
            return (
              <li
                key={e.id}
                className={cn(
                  'flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg px-1.5 py-1',
                  checked.has(e.id) && 'bg-surface-2',
                )}
              >
                <label className="flex min-w-0 flex-1 basis-40 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checked.has(e.id)}
                    onChange={(ev) => toggle(e.id, ev.target.checked)}
                    className="size-4 shrink-0 accent-[var(--codex-accent)]"
                  />
                  <span className="min-w-0 truncate text-sm text-ink">
                    {name}
                    <span className="block truncate text-xs text-ink-muted">
                      {here ? maps[here]!.name : t.teleport.nowhere}
                    </span>
                  </span>
                </label>
                <select
                  aria-label={t.teleport.destination(name)}
                  value={destOf(e.id)}
                  onChange={(ev) => {
                    const to = ev.target.value
                    setDest((prev) => ({ ...prev, [e.id]: to }))
                    toggle(e.id, true)
                  }}
                  className={cn(SELECT, 'w-44 max-w-full')}
                >
                  {mapList.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={familiarsFollow}
            onChange={(e) => setFamiliarsFollow(e.target.checked)}
            className="size-4 accent-[var(--codex-accent)]"
          />
          {t.teleport.familiarsFollow}
        </label>
        <Button
          type="submit"
          variant="primary"
          icon={<WandSparkles className="size-4" />}
          disabled={chosen.length === 0}
        >
          {t.teleport.submit(chosen.length)}
        </Button>
      </div>
    </form>
  )
}
