import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'framer-motion'
import { ClipboardPaste, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/Button'
import { buttonClasses } from '@/components/ui/buttonStyles'
import { EmptyState } from '@/components/ui/EmptyState'
import { bestiaryRepository } from '@/db/bestiary'
import { useCampaign } from '@/features/shell/campaignContext'
import { PageTransition } from '@/features/shell/PageTransition'
import { useT } from '@/i18n'
import { selectEntitiesOfKinds, useCampaignStore } from '@/stores/campaignStore'
import { CharacterCard } from './CharacterCard'
import { DiscordImportDialog } from './DiscordImportDialog'
import { SpawnButton } from './SpawnDialog'
import { GrimoireIllustration } from '@/components/illustrations'

const listVariants = { visible: { transition: { staggerChildren: 0.03 } } }

export function BestiaryPage() {
  const t = useT()
  const campaign = useCampaign()
  const templates = useLiveQuery(() => bestiaryRepository.list(campaign.id), [campaign.id])
  const enemies = useCampaignStore(useShallow((s) => selectEntitiesOfKinds(s.entities, ['enemy'])))
  const [importing, setImporting] = useState(false)
  const base = `/c/${campaign.id}/prep/bestiary`

  const newButton = (
    <Link to={`${base}/new?kind=enemy`} className={buttonClasses('primary')}>
      <Plus className="size-4" aria-hidden />
      {t.bestiary.newTemplate}
    </Link>
  )
  const importButton = (
    <Button icon={<ClipboardPaste />} onClick={() => setImporting(true)}>
      {t.discordImport.button}
    </Button>
  )

  return (
    <PageTransition className="px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="type-screen-title text-ink">{t.nav.bestiary}</h1>
        {templates && templates.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {importButton}
            {newButton}
          </div>
        )}
      </div>
      <div className="h-8" aria-hidden />

      {templates === undefined ? null : templates.length === 0 && enemies.length === 0 ? (
        <EmptyState
          illustration={<GrimoireIllustration label={t.illustrations.grimoire} />}
          eyebrow={t.nav.bestiary}
          title={t.sections.bestiary.emptyTitle}
          body={t.sections.bestiary.emptyBody}
          actions={
            <>
              {newButton}
              {importButton}
            </>
          }
        />
      ) : (
        <div className="space-y-10">
          <section aria-labelledby="templates-heading">
            <h2 id="templates-heading" className="text-lg font-semibold text-ink">
              {t.bestiary.templates}
            </h2>
            <p className="mb-3 text-sm text-ink-muted">{t.bestiary.templatesHint}</p>
            <motion.ul
              aria-label={t.bestiary.templates}
              className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
              initial="hidden"
              animate="visible"
              variants={listVariants}
            >
              {templates.map((template) => (
                <CharacterCard
                  key={template.id}
                  entity={template}
                  rules={campaign.rules}
                  to={`${base}/t/${template.id}`}
                  footer={<SpawnButton template={template} variant="secondary" size="sm" />}
                />
              ))}
            </motion.ul>
          </section>

          <section aria-labelledby="instances-heading">
            <h2 id="instances-heading" className="mb-3 text-lg font-semibold text-ink">
              {t.bestiary.instances}{' '}
              <span className="tabular text-base text-ink-muted">({enemies.length})</span>
            </h2>
            {enemies.length === 0 ? (
              <p className="text-sm text-ink-muted">{t.bestiary.instancesEmpty}</p>
            ) : (
              <motion.ul
                aria-label={t.bestiary.instances}
                className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
                initial="hidden"
                animate="visible"
                variants={listVariants}
              >
                {enemies.map((enemy) => (
                  <CharacterCard
                    key={enemy.id}
                    entity={enemy}
                    rules={campaign.rules}
                    to={`${base}/e/${enemy.id}`}
                  />
                ))}
              </motion.ul>
            )}
          </section>
        </div>
      )}
      <DiscordImportDialog open={importing} onOpenChange={setImporting} kinds={['enemy']} />
    </PageTransition>
  )
}
