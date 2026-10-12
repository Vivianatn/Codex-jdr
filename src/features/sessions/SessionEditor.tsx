import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Play, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { Button, IconButton } from '@/components/ui/Button'
import { CommitInput, CommitTextArea, NumberInput, SelectField } from '@/components/ui/fields'
import { TextField } from '@/components/ui/TextField'
import { bestiaryRepository } from '@/db/bestiary'
import { sessionRepository } from '@/db/sessions'
import { entityName } from '@/domain/entity'
import type { SessionPlan } from '@/domain/sessions'
import { useCampaign } from '@/features/shell/campaignContext'
import { PageTransition } from '@/features/shell/PageTransition'
import { useT } from '@/i18n'
import { useCampaignStore } from '@/stores/campaignStore'
import { recordActivity } from '@/stores/activityLog'

const NO_MAP = '__none__'

/** Préparation › Sessions › one plan. Every change is saved at once (D-244). */
export function SessionEditor() {
  const t = useT()
  const campaign = useCampaign()
  const navigate = useNavigate()
  const { sessionId = '' } = useParams()
  // `null` = loaded but missing.
  const plan = useLiveQuery(
    async () => (await sessionRepository.getPlan(sessionId)) ?? null,
    [sessionId],
  )
  const templates = useLiveQuery(() => bestiaryRepository.list(campaign.id), [campaign.id])
  const maps = useCampaignStore((s) => s.maps)
  const [objective, setObjective] = useState('')
  const [templateId, setTemplateId] = useState('')
  const listPath = `/c/${campaign.id}/prep/sessions`

  if (plan === undefined) return null
  if (plan === null || plan.campaignId !== campaign.id) return <Navigate to={listPath} replace />

  const save = (patch: Partial<SessionPlan>) => {
    const next = { ...plan, ...patch }
    recordActivity(campaign.id, t.activity.sessionEdited(next.title))
    return sessionRepository.savePlan(next)
  }
  const addObjective = () => {
    const text = objective.trim()
    if (!text) return
    void save({ objectives: [...plan.objectives, { id: crypto.randomUUID(), text }] })
    setObjective('')
  }
  const chosenTemplate = templateId || templates?.[0]?.id || ''

  return (
    <PageTransition className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" icon={<ArrowLeft />} onClick={() => navigate(listPath)}>
          {t.sessions.back}
        </Button>
        <Button
          variant="primary"
          icon={<Play />}
          onClick={() => navigate(`/c/${campaign.id}/play?session=${plan.id}`)}
        >
          {t.sessions.play}
        </Button>
      </div>
      <h1 className="mt-4 type-screen-title text-ink">{plan.title}</h1>
      <p className="mt-1 text-sm text-ink-muted">{t.sessions.timesPlayed(plan.timesPlayed)}</p>

      <div className="mt-8 space-y-8">
        <section className="space-y-4">
          <CommitInput
            label={t.sessions.fieldTitle}
            value={plan.title}
            onCommit={(title) => void save({ title: title.trim() || t.sessions.defaultTitle })}
          />
          <CommitTextArea
            label={t.sessions.fieldSummary}
            hint={t.sessions.fieldSummaryHint}
            value={plan.summary}
            onCommit={(summary) => void save({ summary })}
          />
        </section>

        <section className="space-y-3">
          <h2 className="type-section text-ink">{t.sessions.objectives}</h2>
          {plan.objectives.length > 0 && (
            <ol className="list-decimal space-y-1 pl-6 text-sm text-ink">
              {plan.objectives.map((o) => (
                <li key={o.id}>
                  <span className="inline-flex items-center gap-1">
                    {o.text}
                    <IconButton
                      size="sm"
                      label={t.sessions.removeObjective(o.text)}
                      icon={<X />}
                      onClick={() =>
                        void save({ objectives: plan.objectives.filter((x) => x.id !== o.id) })
                      }
                    />
                  </span>
                </li>
              ))}
            </ol>
          )}
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              addObjective()
            }}
          >
            <TextField
              className="flex-1"
              label={t.sessions.addObjective}
              hideLabel
              placeholder={t.sessions.objectivePlaceholder}
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
            />
            <Button type="submit" icon={<Plus />} disabled={!objective.trim()}>
              {t.sessions.addObjective}
            </Button>
          </form>
        </section>

        <section className="space-y-3">
          <h2 className="type-section text-ink">{t.sessions.rewards}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberInput
              label={t.sessions.rewardXp}
              value={plan.rewards.xp}
              min={0}
              onCommit={(xp) => void save({ rewards: { ...plan.rewards, xp } })}
            />
            <NumberInput
              label={t.sessions.rewardMoney}
              value={plan.rewards.money}
              min={0}
              onCommit={(money) => void save({ rewards: { ...plan.rewards, money } })}
            />
          </div>
          <CommitTextArea
            label={t.sessions.rewardItems}
            value={plan.rewards.items}
            onCommit={(items) => void save({ rewards: { ...plan.rewards, items } })}
          />
        </section>

        <section className="space-y-3">
          <h2 className="type-section text-ink">{t.sessions.map}</h2>
          <SelectField<string>
            label={t.sessions.map}
            hideLabel
            value={plan.mapId ?? NO_MAP}
            onChange={(v) => void save({ mapId: v === NO_MAP ? null : v })}
            options={[
              { value: NO_MAP, label: t.sessions.noMap },
              ...Object.values(maps)
                .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
                .map((m) => ({ value: m.id, label: m.name })),
            ]}
          />
        </section>

        <section className="space-y-3">
          <h2 className="type-section text-ink">{t.sessions.encounters}</h2>
          <p className="text-xs text-ink-muted">{t.sessions.encountersHint}</p>
          {plan.encounters.length > 0 && (
            <ul className="space-y-2">
              {plan.encounters.map((enc) => {
                const template = templates?.find((x) => x.id === enc.templateId)
                const name = template ? entityName(template) : '?'
                return (
                  <li key={enc.id} className="flex items-end gap-2">
                    <span className="flex-1 pb-2.5 text-sm text-ink">{name}</span>
                    <NumberInput
                      className="w-28"
                      label={t.sessions.encounterCount}
                      value={enc.count}
                      min={1}
                      max={50}
                      onCommit={(count) =>
                        void save({
                          encounters: plan.encounters.map((x) =>
                            x.id === enc.id ? { ...x, count } : x,
                          ),
                        })
                      }
                    />
                    <IconButton
                      label={t.sessions.removeEncounter(name)}
                      icon={<X />}
                      onClick={() =>
                        void save({ encounters: plan.encounters.filter((x) => x.id !== enc.id) })
                      }
                    />
                  </li>
                )
              })}
            </ul>
          )}
          {templates && templates.length === 0 ? (
            <p className="text-sm text-ink-muted">{t.sessions.noTemplates}</p>
          ) : (
            <div className="flex items-end gap-2">
              <SelectField<string>
                className="flex-1"
                label={t.sessions.addEncounter}
                hideLabel
                value={chosenTemplate}
                onChange={setTemplateId}
                options={(templates ?? []).map((x) => ({ value: x.id, label: entityName(x) }))}
              />
              <Button
                icon={<Plus />}
                disabled={!chosenTemplate}
                onClick={() =>
                  void save({
                    encounters: [
                      ...plan.encounters,
                      { id: crypto.randomUUID(), templateId: chosenTemplate, count: 1 },
                    ],
                  })
                }
              >
                {t.sessions.addEncounter}
              </Button>
            </div>
          )}
        </section>

        <section>
          <CommitTextArea
            label={t.sessions.notes}
            hint={t.sessions.notesHint}
            value={plan.notes}
            onCommit={(notes) => void save({ notes })}
          />
        </section>
      </div>
    </PageTransition>
  )
}
