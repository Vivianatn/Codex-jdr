import { MapPin, X } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/Button'
import { entityName } from '@/domain/entity'
import { tokenSize } from '@/features/play/teleport'
import { useTeleportPick } from '@/features/play/useTeleportPick'
import { useCampaign } from '@/features/shell/campaignContext'
import { useT } from '@/i18n'
import { useCampaignStore } from '@/stores/campaignStore'
import type { TeleportPick } from '@/stores/mapViewStore'
import { MapCanvas } from './MapCanvas'
import { ZoomControl } from './MapToolbar'
import { useCanvasLabels } from './useCanvasLabels'

/**
 * The GM's board while choosing a teleport landing cell (D-277): it shows the
 * destination map for the GM only (play.mapId and the players' view do not
 * change), the token's footprint follows the pointer, a click or a tap picks.
 * Escape, right-click or « Annuler » gives the previous view back.
 */
export function TeleportPickBoard({ pick }: { pick: TeleportPick }) {
  const t = useT()
  const campaign = useCampaign()
  const maps = useCampaignStore((s) => s.maps)
  const entities = useCampaignStore((s) => s.entities)
  const labels = useCanvasLabels()
  const picker = useTeleportPick()
  const current = pick.queue[0]
  const map = current ? maps[current.mapId] : undefined
  const entity = current ? entities[current.entityId] : undefined
  const mapNames = useMemo(
    () => Object.fromEntries(Object.values(maps).map((m) => [m.id, m.name])),
    [maps],
  )

  useEffect(() => {
    if (!map || !entity) picker.cancel()
  }, [map, entity, picker])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') picker.cancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [picker])

  if (!current || !map || !entity) return null
  const marks = Object.entries(pick.chosen)
    .filter(([id, c]) => id !== current.entityId && c.mapId === map.id)
    .map(([id, c]) => ({ cell: c.cell, size: tokenSize(maps, id) }))
  const index = pick.total - pick.queue.length + 1

  return (
    <div
      className="relative size-full"
      data-testid="teleport-pick"
      onContextMenu={(e) => {
        e.preventDefault()
        picker.cancel()
      }}
    >
      <MapCanvas
        key={map.id}
        map={map}
        entities={entities}
        rules={campaign.rules}
        viewer="gm"
        mode="view"
        labels={labels}
        mapNames={mapNames}
        onCellPick={(cell) => picker.choose(cell)}
        pickGhost={{ size: tokenSize(maps, current.entityId), marks }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-4 z-10 flex justify-center px-4">
        <div
          role="status"
          className="codex-glass pointer-events-auto flex max-w-full flex-wrap items-center gap-x-3 gap-y-2 !rounded-xl px-3 py-2"
        >
          <MapPin className="size-5 shrink-0 text-accent-text" aria-hidden />
          <div className="min-w-0">
            <p className="type-eyebrow">{t.teleport.pickWhere(map.name, index, pick.total)}</p>
            <p className="text-sm font-medium text-ink">
              {t.teleport.pickBanner(entityName(entity))}
            </p>
          </div>
          <Button variant="ghost" size="sm" icon={<X />} onClick={() => picker.cancel()}>
            {t.teleport.pickCancel}
          </Button>
        </div>
      </div>
      <ZoomControl map={map} className="absolute right-4 bottom-5 z-10 hidden md:flex" />
    </div>
  )
}
