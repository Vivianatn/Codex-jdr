import { useLiveQuery } from 'dexie-react-hooks'
import { Pencil, Play, Plus, Trash } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { MapRollIllustration } from '@/components/illustrations'
import { Button, IconButton } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Tab, TabList, TabPanel, Tabs } from '@/components/ui/Tabs'
import { sessionRepository } from '@/db/sessions'
import { newSessionPlan, type SessionPlan, type SessionRun } from '@/domain/sessions'
import { useCampaign } from '@/features/shell/campaignContext'
import { PageTransition } from '@/features/shell/PageTransition'
import { useIntlLocale, useT } from '@/i18n'
import { recordActivity } from '@/stores/activityLog'

/** Préparation › Sessions: reusable session plans and the games played (D-244). */
export function SessionsPage() {
  const t = useT()
  const campaign = useCampaign()
  const navigate = useNavigate()
  const plans = useLiveQuery(() => sessionRepository.listPlans(campaign.id), [campaign.id])
  const runs = useLiveQuery(() => sessionRepository.listRuns(campaign.id), [campaign.id])
  const [deleting, setDeleting] = useState<SessionPlan | null>(null)
  const editorPath = (id: string) => `/c/${campaign.id}/prep/sessions/s/${id}`

  const create = async () => {
    const plan = newSessionPlan(campaign.id, t.sessions.defaultTitle)
    await sessionRepository.savePlan(plan)
    recordActivity(campaign.id, t.activity.sessionCreated(plan.title))
    navigate(editorPath(plan.id))
  }
  const newButton = (
    <Button variant="primary" icon={<Plus />} onClick={() => void create()}>
      {t.sessions.new}
    </Button>
  )

  return (
    <PageTransition className="px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="type-screen-title text-ink">{t.sessions.title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">{t.sessions.subtitle}</p>
        </div>
        {plans && plans.length > 0 && newButton}
      </div>
      <div className="h-6" aria-hidden />

      <Tabs defaultValue="plans">
        <TabList label={t.sessions.title}>
          <Tab value="plans">{t.sessions.tabPlans}</Tab>
          <Tab value="runs">{t.sessions.tabRuns}</Tab>
        </TabList>
        <TabPanel value="plans">
          {plans?.length === 0 ? (
            <EmptyState
              illustration={<MapRollIllustration label={t.illustrations.mapRoll} />}
              eyebrow={t.sessions.title}
              title={t.sessions.emptyTitle}
              body={t.sessions.emptyBody}
              actions={newButton}
            />
          ) : (
            <ul className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {plans?.map((plan) => (
                <li
                  key={plan.id}
                  className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4"
                >
                  <div className="min-w-0">
                    <Link
                      to={editorPath(plan.id)}
                      className="type-card-title text-ink hover:text-accent-text hover:underline"
                    >
                      {plan.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-ink-muted tabular-nums">
                      {t.sessions.objectivesCount(plan.objectives.length)} ·{' '}
                      {t.sessions.timesPlayed(plan.timesPlayed)}
                    </p>
                    {plan.summary && (
                      <p className="mt-2 line-clamp-3 text-sm text-ink-muted">{plan.summary}</p>
                    )}
                  </div>
                  <div className="mt-auto flex flex-wrap items-center gap-1">
                    <Button
                      size="sm"
                      icon={<Pencil />}
                      onClick={() => navigate(editorPath(plan.id))}
                    >
                      {t.sessions.edit}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Play />}
                      onClick={() => navigate(`/c/${campaign.id}/play?session=${plan.id}`)}
                    >
                      {t.sessions.play}
                    </Button>
                    <span className="flex-1" />
                    <IconButton
                      size="sm"
                      label={`${t.sessions.remove} : ${plan.title}`}
                      icon={<Trash />}
                      onClick={() => setDeleting(plan)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabPanel>
        <TabPanel value="runs">
          {runs?.length === 0 ? (
            <EmptyState
              illustration={<MapRollIllustration label={t.illustrations.mapRoll} />}
              eyebrow={t.sessions.title}
              title={t.sessions.runsEmptyTitle}
              body={t.sessions.runsEmptyBody}
            />
          ) : (
            <ul className="mt-4 space-y-2">
              {runs?.map((run) => (
                <RunRow key={run.id} run={run} plans={plans ?? []} />
              ))}
            </ul>
          )}
        </TabPanel>
      </Tabs>

      <Dialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t.sessions.removeTitle}
        description={deleting ? t.sessions.removeBody(deleting.title) : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              {t.common.cancel}
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (!deleting) return
                await sessionRepository.removePlan(deleting.id)
                recordActivity(campaign.id, t.activity.sessionRemoved(deleting.title))
                toast(t.sessions.removed)
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

function RunRow({ run, plans }: { run: SessionRun; plans: SessionPlan[] }) {
  const t = useT()
  const locale = useIntlLocale()
  const plan = plans.find((p) => p.id === run.planId)
  const objectives = plan?.objectives.length ?? 0
  const done = plan
    ? run.objectivesDone.filter((id) => plan.objectives.some((o) => o.id === id)).length
    : 0
  const minutes = run.endedAt
    ? Math.max(1, Math.round((run.endedAt - run.startedAt) / 60_000))
    : null

  return (
    <li className="rounded-lg border border-line bg-surface px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium text-ink">{run.title}</p>
        <p className="text-xs text-ink-muted tabular-nums">
          {new Date(run.startedAt).toLocaleString(locale, {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
          {' · '}
          {minutes === null ? t.sessions.runInProgress : t.sessions.runDuration(minutes)}
        </p>
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        {t.sessions.runMode[run.mode]} · {t.sessions.runBy(run.operators.join(', '))}
        {run.participants.length > 1 && <> · {t.sessions.runWith(run.participants.join(', '))}</>}
        {objectives > 0 && <> · {t.sessions.runObjectives(done, objectives)}</>}
      </p>
      {run.notes && <p className="mt-2 text-sm whitespace-pre-line text-ink">{run.notes}</p>}
    </li>
  )
}
