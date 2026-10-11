import { Pencil, Plus, Trash, WandSparkles } from 'lucide-react'
import { useState } from 'react'
import { Button, IconButton } from '@/components/ui/Button'
import type { Entity, Skill, SkillKind } from '@/domain/types'
import { useT } from '@/i18n'
import { cn } from '@/lib/cn'
import { nextExtraSkillLevel, type RulesConfig } from '@/rules'
import { emptySkill } from '@/domain/entity'
import { skillBlock } from '@/domain/progress'
import { SkillDialog } from '../SkillDialog'
import { useCampaignStore } from '@/stores/campaignStore'
import { SkillLaunchDialog } from '../play/PlayDialogs'
import type { SheetEditor } from '../useSheetEditor'

const GROUPS: SkillKind[] = ['class', 'active', 'passive']

/** Skills grouped like the Discord sheet; also used by the creation wizard. */
export function SkillList({
  skills,
  onSave,
  onRemove,
  onToggle,
  onLaunch,
}: {
  skills: Skill[]
  onSave: (skill: Skill) => void
  onRemove: (skill: Skill) => void
  onToggle?: (skill: Skill) => void
  /** Shown on active skills when the sheet is playable. */
  onLaunch?: (skill: Skill) => void
}) {
  const t = useT()
  const [editing, setEditing] = useState<Skill | null>(null)
  return (
    <div className="space-y-6">
      {GROUPS.map((kind) => {
        const group = skills.filter((s) => s.kind === kind)
        return (
          <section key={kind} aria-labelledby={`skills-${kind}`}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3
                id={`skills-${kind}`}
                className="font-sans text-sm font-semibold tracking-normal text-ink"
              >
                {t.skills.groups[kind]}{' '}
                <span className="tabular font-normal text-ink-muted">({group.length})</span>
              </h3>
              <Button
                size="sm"
                variant="ghost"
                icon={<Plus />}
                onClick={() => setEditing(emptySkill(kind))}
                aria-label={`${t.common.add} : ${t.skills.groups[kind]}`}
              >
                {t.common.add}
              </Button>
            </div>
            {kind === 'class' && group.length === 0 && (
              <p className="text-xs text-ink-muted">{t.skills.classHint}</p>
            )}
            <ul className="space-y-2">
              {group.map((skill) => (
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
                  </div>
                  {skill.kind === 'active' && (skill.usesMax !== null || skill.cooldown > 0) && (
                    <SkillCounters skill={skill} />
                  )}
                  {onLaunch && skill.kind === 'active' && (
                    <Button
                      size="sm"
                      variant="primary"
                      icon={<WandSparkles />}
                      disabled={Boolean(skillBlock(skill))}
                      onClick={() => onLaunch(skill)}
                      aria-label={t.skills.launchSkill(skill.name)}
                    >
                      {t.skills.launch}
                    </Button>
                  )}
                  {onToggle && skill.kind !== 'active' && (
                    <label className="flex items-center gap-1.5 pt-1 text-xs text-ink-muted">
                      <input
                        type="checkbox"
                        checked={skill.enabled}
                        onChange={() => onToggle(skill)}
                        className="size-4 accent-[var(--codex-accent)]"
                      />
                      {t.skills.enabled}
                    </label>
                  )}
                  <IconButton
                    size="sm"
                    label={`${t.common.edit} : ${skill.name}`}
                    icon={<Pencil />}
                    onClick={() => setEditing(skill)}
                  />
                  <IconButton
                    size="sm"
                    label={`${t.common.remove} : ${skill.name}`}
                    icon={<Trash />}
                    onClick={() => onRemove(skill)}
                  />
                </li>
              ))}
            </ul>
          </section>
        )
      })}
      <SkillDialog
        skill={editing}
        onClose={() => setEditing(null)}
        onSave={(skill) => {
          onSave(skill)
          setEditing(null)
        }}
      />
    </div>
  )
}

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
  const [launching, setLaunching] = useState<string | null>(null)
  const next = nextExtraSkillLevel(entity.level, rules)
  const total = entity.skills.filter((s) => s.kind !== 'class').length
  return (
    <div className="space-y-6">
      <p className="flex flex-wrap gap-x-3 text-sm text-ink-muted">
        <span className="tabular font-medium text-ink">{t.skills.total(total)}</span>
        {next !== null && <span>{t.skills.nextReminder(next)}</span>}
      </p>
      <SkillList
        skills={entity.skills}
        onSave={editor.saveSkill}
        onRemove={editor.removeSkill}
        onToggle={(skill) => editor.toggleSkill(skill.id)}
        onLaunch={playable ? (skill) => setLaunching(skill.id) : undefined}
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
