import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useLiveQuery } from 'dexie-react-hooks'
import { Gem, Gift, Pencil, Plus, Trash } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { useShallow } from 'zustand/react/shallow'
import { Ornament } from '@/components/Brand'
import { Button, IconButton } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { itemLibrary } from '@/db/itemLibrary'
import { entityName, withJournal } from '@/domain/entity'
import { formatPurse, newItem } from '@/domain/items'
import type { Item } from '@/domain/types'
import { RARITY_CLASSES } from '@/features/characters/conditionStyles'
import { ItemDialog } from '@/features/characters/ItemDialog'
import { useCampaign } from '@/features/shell/campaignContext'
import { PageTransition } from '@/features/shell/PageTransition'
import { useT } from '@/i18n'
import { cn } from '@/lib/cn'
import { useCampaignStore } from '@/stores/campaignStore'

const MENU_ITEM =
  'flex min-h-9 cursor-pointer items-center rounded-lg px-2.5 py-1.5 text-sm text-ink outline-none data-[highlighted]:bg-surface-2'

/** Item library shared by every campaign (SPEC §2.3, §10). */
export function ItemsPage() {
  const t = useT()
  const campaign = useCampaign()
  const items = useLiveQuery(() => itemLibrary.list(campaign.id), [campaign.id])
  const characters = useCampaignStore(
    useShallow((s) =>
      Object.values(s.entities).sort((a, b) => entityName(a).localeCompare(entityName(b), 'fr')),
    ),
  )
  const [editing, setEditing] = useState<Item | null>(null)

  const give = (item: Item, characterId: string) => {
    const target = useCampaignStore.getState().entities[characterId]
    if (!target) return
    const copy = { ...item, id: crypto.randomUUID(), slot: null }
    useCampaignStore
      .getState()
      .updateEntity(
        characterId,
        (e) =>
          withJournal(
            { ...e, inventory: [...e.inventory, copy] },
            'item',
            t.journal.itemAdded(item.name, item.quantity),
          ),
        t.inventory.addedTo(item.name, entityName(target)),
      )
    toast.success(t.inventory.addedTo(item.name, entityName(target)))
  }

  const newButton = (
    <Button variant="primary" icon={<Plus />} onClick={() => setEditing(newItem({ name: '' }))}>
      {t.inventory.newItem}
    </Button>
  )

  return (
    <PageTransition className="px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="type-screen-title text-ink">{t.inventory.pageTitle}</h1>
          <p className="mt-1 text-sm text-ink-muted">{t.inventory.pageSubtitle}</p>
        </div>
        {items && items.length > 0 && newButton}
      </div>
      <Ornament className="my-6 max-w-sm" />

      {items === undefined ? null : items.length === 0 ? (
        <EmptyState
          icon={<Gem />}
          title={t.sections.items.emptyTitle}
          body={t.sections.items.emptyBody}
          actions={newButton}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label={t.inventory.pageTitle}>
          {items.map((item) => (
            <li
              key={item.id}
              className={cn(
                'flex flex-col rounded-md border border-l-4 border-line bg-surface p-4 shadow-soft',
                RARITY_CLASSES[item.rarity].edge,
              )}
            >
              <p className="font-medium text-ink">{item.name}</p>
              <p className="text-xs text-ink-muted">
                {[
                  t.inventory.types[item.type],
                  t.inventory.rarities[item.rarity],
                  item.damage,
                  item.weight ? `${String(item.weight).replace('.', ',')} kg` : '',
                  item.value ? formatPurse(item.value, campaign.rules.currency) : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {item.description && (
                <p className="mt-2 line-clamp-3 text-sm text-ink-muted">{item.description}</p>
              )}
              <div className="mt-auto flex items-center justify-end gap-1 pt-3">
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <Button size="sm" icon={<Gift />} disabled={characters.length === 0}>
                      {t.inventory.giveToCharacter}
                    </Button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      align="end"
                      sideOffset={4}
                      className="z-50 max-h-72 min-w-48 overflow-y-auto rounded-xl border border-line bg-surface-raised p-1 shadow-lifted"
                    >
                      {characters.map((c) => (
                        <DropdownMenu.Item
                          key={c.id}
                          className={MENU_ITEM}
                          onSelect={() => give(item, c.id)}
                        >
                          {entityName(c)}
                        </DropdownMenu.Item>
                      ))}
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
                <IconButton
                  size="sm"
                  label={`${t.common.edit} : ${item.name}`}
                  icon={<Pencil />}
                  onClick={() => setEditing(item)}
                />
                <IconButton
                  size="sm"
                  label={`${t.common.delete} : ${item.name}`}
                  icon={<Trash />}
                  onClick={async () => {
                    await itemLibrary.remove(item.id)
                    toast.success(t.inventory.templateDeleted(item.name))
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      <ItemDialog
        item={editing}
        onClose={() => setEditing(null)}
        onSave={async (item) => {
          await itemLibrary.save(item, campaign.id)
          setEditing(null)
          toast.success(t.inventory.templateSaved)
        }}
      />
    </PageTransition>
  )
}
