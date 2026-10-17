import { Crosshair, MapPin, MapPinOff, PawPrint, Skull, UserMinus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { CheckboxField, SelectField } from '@/components/ui/fields'
import { entityName } from '@/domain/entity'
import { familiarsOf } from '@/domain/familiars'
import { groupOf } from '@/domain/turns'
import type { Entity } from '@/domain/types'
import { useMapActions } from '@/features/game/useMapActions'
import { DeleteEnemyDialog } from '@/features/play/BoardMenu'
import { useT } from '@/i18n'
import { useCampaignStore } from '@/stores/campaignStore'
import { useShallow } from 'zustand/react/shallow'
import { cameraControls } from './cameraControls'

/**
 * Quick panel: the character's token on the map in play (place, size, hide),
 * and the GM's board gestures (D-269): take it off the board (and out of the
 * turns), bring its familiars next to it, delete an enemy.
 */
export function MapTokenBlock({ entity }: { entity: Entity }) {
  const t = useT()
  const actions = useMapActions()
  const [confirming, setConfirming] = useState(false)
  const map = useCampaignStore((s) => (s.play.mapId ? s.maps[s.play.mapId] : undefined))
  const grouped = useCampaignStore((s) => Boolean(groupOf(s.play, entity.id)))
  const familiars = useCampaignStore(
    useShallow((s) => familiarsOf(Object.values(s.entities), entity.id)),
  )
  if (!map) return null
  const token = map.tokens.find((tk) => tk.entityId === entity.id)
  const name = entityName(entity)
  const enemy = entity.kind === 'enemy'
  // Only player characters' and enemies' familiars are brought in play (D-269).
  const toPlace =
    entity.kind === 'player' || enemy
      ? familiars.filter((f) => !map.tokens.some((tk) => tk.entityId === f.id))
      : []
  const following = familiars.filter((f) => map.tokens.some((tk) => tk.entityId === f.id))

  const gestures = (
    <div className="flex flex-wrap gap-2">
      {token && (
        <Button
          size="sm"
          variant="ghost"
          icon={<MapPinOff />}
          onClick={() => actions.removeFromBoard(entity.id)}
        >
          {t.crew.removeFromBoard}
        </Button>
      )}
      {grouped && (
        <Button
          size="sm"
          variant="ghost"
          icon={<UserMinus />}
          onClick={() => actions.removeFromBoard(entity.id, { fromTurns: true })}
        >
          {token ? t.crew.removeFromBoardAndTurns : t.crew.removeFromTurns}
        </Button>
      )}
      {toPlace.map((f) => (
        <Button
          key={f.id}
          size="sm"
          variant="secondary"
          icon={<PawPrint />}
          onClick={() => actions.addFamiliar(map.id, f.id)}
        >
          {t.crew.placeFamiliar(entityName(f))}
        </Button>
      ))}
      {enemy && (
        <Button size="sm" variant="danger" icon={<Skull />} onClick={() => setConfirming(true)}>
          {t.crew.deleteEnemy}
        </Button>
      )}
      {enemy && (
        <DeleteEnemyDialog
          name={name}
          open={confirming}
          onOpenChange={setConfirming}
          onConfirm={() => actions.deleteEnemy(entity.id)}
        />
      )}
    </div>
  )

  if (!token)
    return (
      <section aria-label={map.name} className="space-y-2">
        <Button size="sm" icon={<MapPin />} onClick={() => actions.placeToken(map.id, entity.id)}>
          {t.maps.placeOnMap}
        </Button>
        {gestures}
      </section>
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
      {gestures}
      {following.length > 0 && (
        <p className="text-xs text-ink-muted">{t.crew.familiarsFollow(following.length)}</p>
      )}
    </section>
  )
}
