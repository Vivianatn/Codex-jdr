import { activeDb, hasActiveDb } from '@/db/db'
import { ACTIVITY_LIMIT, nextActivity, type ActivityKind } from '@/domain/activity'
import type { Participant } from '@/domain/turns'
import { isHostDevice, selfParticipant, useOnlineStore } from '@/online/onlineStore'

/**
 * Writes the activity log (D-247). Lines are signed by whoever acts on this
 * device; online, a co-editor's lines reach the host like its other writes and
 * the host checks the signature. Writes are queued so that merging reads the
 * line written just before.
 */

let actingAs: Participant | null = null
let queue: Promise<void> = Promise.resolve()

/** Signs what `fn` does with `author` (the host playing a player's intent). */
export function withActivityAuthor<R>(author: Participant, fn: () => R): R {
  const previous = actingAs
  actingAs = author
  try {
    return fn()
  } finally {
    actingAs = previous
  }
}

export function recordActivity(
  campaignId: string | null,
  label: string,
  kind: ActivityKind = 'do',
) {
  // Players act through intents the host signs; their copy keeps no log of its own.
  if (!campaignId || !label.trim() || !hasActiveDb()) return
  if (useOnlineStore.getState().guestRole === 'player') return
  const author = actingAs ?? selfParticipant()
  const at = Date.now()
  const db = activeDb()
  queue = queue
    .then(() =>
      db.transaction('rw', db.activity, async () => {
        const range = db.activity
          .where('[campaignId+at]')
          .between([campaignId, -Infinity], [campaignId, Infinity])
        const latest = await range.last()
        await db.activity.put(nextActivity(latest, { campaignId, author, kind, label, at }))
        // Only the owner trims the log; a co-editor's copy follows the host.
        if (!isHostDevice()) return
        const overflow = (await range.count()) - ACTIVITY_LIMIT
        if (overflow > 0) await db.activity.bulkDelete(await range.limit(overflow).primaryKeys())
      }),
    )
    .catch((error: unknown) => {
      // The database may close meanwhile (lock, leaving an online game): the line is lost, nothing else.
      if (!(error instanceof Error && error.name === 'DatabaseClosedError'))
        console.warn('Activity not recorded', error)
    })
}

/** Waits for pending lines (tests). */
export function flushActivity(): Promise<void> {
  return queue
}
