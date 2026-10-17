import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  EllipsisVertical,
  MapPinOff,
  PawPrint,
  Skull,
  Trash,
  UserMinus,
  WandSparkles,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button, IconButton } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { entityName } from '@/domain/entity'
import { familiarsOf } from '@/domain/familiars'
import { groupOf } from '@/domain/turns'
import type { Entity } from '@/domain/types'
import { useMapActions } from '@/features/game/useMapActions'
import { useT } from '@/i18n'
import { cn } from '@/lib/cn'
import { useCampaignStore } from '@/stores/campaignStore'
import { sortedMaps } from './teleport'

/** A group member order and removal, folded into the same menu (D-272). */
export interface MemberGestures {
  up?: () => void
  down?: () => void
  leave: () => void
}

const MENU_ITEM =
  'flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-ink outline-none data-[highlighted]:bg-surface-2 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-ink-muted'

/**
 * The GM's board gestures for one character in play (D-269): take it off the
 * board (and out of the turns), bring its familiars next to it, delete an
 * enemy. A player character is never deleted from here. In a group, the
 * member order and leaving the group come first (D-272: one menu per row
 * instead of four buttons).
 */
export function BoardMenu({
  entity,
  member,
  className,
}: {
  entity: Entity
  member?: MemberGestures
  className?: string
}) {
  const t = useT()
  const actions = useMapActions()
  const [confirming, setConfirming] = useState(false)
  const name = entityName(entity)
  const mapId = useCampaignStore((s) => s.play.mapId)
  const onBoard = useCampaignStore((s) =>
    Object.values(s.maps).some((m) => m.tokens.some((tk) => tk.entityId === entity.id)),
  )
  const grouped = useCampaignStore((s) => Boolean(groupOf(s.play, entity.id)))
  const entities = useCampaignStore((s) => s.entities)
  const map = useCampaignStore((s) => (mapId ? s.maps[mapId] : undefined))
  const maps = useCampaignStore((s) => s.maps)
  const mapList = useMemo(() => sortedMaps(maps), [maps])
  // Where it stands now (the board in play first), marked in « Téléporter vers… ».
  const hereId =
    mapId && maps[mapId]?.tokens.some((tk) => tk.entityId === entity.id)
      ? mapId
      : mapList.find((m) => m.tokens.some((tk) => tk.entityId === entity.id))?.id
  // Only player characters and enemies bring familiars in play (the GM's choice, D-269).
  const familiars =
    map && (entity.kind === 'player' || entity.kind === 'enemy')
      ? familiarsOf(Object.values(entities), entity.id).filter(
          (f) => !map.tokens.some((tk) => tk.entityId === f.id),
        )
      : []
  const enemy = entity.kind === 'enemy'
  if (!member && !onBoard && !grouped && !familiars.length && !enemy && !mapList.length) return null

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <IconButton
            size="sm"
            label={t.crew.boardMenu(name)}
            icon={<EllipsisVertical />}
            className={cn('pointer-coarse:size-10', className)}
          />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            className="z-50 max-w-[calc(100vw-2rem)] min-w-52 rounded-xl border border-line bg-surface-raised p-1 shadow-lifted"
          >
            {member && (
              <>
                {member.up && (
                  <DropdownMenu.Item className={MENU_ITEM} onSelect={member.up}>
                    <ChevronUp /> {t.turns.moveUp(name)}
                  </DropdownMenu.Item>
                )}
                {member.down && (
                  <DropdownMenu.Item className={MENU_ITEM} onSelect={member.down}>
                    <ChevronDown /> {t.turns.moveDown(name)}
                  </DropdownMenu.Item>
                )}
                <DropdownMenu.Item className={MENU_ITEM} onSelect={member.leave}>
                  <X /> {t.turns.removeMember(name)}
                </DropdownMenu.Item>
                {(onBoard || familiars.length > 0 || enemy || mapList.length > 0) && (
                  <DropdownMenu.Separator className="my-1 h-px bg-line" />
                )}
              </>
            )}
            {mapList.length > 0 && (
              <DropdownMenu.Sub>
                <DropdownMenu.SubTrigger
                  className={MENU_ITEM}
                  aria-label={t.teleport.menuLabel(name)}
                >
                  <WandSparkles /> <span className="flex-1">{t.teleport.to}</span>
                  <ChevronRight />
                </DropdownMenu.SubTrigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.SubContent
                    sideOffset={4}
                    collisionPadding={16}
                    className="z-50 max-h-[60vh] max-w-[calc(100vw-2rem)] min-w-48 overflow-y-auto rounded-xl border border-line bg-surface-raised p-1 shadow-lifted"
                  >
                    {mapList.map((m) => (
                      <DropdownMenu.Item
                        key={m.id}
                        className={MENU_ITEM}
                        onSelect={() =>
                          actions.teleportCharacters([{ entityId: entity.id, toMapId: m.id }])
                        }
                      >
                        <Check className={cn(m.id !== hereId && 'invisible')} aria-hidden />
                        <span className="min-w-0 flex-1 break-words">{m.name}</span>
                        {m.id === mapId && (
                          <span className="text-xs text-ink-muted">{t.teleport.current}</span>
                        )}
                      </DropdownMenu.Item>
                    ))}
                  </DropdownMenu.SubContent>
                </DropdownMenu.Portal>
              </DropdownMenu.Sub>
            )}
            {onBoard && (
              <DropdownMenu.Item
                className={MENU_ITEM}
                onSelect={() => actions.removeFromBoard(entity.id)}
              >
                <MapPinOff /> {t.crew.removeFromBoard}
              </DropdownMenu.Item>
            )}
            {grouped && (onBoard || !member) && (
              <DropdownMenu.Item
                className={MENU_ITEM}
                onSelect={() => actions.removeFromBoard(entity.id, { fromTurns: true })}
              >
                <UserMinus /> {onBoard ? t.crew.removeFromBoardAndTurns : t.crew.removeFromTurns}
              </DropdownMenu.Item>
            )}
            {familiars.map((f) => (
              <DropdownMenu.Item
                key={f.id}
                className={MENU_ITEM}
                onSelect={() => actions.addFamiliar(map!.id, f.id)}
              >
                <PawPrint /> {t.crew.placeFamiliar(entityName(f))}
              </DropdownMenu.Item>
            ))}
            {enemy && (
              <>
                <DropdownMenu.Separator className="my-1 h-px bg-line" />
                <DropdownMenu.Item
                  className={cn(MENU_ITEM, 'text-hp-text [&>svg]:text-hp-text')}
                  onSelect={() => setConfirming(true)}
                >
                  <Skull /> {t.crew.deleteEnemy}
                </DropdownMenu.Item>
              </>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      {enemy && (
        <DeleteEnemyDialog
          name={name}
          open={confirming}
          onOpenChange={setConfirming}
          onConfirm={() => actions.deleteEnemy(entity.id)}
        />
      )}
    </>
  )
}

/** The one blocking dialog allowed in play: confirming a deletion. */
export function DeleteEnemyDialog({
  name,
  open,
  onOpenChange,
  onConfirm,
}: {
  name: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  const t = useT()
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t.crew.deleteEnemyTitle(name)}
      description={t.crew.deleteEnemyBody}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t.common.cancel}
          </Button>
          <Button
            variant="danger"
            icon={<Trash />}
            onClick={() => {
              onOpenChange(false)
              onConfirm()
            }}
          >
            {t.common.delete}
          </Button>
        </>
      }
    />
  )
}
