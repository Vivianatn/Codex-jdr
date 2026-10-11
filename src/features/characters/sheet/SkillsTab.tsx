import { Pencil, Plus, Unlink, Users, WandSparkles } from 'lucide-react'
import { useState } from 'react'
import { Button, IconButton } from '@/components/ui/Button'
import { SelectField } from '@/components/ui/fields'
import { skillBlock } from '@/domain/progress'
import {
  definitionFromSkill,
  newSkillDefinition,
  skillFromDefinition,
  syncSkill,
} from '@/domain/skills'
import type { Entity, Skill, SkillDefinition, SkillKind } from '@/domain/types'
import { useCampaign } from '@/features/shell/campaignContext'
import { useT } from '@/i18n'
import { cn } from '@/lib/cn'
import { nextExtraSkillLevel, type RulesConfig } from '@/rules'
import { campaignHistory, useCampaignStore } from '@/stores/campaignStore'
import { useSkillLibrary } from '../useSkillLibrary'
import { SkillLaunchDialog } from '../play/PlayDialogs'
import { SkillDialog } from '../SkillDialog'
import type { SheetEditor } from '../useSheetEditor'

const GROUPS: SkillKind[] = ['class', 'active', 'passive']

export interface SkillListHandlers {
  /** Gives the character a copy of a library skill. */
  attach: (def: SkillDefinition) => void
  /** Creates a new library skill and gives it to the character. */
  create: (def: SkillDefinition) => void
  /** Edits the library definition (every holder is updated). */
  edit: (def: SkillDefinition, copy: Skill) => void
  /** Removes the copy from this character only. */
  detach: (skill: Skill) => void
  toggle?: (skill: Skill) => void
  /** Shown on active skills when the sheet is playable. */
  launch?: (skill: Skill) => void
}

/** Skills grouped like the Discord sheet; also used by the creation wizard. */
export function SkillList({ skills, handlers }: { skills: Skill[]; handlers: SkillListHandlers }) {
  const t = useT()
  const campaign = useCampaign()
  const library = useSkillLibrary()
  const [editing, setEditing] = useState<
    | { mode: 'create'; def: SkillDefinition }
    | { mode: 'edit'; def: SkillDefinition; copy: Skill }
    | null
  >(null)
  const [choice, setChoice] = useState<Record<SkillKind, string>>({
    active: '',
    passive: '',
    class: '',
  })

  return (
    <div className="space-y-6">
      {GROUPS.map((kind) => {
        const group = skills.filter((s) => s.kind === kind)
        const held = new Set(skills.map((s) => s.sourceId))
        const available = library.list.filter((d) => d.kind === kind && !held.has(d.id))
        const selected = available.find((d) => d.id === choice[kind]) ?? available[0]
        return (
          <section key={kind} aria-labelledby={`skills-${kind}`}>
            <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
              <h3
                id={`skills-${kind}`}
                className="font-sans text-sm font-semibold tracking-normal text-ink"
              >
                {t.skills.groups[kind]}{' '}
                <span className="tabular font-normal text-ink-muted">({group.length})</span>
              </h3>
              <div className="flex flex-wrap items-end gap-2">
                {selected && (
                  <form
                    className="flex items-end gap-2"
                    onSubmit={(e) => {
                      e.preventDefault()
                      handlers.attach(selected)
                    }}
                  >
                    <SelectField<string>
                      label={t.skills.fromLibrary(t.skills.groups[kind])}
                      hideLabel
                      value={selected.id}
                      onChange={(id) => setChoice((c) => ({ ...c, [kind]: id }))}
                      options={available.map((d) => ({ value: d.id, label: d.name }))}
                      className="w-48"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      icon={<Plus />}
                      aria-label={t.skills.attachTo(t.skills.groups[kind])}
                    >
                      {t.common.add}
                    </Button>
                  </form>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Plus />}
                  onClick={() =>
                    setEditing({ mode: 'create', def: newSkillDefinition(kind, campaign.id) })
                  }
                  aria-label={`${t.skills.newSkill} : ${t.skills.groups[kind]}`}
                >
                  {t.skills.newSkill}
                </Button>
              </div>
            </div>
            {kind === 'class' && group.length === 0 && (
              <p className="text-xs text-ink-muted">{t.skills.classHint}</p>
            )}
            <ul className="space-y-2">
              {group.map((skill) => {
                const def = skill.sourceId ? library.byId[skill.sourceId] : undefined
                const shared = skill.sourceId ? (library.holders[skill.sourceId] ?? 0) : 0
                return (
                  <li
                    key={skill.id}
                    className={cn(
                      'flex items-start gap-3 rounded-md border border-line bg-surface p-3',
                      !skill.enabled && 'opacity-60',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink">
                        {skill.name}
                        {skill.stat && (
                          <span className="ml-2 text-xs font-normal text-ink-muted">
                            {t.stats.names[skill.stat]}
                          </span>
                        )}
                        {!skill.enabled && (
                          <span className="ml-2 text-xs font-normal text-ink-muted">
                            ({t.skills.disabled})
                          </span>
                        )}
                      </p>
                      {skill.description && (
                        <p className="mt-0.5 text-sm whitespace-pre-line text-ink-muted">
                          {skill.description}
                        </p>
                      )}
                      {skill.modifiers.length > 0 && (
                        <p className="mt-1 text-xs text-ink-muted">
                          {skill.modifiers
                            .map(
                              (m) => `${t.stats.abbr[m.stat]} ${m.value >= 0 ? '+' : ''}${m.value}`,
                            )
                            .join(' · ')}
                        </p>
                      )}
                      {shared > 1 && (
                        <p className="mt-1 inline-flex items-center gap-1 text-xs text-accent-text">
                          <Users className="size-3" aria-hidden />
                          {t.skills.sharedBy(shared)}
                        </p>
                      )}
                    </div>
                    {skill.kind === 'active' && (skill.usesMax !== null || skill.cooldown > 0) && (
                      <SkillCounters skill={skill} />
                    )}
                    {handlers.launch && skill.kind === 'active' && (
                      <Button
                        size="sm"
                        variant="primary"
                        icon={<WandSparkles />}
                        disabled={Boolean(skillBlock(skill))}
                        onClick={() => handlers.launch!(skill)}
                        aria-label={t.skills.launchSkill(skill.name)}
                      >
                        {t.skills.launch}
                      </Button>
                    )}
                    {handlers.toggle && skill.kind !== 'active' && (
                      <label className="flex items-center gap-1.5 pt-1 text-xs text-ink-muted">
                        <input
                          type="checkbox"
                          checked={skill.enabled}
                          onChange={() => handlers.toggle!(skill)}
                          className="size-4 accent-[var(--codex-accent)]"
                        />
                        {t.skills.enabled}
                      </label>
                    )}
                    <IconButton
                      size="sm"
                      label={`${t.common.edit} : ${skill.name}`}
                      icon={<Pencil />}
                      onClick={() =>
                        setEditing({
                          mode: 'edit',
                          def:
                            def ??
                            definitionFromSkill(skill, campaign.id, skill.sourceId ?? undefined),
                          copy: skill,
                        })
                      }
                    />
                    <IconButton
                      size="sm"
                      label={`${t.skills.detach} : ${skill.name}`}
                      icon={<Unlink />}
                      onClick={() => handlers.detach(skill)}
                    />
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
      <SkillDialog
        skill={editing ? skillFromDefinition(editing.def) : null}
        perCharacter={false}
        notice={
          editing?.mode === 'edit' && (library.holders[editing.def.id] ?? 0) > 1
            ? t.skills.editShared(library.holders[editing.def.id]!)
            : undefined
        }
        onClose={() => setEditing(null)}
        onSave={(draft) => {
          if (!editing) return
          const def = definitionFromSkill(draft, campaign.id, editing.def.id, editing.def.createdAt)
          if (editing.mode === 'create') handlers.create(def)
          else handlers.edit(def, editing.copy)
          setEditing(null)
        }}
      />
    </div>
  )
}

/** The sheet's tab: the library and this character's copies, in one undo step each. */
export function SkillsTab({
  entity,
  rules,
  editor,
}: {
  entity: Entity
  rules: RulesConfig
  editor: SheetEditor
}) {
  const t = useT()
  const playable = useCampaignStore((s) => Boolean(s.entities[entity.id]))
  const saveSkill = useCampaignStore((s) => s.saveSkill)
  const [launching, setLaunching] = useState<string | null>(null)
  const next = nextExtraSkillLevel(entity.level, rules)
  const total = entity.skills.filter((s) => s.kind !== 'class').length
  const tx = (label: string, fn: () => void) => campaignHistory.getState().transaction(label, fn)

  return (
    <div className="space-y-6">
      <p className="flex flex-wrap gap-x-3 text-sm text-ink-muted">
        <span className="tabular font-medium text-ink">{t.skills.total(total)}</span>
        {next !== null && <span>{t.skills.nextReminder(next)}</span>}
      </p>
      <SkillList
        skills={entity.skills}
        handlers={{
          attach: (def) => editor.saveSkill(skillFromDefinition(def)),
          create: (def) =>
            tx(t.skills.created(def.name), () => {
              saveSkill(def, t.skills.created(def.name))
              editor.saveSkill(skillFromDefinition(def))
            }),
          edit: (def, copy) =>
            tx(t.skills.edited(def.name), () => {
              // Characters of the campaign are re-synced by the store; a bestiary
              // template (outside the campaign) updates its own copy.
              saveSkill(def, t.skills.edited(def.name))
              if (!playable) editor.saveSkill(syncSkill({ ...copy, sourceId: def.id }, def))
            }),
          detach: editor.removeSkill,
          toggle: (skill) => editor.toggleSkill(skill.id),
          launch: playable ? (skill) => setLaunching(skill.id) : undefined,
        }}
      />
      {launching && (
        <SkillLaunchDialog entity={entity} skillId={launching} onClose={() => setLaunching(null)} />
      )}
    </div>
  )
}

function SkillCounters({ skill }: { skill: Skill }) {
  const t = useT()
  const parts = [
    skill.usesMax !== null ? t.skills.usesLeft(skill.usesLeft ?? skill.usesMax, skill.usesMax) : '',
    skill.cooldownLeft > 0 ? t.skills.cooldownLeft(skill.cooldownLeft) : '',
  ].filter(Boolean)
  if (!parts.length) return null
  return <span className="tabular pt-1.5 text-xs text-ink-muted">{parts.join(' · ')}</span>
}
