import { Crosshair, MapPin, Trash } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { CheckboxField, SelectField } from '@/components/ui/fields'
import { entityName } from '@/domain/entity'
import type { Entity } from '@/domain/types'
import { useMapActions } from '@/features/game/useMapActions'
import { useT } from '@/i18n'
import { useCampaignStore } from '@/stores/campaignStore'
import { cameraControls } from './cameraControls'

/** Quick panel: the character's token on the map in play (place, size, hide, remove). */
export function MapTokenBlock({ entity }: { entity: Entity }) {
  const t = useT()
  const actions = useMapActions()
  const map = useCampaignStore((s) => (s.play.mapId ? s.maps[s.play.mapId] : undefined))
  if (!map) return null
  const token = map.tokens.find((tk) => tk.entityId === entity.id)
  const name = entityName(entity)

  if (!token)
    return (
      <Button size="sm" icon={<MapPin />} onClick={() => actions.placeToken(map.id, entity.id)}>
        {t.maps.placeOnMap}
      </Button>
    )

  return (
    <section aria-labelledby="quick-token" className="space-y-2">
      <h3 id="quick-token" className="font-sans text-sm font-semibold tracking-normal text-ink">
        {map.name}
      </h3>
      <div className="flex flex-wrap items-end gap-2">
        <SelectField<string>
          label={t.maps.tokenSize}
          value={String(token.size)}
          onChange={(v) =>
            actions.updateToken(map.id, token.id, { size: Number(v) }, t.maps.tokenResized)
          }
          options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: `${n} × ${n}` }))}
          className="w-28"
        />
        <Button
          size="md"
          variant="ghost"
          icon={<Crosshair />}
          onClick={() => {
            const p = actions.tokenPoint(map.id, entity.id)
            if (p) cameraControls(map).centerOn(p)
          }}
        >
          {t.maps.centerOn(name)}
        </Button>
      </div>
      <CheckboxField
        label={t.maps.tokenHidden}
        checked={token.hidden}
        onChange={(hidden) =>
          actions.updateToken(map.id, token.id, { hidden }, t.maps.tokenHiddenChanged)
        }
      />
      <Button
        size="sm"
        variant="ghost"
        icon={<Trash />}
        onClick={() => actions.removeToken(map.id, token.id, t.maps.removedFromMap(name))}
      >
        {t.maps.removeFromMap}
      </Button>
    </section>
  )
}
