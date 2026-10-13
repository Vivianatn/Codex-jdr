import { Check } from 'lucide-react'
import { useMemo } from 'react'
import { entityName } from '@/domain/entity'
import type { GameMap } from '@/domain/maps'
import type { Entity, EntityKind } from '@/domain/types'
import { Portrait } from '@/features/characters/Portrait'
import { useT } from '@/i18n'
import { compareText } from '@/lib/text'
import { useCampaignStore } from '@/stores/campaignStore'
import { ENTITY_DRAG_TYPE } from './dragTypes'

const ORDER: EntityKind[] = ['player', 'ally', 'familiar', 'enemy']

/**
 * Every character of the campaign, for the map editor (D-259): players,
 * allies, familiars and enemies alike. Drag one onto the board, or click to
 * put it in the middle (keyboard friendly).
 */
export function MapCharacters({
  map,
  onPlace,
}: {
  map: GameMap
  onPlace: (entityId: string) => void
}) {
  const t = useT()
  const entities = useCampaignStore((s) => s.entities)
  const groups = useMemo(() => {
    const all = Object.values(entities)
    return ORDER.map((kind) => ({
      kind,
      list: all
        .filter((e) => e.kind === kind)
        .sort((a, b) => compareText(entityName(a), entityName(b))),
    })).filter((g) => g.list.length > 0)
  }, [entities])
  const here = new Set(map.tokens.map((tk) => tk.entityId))

  if (groups.length === 0) return <p className="text-xs text-ink-muted">{t.maps.noCharacters}</p>
  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-muted">{t.maps.charactersHint}</p>
      {groups.map((g) => (
        <div key={g.kind}>
          <p className="mb-1 text-xs font-semibold text-ink-muted">{t.kinds[g.kind]}</p>
          <ul className="space-y-0.5">
            {g.list.map((e) => (
              <li key={e.id}>
                <CharacterRow entity={e} placed={here.has(e.id)} onPlace={onPlace} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function CharacterRow({
  entity,
  placed,
  onPlace,
}: {
  entity: Entity
  placed: boolean
  onPlace: (entityId: string) => void
}) {
  const t = useT()
  const name = entityName(entity)
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(ENTITY_DRAG_TYPE, entity.id)
        e.dataTransfer.effectAllowed = 'copyMove'
      }}
      onClick={() => onPlace(entity.id)}
      aria-label={t.maps.placeCharacter(name)}
      className="flex min-h-10 w-full min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-surface-2"
    >
      <Portrait src={entity.identity.portrait} name={name} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-ink">{name}</span>
        {placed && (
          <span className="flex items-center gap-1 text-xs text-ink-muted">
            <Check className="size-3" aria-hidden />
            {t.maps.onThisMap}
          </span>
        )}
      </span>
    </button>
  )
}
