import { entityName } from '@/domain/entity'
import {
  assignColor,
  playerColorOf,
  usedPlayerColors,
  type PlayerColorKey,
} from '@/domain/playerColors'
import type { Entity } from '@/domain/types'
import type { Messages } from '@/i18n/locales/fr'
import { useCampaignStore } from '@/stores/campaignStore'

function withColor(color: PlayerColorKey | null) {
  return (e: Entity): Entity =>
    e.kind === 'player' ? { ...e, details: { ...e.details, color } } : e
}

/** Changes a player character's colour: one undoable change (D-268). */
export function setPlayerColor(t: Messages, characterId: string, color: PlayerColorKey | null) {
  const s = useCampaignStore.getState()
  const entity = s.entities[characterId]
  if (entity?.kind !== 'player' || playerColorOf(entity) === color) return
  s.updateEntity(characterId, withColor(color), t.playerColors.changed(entityName(entity)))
}

/**
 * Gives a colour to a player character joining a game when it has none yet
 * (D-268): the first one no other player character of the campaign wears.
 * Acts on the operator's open campaign (an undoable change that syncs like any
 * other); returns the character's colour, or null when it is not open here.
 */
export function ensurePlayerColor(
  t: Messages,
  campaignId: string,
  characterId: string,
): PlayerColorKey | null {
  const s = useCampaignStore.getState()
  if (s.campaignId !== campaignId || s.status !== 'ready') return null
  const entity = s.entities[characterId]
  if (entity?.kind !== 'player') return null
  const current = playerColorOf(entity)
  if (current) return current
  const color = assignColor(usedPlayerColors(Object.values(s.entities)))
  s.updateEntity(characterId, withColor(color), t.playerColors.assigned(entityName(entity)))
  return color
}
