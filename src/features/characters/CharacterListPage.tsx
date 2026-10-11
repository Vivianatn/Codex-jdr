import { motion } from 'framer-motion'
import { ClipboardPaste, Plus, Users } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { useShallow } from 'zustand/react/shallow'
import { Ornament } from '@/components/Brand'
import { Button } from '@/components/ui/Button'
import { buttonClasses } from '@/components/ui/buttonStyles'
import { EmptyState } from '@/components/ui/EmptyState'
import type { EntityKind } from '@/domain/types'
import { useCampaign } from '@/features/shell/campaignContext'
import { PageTransition } from '@/features/shell/PageTransition'
import { entityName } from '@/domain/entity'
import { useT } from '@/i18n'
import { selectEntitiesOfKinds, useCampaignStore } from '@/stores/campaignStore'
import { CharacterCard } from './CharacterCard'
import { DiscordImportDialog } from './DiscordImportDialog'

export interface ListGroup {
  kind: Exclude<EntityKind, 'enemy'>
  title: string
  newLabel: string
  empty: string
}

/** Players, or allies and familiars: one grid of cards per kind. */
export function CharacterListPage({
  title,
  groups,
  emptyTitle,
  emptyBody,
}: {
  title: string
  groups: ListGroup[]
  emptyTitle: string
  emptyBody: string
}) {
  const t = useT()
  const campaign = useCampaign()
  const kinds = groups.map((g) => g.kind)
  const entities = useCampaignStore(useShallow((s) => selectEntitiesOfKinds(s.entities, kinds)))
  const [importing, setImporting] = useState(false)
  const section = groups[0]?.kind === 'player' ? 'players' : 'allies'
  const newLink = (kind: EntityKind) => `/c/${campaign.id}/prep/${section}/new?kind=${kind}`

  const newButtons = groups.map((g) => (
    <Link key={g.kind} to={newLink(g.kind)} className={buttonClasses('primary')}>
      <Plus className="size-4" aria-hidden />
      {g.newLabel}
    </Link>
  ))
  const importButton = (
    <Button icon={<ClipboardPaste />} onClick={() => setImporting(true)}>
      {t.discordImport.button}
    </Button>
  )

  return (
    <PageTransition className="px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink">{title}</h1>
        {entities.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {importButton}
            {newButtons}
          </div>
        )}
      </div>
      <Ornament className="my-6 max-w-sm" />

      {entities.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title={emptyTitle}
          body={emptyBody}
          actions={
            <>
              {newButtons}
              {importButton}
            </>
          }
        />
      ) : (
        <div className="space-y-10">
          {groups.map((group) => {
            const list = entities.filter((e) => e.kind === group.kind)
            return (
              <section key={group.kind} aria-labelledby={`group-${group.kind}`}>
                {groups.length > 1 && (
                  <h2 id={`group-${group.kind}`} className="mb-3 text-lg font-semibold text-ink">
                    {group.title}{' '}
                    <span className="tabular text-base text-ink-muted">({list.length})</span>
                  </h2>
                )}
                {list.length === 0 ? (
                  <p className="text-sm text-ink-muted">{group.empty}</p>
                ) : (
                  <motion.ul
                    aria-label={group.title}
                    className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
                    initial="hidden"
                    animate="visible"
                    variants={{ visible: { transition: { staggerChildren: 0.03 } } }}
                  >
                    {list.map((entity) => (
                      <CharacterCard
                        key={entity.id}
                        entity={entity}
                        rules={campaign.rules}
                        to={`/c/${campaign.id}/prep/${section}/e/${entity.id}`}
                        badge={
                          entity.kind === 'familiar' ? (
                            <OwnerBadge ownerId={entity.details.ownerId} />
                          ) : undefined
                        }
                      />
                    ))}
                  </motion.ul>
                )}
              </section>
            )
          })}
        </div>
      )}
      <DiscordImportDialog open={importing} onOpenChange={setImporting} kinds={kinds} />
    </PageTransition>
  )
}

function OwnerBadge({ ownerId }: { ownerId: string | null }) {
  const t = useT()
  const owner = useCampaignStore((s) => (ownerId ? s.entities[ownerId] : undefined))
  return (
    <p className="mt-0.5 truncate text-xs font-medium text-accent-text">
      {owner ? t.familiars.of(entityName(owner)) : t.familiars.noOwner}
    </p>
  )
}
