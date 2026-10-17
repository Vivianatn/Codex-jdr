import { useMemo } from 'react'
import { toast } from 'sonner'
import type { Cell } from '@/domain/maps'
import type { MapActions } from '@/features/game/mapActions'
import { useMapActions } from '@/features/game/useMapActions'
import { useT } from '@/i18n'
import type { Messages } from '@/i18n/locales/fr'
import { useCampaignStore } from '@/stores/campaignStore'
import { useMapViewStore, type ChosenCell, type TeleportPick } from '@/stores/mapViewStore'
import { advancePick, pickProblem } from './teleport'

/**
 * Picking the exact landing cells of a teleport on the board (D-277): start a
 * queue, choose a cell per character, then go back to the panel with the cells
 * or teleport at once (board menu path, ONE undo entry). Cancel restores the view.
 */
export function useTeleportPick() {
  const t = useT()
  const actions = useMapActions()
  return useMemo(() => createTeleportPicker(t, actions), [t, actions])
}

/** The picking logic on the stores, for `useTeleportPick` (and tests). */
export function createTeleportPicker(t: Messages, actions: Pick<MapActions, 'teleportCharacters'>) {
  const view = () => useMapViewStore.getState()
  return {
    start(
      queue: TeleportPick['queue'],
      then: TeleportPick['then'],
      chosen: Record<string, ChosenCell> = {},
    ) {
      if (!queue.length) return
      const rest = { ...chosen }
      for (const q of queue) delete rest[q.entityId]
      view().setTeleportOpen(false)
      view().setTeleportPick({ queue, total: queue.length, chosen: rest, then })
    },
    /** True when the cell was accepted. */
    choose(cell: Cell): boolean {
      const pick = view().teleportPick
      if (!pick) return false
      const problem = pickProblem(useCampaignStore.getState().maps, pick, cell)
      if (problem) {
        toast(problem === 'occupied' ? t.teleport.pickOccupied : t.teleport.pickOutside)
        return false
      }
      const next = advancePick(pick, cell)
      if (next.queue.length) {
        view().setTeleportPick(next)
        return true
      }
      view().setTeleportPick(null)
      if (next.then === 'teleport') {
        actions.teleportCharacters(
          Object.entries(next.chosen).map(([entityId, c]) => ({
            entityId,
            toMapId: c.mapId,
            at: c.cell,
          })),
        )
      } else {
        const draft = view().teleportDraft
        if (draft) view().setTeleportDraft({ ...draft, at: { ...draft.at, ...next.chosen } })
        view().setTeleportOpen(true)
      }
      return true
    },
    cancel() {
      const pick = view().teleportPick
      view().setTeleportPick(null)
      if (pick?.then === 'panel') view().setTeleportOpen(true)
    },
  }
}
