import type { ActivityRecord } from '@/domain/activity'
import { activeDb, type CodexDB } from './db'

/** Activity log of a campaign (D-247); lines are written by `recordActivity`. */
export function createActivityRepository(db: () => CodexDB = activeDb) {
  return {
    /** Newest first (the log is capped, see ACTIVITY_LIMIT). */
    list(campaignId: string): Promise<ActivityRecord[]> {
      return db()
        .activity.where('[campaignId+at]')
        .between([campaignId, -Infinity], [campaignId, Infinity])
        .reverse()
        .toArray()
    },
  }
}

export const activityRepository = createActivityRepository()
