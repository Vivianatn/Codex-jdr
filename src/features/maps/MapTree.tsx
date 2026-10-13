import * as Popover from '@radix-ui/react-popover'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, ChevronDown, ChevronsRight, Map as MapIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { sessionRepository } from '@/db/sessions'
import { entityName } from '@/domain/entity'
import { mapTree, type GameMap, type MapTreeNode } from '@/domain/maps'
import { nextSessionMapId } from '@/domain/sessions'
import type { Entity } from '@/domain/types'
import { useT } from '@/i18n'
import { cn } from '@/lib/cn'
import { compareText } from '@/lib/text'
import { useCampaignStore } from '@/stores/campaignStore'

/**
 * Every map of the session at a glance (D-256): the session's maps in their
 * order of appearance (D-258, numbered), then the maps their passages lead to,
 * as a tree, with who stands where. Picking one puts it on the GM's board (and
 * the players' window); characters stay put. "Next map" follows the order.
 */
export function MapTreeMenu() {
  const t = useT()
  const maps = useCampaignStore((s) => s.maps)
  const entities = useCampaignStore((s) => s.entities)
  const play = useCampaignStore((s) => s.play)
  const updatePlay = useCampaignStore((s) => s.updatePlay)
  const [open, setOpen] = useState(false)
  const planId = play.live?.planId
  const route = useLiveQuery(
    async () => (planId ? ((await sessionRepository.getPlan(planId))?.mapIds ?? []) : []),
    [planId],
  )

  const { tree, rest } = useMemo(() => {
    // Maps where the party is come right after the session's own maps.
    const partyMaps = Object.values(maps)
      .filter((m) => m.tokens.some((tk) => entities[tk.entityId]?.kind !== 'enemy'))
      .sort((a, b) => compareText(a.name, b.name))
      .map((m) => m.id)
    return mapTree(maps, [...(route ?? []), play.mapId, ...partyMaps])
  }, [maps, entities, route, play.mapId])
  const steps = useMemo(() => new Map((route ?? []).map((id, i) => [id, i + 1])), [route])
  const nextId = route
    ? nextSessionMapId({ mapIds: route.filter((id) => maps[id]) }, play.mapId)
    : null

  const current = play.mapId ? maps[play.mapId] : undefined
  const pick = (id: string | null) => {
    setOpen(false)
    if (id === play.mapId) return
    updatePlay((p) => ({ ...p, mapId: id }), id ? t.maps.wentTo(maps[id]!.name) : t.maps.noMap)
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className="flex h-9 max-w-56 min-w-0 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-2 text-sm text-ink hover:bg-surface-2"
        aria-label={`${t.maps.chooseMap} : ${current?.name ?? t.maps.noMap}`}
        data-testid="map-tree"
      >
        <MapIcon className="size-4 shrink-0 text-ink-muted" aria-hidden />
        <span className="truncate">{current?.name ?? t.maps.noMap}</span>
        <ChevronDown className="size-4 shrink-0 text-ink-muted" aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          collisionPadding={16}
          className="z-50 max-h-[70vh] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-line bg-surface-raised p-2 shadow-lifted"
        >
          <p className="px-2 pt-1 pb-2 type-eyebrow">{t.maps.treeTitle}</p>
          {nextId && (
            <button
              type="button"
              onClick={() => pick(nextId)}
              className="mb-2 flex w-full items-center gap-2 rounded-lg bg-accent-soft px-2 py-1.5 text-left text-sm font-medium text-accent-text hover:bg-surface-2"
            >
              <ChevronsRight className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0 break-words">
                {t.maps.treeNext(`${steps.get(nextId)}. ${maps[nextId]!.name}`)}
              </span>
            </button>
          )}
          {tree.length === 0 && rest.length === 0 && (
            <p className="px-2 pb-2 text-sm text-ink-muted">{t.maps.noMaps}</p>
          )}
          <ul role="tree" aria-label={t.maps.treeTitle} className="space-y-0.5">
            {tree.map((node) => (
              <TreeItem
                key={node.map.id}
                node={node}
                entities={entities}
                currentId={play.mapId}
                steps={steps}
                onPick={pick}
              />
            ))}
          </ul>
          {rest.length > 0 && (
            <>
              <p className="px-2 pt-3 pb-1 text-xs font-semibold text-ink-muted">
                {t.maps.treeOthers}
              </p>
              <ul role="tree" aria-label={t.maps.treeOthers} className="space-y-0.5">
                {rest.map((map) => (
                  <TreeItem
                    key={map.id}
                    node={{ map, children: [] }}
                    entities={entities}
                    currentId={play.mapId}
                    steps={steps}
                    onPick={pick}
                  />
                ))}
              </ul>
            </>
          )}
          {play.mapId && (
            <button
              type="button"
              className="mt-2 w-full rounded-lg px-2 py-1.5 text-left text-xs text-ink-muted hover:bg-surface-2 hover:text-ink"
              onClick={() => pick(null)}
            >
              {t.maps.noMap}
            </button>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function TreeItem({
  node,
  entities,
  currentId,
  steps,
  onPick,
}: {
  node: MapTreeNode
  entities: Record<string, Entity>
  currentId: string | null
  /** Position in the session's order of appearance (D-258). */
  steps: ReadonlyMap<string, number>
  onPick: (id: string) => void
}) {
  const t = useT()
  const here = present(node.map, entities)
  const current = node.map.id === currentId
  return (
    <li
      role="treeitem"
      aria-selected={current}
      aria-expanded={node.children.length ? true : undefined}
    >
      <button
        type="button"
        onClick={() => onPick(node.map.id)}
        className={cn(
          'flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-surface-2',
          current && 'bg-surface-2',
        )}
      >
        <Check
          className={cn('mt-0.5 size-4 shrink-0 text-gold-text', !current && 'invisible')}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium break-words text-ink">
            {steps.has(node.map.id) ? `${steps.get(node.map.id)}. ` : ''}
            {node.map.name}
          </span>
          {(here.party.length > 0 || here.enemies > 0) && (
            <span className="block text-xs break-words text-ink-muted">
              {[here.party.join(', '), here.enemies > 0 ? t.maps.treeEnemies(here.enemies) : '']
                .filter(Boolean)
                .join(' · ')}
            </span>
          )}
        </span>
      </button>
      {node.children.length > 0 && (
        <ul role="group" className="ml-4 space-y-0.5 border-l border-line pl-1">
          {node.children.map((child) => (
            <TreeItem
              key={child.map.id}
              node={child}
              entities={entities}
              currentId={currentId}
              steps={steps}
              onPick={onPick}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

/** Who stands on a map: the party by name, enemies as a count. */
function present(map: GameMap, entities: Record<string, Entity>) {
  const party: string[] = []
  let enemies = 0
  for (const tk of map.tokens) {
    const e = entities[tk.entityId]
    if (!e) continue
    if (e.kind === 'enemy') enemies++
    else party.push(entityName(e))
  }
  return { party: party.sort(compareText), enemies }
}
