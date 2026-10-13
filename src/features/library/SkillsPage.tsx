import { Link2, Pencil, Plus, Trash } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { useShallow } from 'zustand/react/shallow'
import { Button, IconButton } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { SelectField } from '@/components/ui/fields'
import { entityName, withJournal } from '@/domain/entity'
import {
  attachSkill,
  definitionFromSkill,
  hasSkill,
  holdersOf,
  newSkillDefinition,
  skillFromDefinition,
} from '@/domain/skills'
import type { SkillDefinition, SkillKind } from '@/domain/types'
import { SkillDialog } from '@/features/characters/SkillDialog'
import { sectionFor } from '@/features/characters/useCharacterActions'
import { useCampaign } from '@/features/shell/campaignContext'
import { PageTransition } from '@/features/shell/PageTransition'
import { useT } from '@/i18n'
import { campaignHistory, useCampaignStore } from '@/stores/campaignStore'
import { SpellbookIllustration } from '@/components/illustrations'
import { compareText } from '@/lib/text'

const GROUPS: SkillKind[] = ['class', 'active', 'passive']

/** The campaign's skill library: independent skills, attachable to any character (D-218). */
export function SkillsPage() {
  const t = useT()
  const campaign = useCampaign()
  const skills = useCampaignStore((s) => s.skills)
  const characters = useCampaignStore(
    useShallow((s) =>
      Object.values(s.entities).sort((a, b) => compareText(entityName(a), entityName(b))),
    ),
  )
  const saveSkill = useCampaignStore((s) => s.saveSkill)
  const removeSkill = useCampaignStore((s) => s.removeSkill)
  const [editing, setEditing] = useState<SkillDefinition | null>(null)
  const [deleting, setDeleting] = useState<SkillDefinition | null>(null)
  const list = Object.values(skills).sort((a, b) => compareText(a.name, b.name))

  const give = (def: SkillDefinition, characterId: string) => {
    const target = useCampaignStore.getState().entities[characterId]
    if (!target || hasSkill(target, def.id)) return
    const name = entityName(target)
    useCampaignStore
      .getState()
      .updateEntity(
        characterId,
        (e) => withJournal(attachSkill(e, def), 'skill', t.journal.skillAdded(def.name)),
        t.skills.given(def.name, name),
      )
    toast.success(t.skills.given(def.name, name))
  }

  const newButton = (
    <Button
      variant="primary"
      icon={<Plus />}
      onClick={() => setEditing(newSkillDefinition('active', campaign.id))}
    >
      {t.skills.add}
    </Button>
  )

  return (
    <PageTransition className="px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="type-screen-title text-ink">{t.skills.pageTitle}</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">{t.skills.pageSubtitle}</p>
        </div>
        {list.length > 0 && newButton}
      </div>
      <div className="h-8" aria-hidden />

      {list.length === 0 ? (
        <EmptyState
          illustration={<SpellbookIllustration label={t.illustrations.spellbook} />}
          eyebrow={t.nav.skills}
          title={t.skills.libraryEmptyTitle}
          body={t.skills.libraryEmpty}
          actions={newButton}
        />
      ) : (
        <div className="space-y-10">
          {GROUPS.map((kind) => {
            const group = list.filter((d) => d.kind === kind)
            if (!group.length) return null
            return (
              <section key={kind} aria-labelledby={`library-${kind}`}>
                <h2 id={`library-${kind}`} className="mb-3 text-lg font-semibold text-ink">
                  {t.skills.groups[kind]}{' '}
                  <span className="tabular text-base text-ink-muted">({group.length})</span>
                </h2>
                <ul className="grid gap-3 lg:grid-cols-2">
                  {group.map((def) => {
                    const holders = holdersOf(characters, def.id)
                    const others = characters.filter((c) => !hasSkill(c, def.id))
                    return (
                      <li
                        key={def.id}
                        className="space-y-3 rounded-lg border border-line bg-surface p-4"
                      >
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-ink">
                              {def.name}
                              {def.stat && (
                                <span className="ml-2 text-xs font-normal text-ink-muted">
                                  {t.stats.names[def.stat]}
                                </span>
                              )}
                            </p>
                            {def.description && (
                              <p className="mt-0.5 text-sm whitespace-pre-line text-ink-muted">
                                {def.description}
                              </p>
                            )}
                          </div>
                          <IconButton
                            size="sm"
                            label={`${t.common.edit} : ${def.name}`}
                            icon={<Pencil />}
                            onClick={() => setEditing(def)}
                          />
                          <IconButton
                            size="sm"
                            label={`${t.common.delete} : ${def.name}`}
                            icon={<Trash />}
                            onClick={() => setDeleting(def)}
                          />
                        </div>
                        <div>
                          <p className="mb-1 text-xs font-medium text-ink-muted">
                            {t.skills.holders}
                          </p>
                          {holders.length === 0 ? (
                            <p className="text-xs text-ink-muted">{t.skills.noHolder}</p>
                          ) : (
                            <ul className="flex flex-wrap gap-1.5">
                              {holders.map((h) => (
                                <li key={h.id}>
                                  <Link
                                    to={`/c/${campaign.id}/prep/${sectionFor(h.kind)}/e/${h.id}`}
                                    className="inline-flex rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-text hover:underline"
                                  >
                                    {entityName(h)}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        {others.length > 0 && (
                          <GiveForm
                            label={`${t.skills.giveTo} : ${def.name}`}
                            options={others.map((c) => ({
                              value: c.id,
                              label: `${entityName(c)} (${t.kinds[c.kind]})`,
                            }))}
                            onGive={(id) => give(def, id)}
                          />
                        )}
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </div>
      )}

      <SkillDialog
        skill={editing ? skillFromDefinition(editing) : null}
        perCharacter={false}
        notice={
          editing && holdersOf(characters, editing.id).length > 1
            ? t.skills.editShared(holdersOf(characters, editing.id).length)
            : undefined
        }
        onClose={() => setEditing(null)}
        onSave={(draft) => {
          if (!editing) return
          const exists = Boolean(skills[editing.id])
          const def = definitionFromSkill(draft, campaign.id, editing.id, editing.createdAt)
          saveSkill(def, exists ? t.skills.edited(def.name) : t.skills.created(def.name))
          toast.success(exists ? t.skills.edited(def.name) : t.skills.created(def.name))
          setEditing(null)
        }}
      />
      <Dialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={deleting ? t.skills.deleteTitle(deleting.name) : ''}
        description={deleting ? t.skills.deleteBody(holdersOf(characters, deleting.id).length) : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              {t.common.cancel}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!deleting) return
                campaignHistory
                  .getState()
                  .transaction(t.skills.deleted(deleting.name), () =>
                    removeSkill(deleting.id, t.skills.deleted(deleting.name)),
                  )
                toast(t.skills.deleted(deleting.name))
                setDeleting(null)
              }}
            >
              {t.common.delete}
            </Button>
          </>
        }
      />
    </PageTransition>
  )
}

function GiveForm({
  label,
  options,
  onGive,
}: {
  label: string
  options: { value: string; label: string }[]
  onGive: (id: string) => void
}) {
  const t = useT()
  const [value, setValue] = useState('')
  const selected = options.some((o) => o.value === value) ? value : options[0]!.value
  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        onGive(selected)
      }}
    >
      <SelectField<string>
        label={label}
        hideLabel
        value={selected}
        onChange={setValue}
        options={options}
        className="min-w-0 flex-1"
      />
      <Button type="submit" size="sm" icon={<Link2 />}>
        {t.skills.giveTo}
      </Button>
    </form>
  )
}
