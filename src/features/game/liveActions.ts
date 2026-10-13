import { bestiaryRepository } from '@/db/bestiary'
import { sessionRepository } from '@/db/sessions'
import type { Campaign } from '@/db/types'
import { instantiateTemplate } from '@/domain/entity'
import { startMapId, type PlayMode, type SessionRun } from '@/domain/sessions'
import type { Entity } from '@/domain/types'
import { addGroup, addMember, stopTurns, type Participant } from '@/domain/turns'
import type { Messages } from '@/i18n/locales/fr'
import { selfParticipant } from '@/online/onlineStore'
import { campaignHistory, useCampaignStore } from '@/stores/campaignStore'

/**
 * Starting and ending a game (D-244). Play starts by hand, from a session plan
 * or as a free game; the editor who starts it becomes the operator, the only
 * one acting on the table. Each start is a checkpoint: the undo history is
 * cleared so nobody can undo across it.
 */
export function createLiveActions(t: Messages, campaign: Campaign) {
  const store = () => useCampaignStore.getState()

  return {
    async start(options: { planId: string | null; mode: PlayMode }): Promise<SessionRun | null> {
      if (store().play.live) return null
      const self = selfParticipant()
      const plan = options.planId ? await sessionRepository.getPlan(options.planId) : null
      const now = Date.now()
      const run: SessionRun = {
        id: crypto.randomUUID(),
        campaignId: campaign.id,
        planId: plan?.id ?? null,
        title: plan?.title ?? t.sessions.freeGame,
        mode: options.mode,
        startedAt: now,
        endedAt: null,
        operators: [self.name],
        participants: [self.name],
        objectivesDone: [],
        notes: '',
      }
      await sessionRepository.saveRun(run)

      let groupId: string | null = null
      if (plan) {
        await sessionRepository.savePlan({
          ...plan,
          timesPlayed: plan.timesPlayed + 1,
          lastPlayedAt: now,
        })
        // The plan's encounters come in as numbered enemies, gathered in a group.
        const enemies: Entity[] = []
        for (const encounter of plan.encounters) {
          const template = await bestiaryRepository.get(encounter.templateId)
          if (!template || template.kind !== 'enemy') continue
          enemies.push(
            ...instantiateTemplate(template, {
              campaignId: campaign.id,
              quantity: encounter.count,
              level: template.level,
              existing: [...Object.values(store().entities), ...enemies],
              rules: campaign.rules,
              now,
            }),
          )
        }
        if (enemies.length) {
          store().addEntities(enemies, t.sessions.encounterLabel(plan.title))
          groupId = crypto.randomUUID()
          const id = groupId
          store().updatePlay(
            (play) =>
              enemies.reduce(
                (next, e) => addMember(next, id, e.id),
                addGroup(play, t.sessions.encounterGroup(plan.title), id),
              ),
            t.sessions.encounterLabel(plan.title),
          )
        }
      }

      store().updatePlay(
        (play) => ({
          ...stopTurns(play),
          mapId: startMapId(plan) ?? play.mapId,
          live: {
            runId: run.id,
            planId: run.planId,
            mode: options.mode,
            startedAt: now,
            operator: self,
          },
        }),
        t.sessions.started,
      )
      campaignHistory.getState().clear()
      return run
    },

    async end(): Promise<void> {
      const live = store().play.live
      if (!live) return
      await sessionRepository.updateRun(live.runId, (run) => ({ ...run, endedAt: Date.now() }))
      store().updatePlay((play) => ({ ...stopTurns(play), live: null }), t.sessions.ended)
      campaignHistory.getState().clear()
    },

    /** The operator hands the table to another editor. */
    async handOver(to: Participant): Promise<void> {
      const live = store().play.live
      if (!live || live.operator.id === to.id) return
      store().updatePlay(
        (play) => (play.live ? { ...play, live: { ...play.live, operator: to } } : play),
        t.sessions.handedOver(to.name),
      )
      campaignHistory.getState().clear()
      await sessionRepository.updateRun(live.runId, (run) => ({
        ...run,
        operators: run.operators.includes(to.name) ? run.operators : [...run.operators, to.name],
      }))
    },

    async toggleObjective(objectiveId: string): Promise<void> {
      const live = store().play.live
      if (!live) return
      await sessionRepository.updateRun(live.runId, (run) => ({
        ...run,
        objectivesDone: run.objectivesDone.includes(objectiveId)
          ? run.objectivesDone.filter((id) => id !== objectiveId)
          : [...run.objectivesDone, objectiveId],
      }))
    },

    async saveRunNotes(notes: string): Promise<void> {
      const live = store().play.live
      if (live) await sessionRepository.updateRun(live.runId, (run) => ({ ...run, notes }))
    },
  }
}

export type LiveActions = ReturnType<typeof createLiveActions>
