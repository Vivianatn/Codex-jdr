import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Skull, Trash, UserX } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { bestiaryRepository } from '@/db/bestiary'
import { entityName, ownerOptions } from '@/domain/entity'
import type { EnemyTemplate, Entity } from '@/domain/types'
import { useCampaign } from '@/features/shell/campaignContext'
import { PageTransition } from '@/features/shell/PageTransition'
import { useT } from '@/i18n'
import { useCampaignStore } from '@/stores/campaignStore'
import { CharacterSheet, CopyForDiscordButton } from './CharacterSheet'
import { SpawnButton } from './SpawnDialog'
import { useCharacterActions } from './useCharacterActions'

function BackLink({ to }: { to: string }) {
  const t = useT()
  return (
    <Link
      to={to}
      className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
    >
      <ArrowLeft className="size-4" aria-hidden />
      {t.sheet.backToList}
    </Link>
  )
}

function DeleteButton({ name, onConfirm }: { name: string; onConfirm: () => void }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="ghost" icon={<Trash />} onClick={() => setOpen(true)}>
        {t.common.delete}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t.sheet.deleteTitle(name)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setOpen(false)
                onConfirm()
              }}
            >
              {t.common.delete}
            </Button>
          </>
        }
      />
    </>
  )
}

/** A character of the open campaign (players, allies, familiars, enemy copies). */
export function EntitySheetPage() {
  const t = useT()
  const campaign = useCampaign()
  const navigate = useNavigate()
  const { section = '', entityId = '' } = useParams()
  const entity = useCampaignStore((s) => s.entities[entityId])
  const all = useCampaignStore((s) => s.entities)
  const updateEntity = useCampaignStore((s) => s.updateEntity)
  const actions = useCharacterActions()
  const owners = useMemo(() => ownerOptions(Object.values(all)), [all])
  const templateId = entity?.kind === 'enemy' ? entity.details.templateId : null
  const template = useLiveQuery(
    async () => (templateId ? await bestiaryRepository.get(templateId) : undefined),
    [templateId],
  )
  const back = `/c/${campaign.id}/prep/${section}`

  if (!entity) {
    return (
      <PageTransition className="px-4 py-8 sm:px-8">
        <BackLink to={back} />
        <EmptyState icon={<UserX />} title={t.sheet.notFoundTitle} body={t.sheet.notFoundBody} />
      </PageTransition>
    )
  }

  return (
    <PageTransition key={entity.id} className="px-4 py-8 sm:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <BackLink to={back} />
        <CharacterSheet
          entity={entity}
          rules={campaign.rules}
          onChange={(recipe, label) => updateEntity(entity.id, recipe, label)}
          context={{ owners, templateName: template ? entityName(template) : undefined }}
          kindLabel={t.kinds[entity.kind]}
          actions={
            <>
              <CopyForDiscordButton entity={entity} rules={campaign.rules} />
              <DeleteButton
                name={entityName(entity)}
                onConfirm={() => {
                  navigate(back)
                  actions.remove(entity)
                }}
              />
            </>
          }
        />
      </div>
    </PageTransition>
  )
}

/** A bestiary template (shared library, saved straight to IndexedDB). */
export function TemplateSheetPage() {
  const t = useT()
  const campaign = useCampaign()
  const navigate = useNavigate()
  const { templateId = '' } = useParams()
  // `null` = loaded but missing.
  const template = useLiveQuery(
    async () => (await bestiaryRepository.get(templateId)) ?? null,
    [templateId],
  )
  const back = `/c/${campaign.id}/prep/bestiary`

  if (template === undefined) return null
  if (template === null) {
    return (
      <PageTransition className="px-4 py-8 sm:px-8">
        <BackLink to={back} />
        <EmptyState icon={<Skull />} title={t.sheet.notFoundTitle} body={t.sheet.notFoundBody} />
      </PageTransition>
    )
  }

  const name = entityName(template)
  return (
    <PageTransition key={template.id} className="px-4 py-8 sm:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <BackLink to={back} />
        <CharacterSheet
          entity={template}
          rules={campaign.rules}
          onChange={(recipe) => {
            // Re-read so quick successive edits never overwrite each other.
            void bestiaryRepository.get(template.id).then((latest) => {
              if (latest) void bestiaryRepository.save(recipe(latest) as EnemyTemplate)
            })
          }}
          context={{ owners: [] }}
          kindLabel={`${t.kinds.template} · ${t.kinds.enemy}`}
          actions={
            <>
              <SpawnButton template={template} />
              <CopyForDiscordButton entity={template as Entity} rules={campaign.rules} />
              <DeleteButton
                name={name}
                onConfirm={async () => {
                  navigate(back)
                  await bestiaryRepository.remove(template.id)
                  toast.success(t.bestiary.templateDeleted(name))
                }}
              />
            </>
          }
        />
      </div>
    </PageTransition>
  )
}
