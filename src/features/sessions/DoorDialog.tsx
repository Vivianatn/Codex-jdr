import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { SelectField } from '@/components/ui/fields'
import { passagesTo, withPassage, withReturnPassage, type Cell } from '@/domain/maps'
import { MapCanvas } from '@/features/maps/MapCanvas'
import { useCanvasLabels } from '@/features/maps/useCanvasLabels'
import { useCampaign } from '@/features/shell/campaignContext'
import { useT } from '@/i18n'
import { campaignHistory, useCampaignStore } from '@/stores/campaignStore'

/**
 * Places a door between two maps of a session (D-258), straight on the board:
 * a click on the first map sets the door, a click on the second sets the way
 * back (where travellers arrive). Loaded on demand: it carries the canvas.
 */
export function DoorDialog({
  fromId,
  routeIds,
  onClose,
}: {
  fromId: string
  /** The session's maps, in order: the default target is the next one. */
  routeIds: readonly string[]
  onClose: () => void
}) {
  const t = useT()
  const campaign = useCampaign()
  const maps = useCampaignStore((s) => s.maps)
  const entities = useCampaignStore((s) => s.entities)
  const updateMap = useCampaignStore((s) => s.updateMap)
  const labels = useCanvasLabels()
  const targets = routeIds.filter((id) => id !== fromId && maps[id])
  const index = routeIds.indexOf(fromId)
  const [targetId, setTargetId] = useState(
    targets.find((id) => routeIds.indexOf(id) > index) ?? targets[0] ?? '',
  )
  const [step, setStep] = useState<'door' | 'back'>('door')
  const from = maps[fromId]
  const target = maps[targetId]
  if (!from) return null

  const placeDoor = (cell: Cell) => {
    if (!target) return
    const label = t.sessions.doorPlaced(from.name, target.name)
    const hadWayBack = passagesTo(target, from.id).length > 0
    // A door has two sides (D-259): the way back is set at once, in the same undo step.
    campaignHistory.getState().transaction(label, () => {
      updateMap(
        from.id,
        (m) => withPassage(m, cell, target.id, t.sessions.doorDefaultLabel(target.name)),
        label,
      )
      updateMap(
        target.id,
        (m) =>
          withReturnPassage(
            m,
            from,
            { x: cell.col, y: cell.row },
            t.sessions.doorDefaultLabel(from.name),
          ),
        label,
      )
    })
    toast(label)
    // The GM may still move the new way back; an existing one stays where it was.
    if (hadWayBack) onClose()
    else setStep('back')
  }
  const moveBack = (cell: Cell) => {
    if (!target) return
    const back = passagesTo(target, from.id)[0]
    if (back)
      updateMap(
        target.id,
        (m) => ({
          ...m,
          elements: m.elements.map((el) =>
            el.id === back.id ? { ...el, x: cell.col, y: cell.row } : el,
          ),
        }),
        t.sessions.doorBackPlaced(from.name),
      )
    toast(t.sessions.doorBackPlaced(from.name))
    onClose()
  }

  const shown = step === 'door' ? from : target
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={
        step === 'door'
          ? t.sessions.doorTitle(from.name)
          : t.sessions.doorBackTitle(target?.name ?? '')
      }
      className="max-w-5xl"
    >
      {targets.length === 0 ? (
        <p className="text-sm text-ink-muted">{t.sessions.doorNoTarget}</p>
      ) : (
        <div className="space-y-3">
          {step === 'door' ? (
            <>
              <SelectField<string>
                label={t.sessions.doorTarget}
                value={targetId}
                onChange={setTargetId}
                options={targets.map((id) => ({
                  value: id,
                  label: `${routeIds.indexOf(id) + 1}. ${maps[id]!.name}`,
                }))}
              />
              <p className="text-sm text-ink-muted">{t.sessions.doorPickHint}</p>
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-ink-muted">{t.sessions.doorBackHint(from.name)}</p>
              <Button variant="ghost" size="sm" onClick={onClose}>
                {t.sessions.doorNoBack}
              </Button>
            </div>
          )}
          {shown && (
            <section
              aria-label={shown.name}
              className="relative h-[60vh] min-h-72 overflow-hidden rounded-lg border border-line"
              data-testid="door-board"
            >
              <MapCanvas
                key={shown.id}
                map={shown}
                entities={entities}
                rules={campaign.rules}
                viewer="gm"
                mode="view"
                labels={labels}
                mapNames={Object.fromEntries(Object.values(maps).map((m) => [m.id, m.name]))}
                onCellPick={step === 'door' ? placeDoor : moveBack}
              />
            </section>
          )}
        </div>
      )}
    </Dialog>
  )
}
