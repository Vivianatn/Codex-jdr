import type { SessionPlan, SessionRun } from '@/domain/sessions'
import { activeDb, type CodexDB } from './db'

/** Session plans and the games played (D-244). */
export function createSessionRepository(
  db: () => CodexDB = activeDb,
  now: () => number = Date.now,
) {
  return {
    async listPlans(campaignId: string): Promise<SessionPlan[]> {
      const all = await db().sessions.where('campaignId').equals(campaignId).toArray()
      return all.sort((a, b) => a.createdAt - b.createdAt)
    },
    getPlan(id: string): Promise<SessionPlan | undefined> {
      return db().sessions.get(id)
    },
    async savePlan(plan: SessionPlan): Promise<void> {
      await db().sessions.put({ ...plan, updatedAt: now() })
    },
    async removePlan(id: string): Promise<void> {
      await db().sessions.delete(id)
    },

    /** Newest first. */
    async listRuns(campaignId: string): Promise<SessionRun[]> {
      const all = await db().sessionRuns.where('campaignId').equals(campaignId).toArray()
      return all.sort((a, b) => b.startedAt - a.startedAt)
    },
    getRun(id: string): Promise<SessionRun | undefined> {
      return db().sessionRuns.get(id)
    },
    async saveRun(run: SessionRun): Promise<void> {
      await db().sessionRuns.put(run)
    },
    async updateRun(id: string, recipe: (run: SessionRun) => SessionRun): Promise<void> {
      await db().transaction('rw', db().sessionRuns, async () => {
        const run = await db().sessionRuns.get(id)
        if (run) await db().sessionRuns.put(recipe(run))
      })
    },
  }
}

export const sessionRepository = createSessionRepository()
