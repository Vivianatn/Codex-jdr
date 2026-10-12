import * as Popover from '@radix-ui/react-popover'
import { useLiveQuery } from 'dexie-react-hooks'
import { BookOpenCheck, CircleStop, Hand } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { CheckboxField, CommitTextArea } from '@/components/ui/fields'
import { Dialog } from '@/components/ui/Dialog'
import { sessionRepository } from '@/db/sessions'
import { isOperator } from '@/domain/turns'
import { createLiveActions } from '@/features/game/liveActions'
import { useCampaign } from '@/features/shell/campaignContext'
import { useT } from '@/i18n'
import { useOnlineStore } from '@/online/onlineStore'
import { useEditors } from '@/online/useEditors'
import { useCampaignStore } from '@/stores/campaignStore'

/** "Session en cours" in the turn bar: objectives, notes, handover, end of game (D-244). */
export function SessionMenu() {
  const t = useT()
  const campaign = useCampaign()
  const live = useCampaignStore((s) => s.play.live)
  const selfId = useOnlineStore((s) => s.selfId)
  const operating = useCampaignStore((s) => isOperator(s.play, selfId))
  const actions = useMemo(() => createLiveActions(t, campaign), [t, campaign])
  const plan = useLiveQuery(
    async () => (live?.planId ? ((await sessionRepository.getPlan(live.planId)) ?? null) : null),
    [live?.planId],
  )
  const run = useLiveQuery(
    async () => (live ? ((await sessionRepository.getRun(live.runId)) ?? null) : null),
    [live?.runId],
  )
  const editors = useEditors()
  const [ending, setEnding] = useState(false)
  if (!live) return null

  return (
    <>
      <Popover.Root>
        <Popover.Trigger asChild>
          <Button variant="ghost" icon={<BookOpenCheck />} data-testid="session-menu">
            {run?.title ?? t.sessions.menu}
          </Button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="end"
            sideOffset={6}
            collisionPadding={16}
            className="z-50 w-80 space-y-4 rounded-xl border border-line bg-surface-raised p-4 shadow-lifted"
          >
            <div>
              <p className="type-eyebrow">{t.sessions.menu}</p>
              <p className="mt-1 type-card-title text-ink">{run?.title}</p>
              <p className="text-xs text-ink-muted">
                {operating ? t.sessions.operatorSelf : t.sessions.operator(live.operator.name)}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-ink">{t.sessions.objectivesInPlay}</p>
              {plan && plan.objectives.length > 0 ? (
                plan.objectives.map((o) => (
                  <CheckboxField
                    key={o.id}
                    label={o.text}
                    checked={run?.objectivesDone.includes(o.id) ?? false}
                    onChange={() => operating && void actions.toggleObjective(o.id)}
                  />
                ))
              ) : (
                <p className="text-xs text-ink-muted">{t.sessions.noObjectives}</p>
              )}
            </div>

            {plan?.notes && (
              <div>
                <p className="text-sm font-semibold text-ink">{t.sessions.notes}</p>
                <p className="mt-1 max-h-40 overflow-y-auto text-sm whitespace-pre-line text-ink-muted">
                  {plan.notes}
                </p>
              </div>
            )}

            {operating && (
              <CommitTextArea
                label={t.sessions.runNotes}
                value={run?.notes ?? ''}
                onCommit={(notes) => void actions.saveRunNotes(notes)}
              />
            )}

            {operating && (
              <div className="space-y-1">
                <p className="text-sm font-semibold text-ink">{t.sessions.handOver}</p>
                {editors.length === 0 ? (
                  <p className="text-xs text-ink-muted">{t.sessions.nobodyToHandOver}</p>
                ) : (
                  editors.map((e) => (
                    <Button
                      key={e.id}
                      size="sm"
                      variant="ghost"
                      icon={<Hand />}
                      onClick={() => void actions.handOver(e)}
                    >
                      {t.sessions.handOverTo(e.name)}
                    </Button>
                  ))
                )}
              </div>
            )}

            {operating && (
              <Button
                variant="danger"
                className="w-full"
                icon={<CircleStop />}
                onClick={() => setEnding(true)}
              >
                {t.sessions.end}
              </Button>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <Dialog
        open={ending}
        onOpenChange={setEnding}
        title={t.sessions.endTitle}
        description={t.sessions.endBody}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEnding(false)}>
              {t.common.cancel}
            </Button>
            <Button
              variant="danger"
              data-testid="end-game-confirm"
              onClick={async () => {
                await actions.end()
                setEnding(false)
              }}
            >
              {t.sessions.end}
            </Button>
          </>
        }
      />
    </>
  )
}
