import type { RollRecord } from '@/domain/rolls'

/**
 * Which rolls the dice stage plays, and how fast (D-268). Pure: the component
 * only feeds it the roll list it sees and the clock.
 */

/** A roll older than this is history (initial sync, reconnection catch-up): never staged. */
export const STAGE_FRESH_MS = 8000
/** Rolls waiting at most; older ones are dropped so the table never lags behind. */
export const STAGE_MAX_QUEUE = 4

export interface StageFilter {
  now: number
  /** Secret GM rolls show on the GM's own devices only. */
  showSecret: boolean
}

/**
 * Rolls of `rolls` that were never seen, are recent, and may show on this device,
 * oldest first. Every roll of the list is added to `seen` (staged or not), so a
 * roll is considered once.
 */
export function freshRolls(
  rolls: readonly RollRecord[],
  seen: Set<string>,
  { now, showSecret }: StageFilter,
): RollRecord[] {
  const out: RollRecord[] = []
  for (const roll of rolls) {
    if (seen.has(roll.id)) continue
    seen.add(roll.id)
    if (roll.secret && !showSecret) continue
    if (now - roll.at > STAGE_FRESH_MS) continue
    out.push(roll)
  }
  return out.sort((a, b) => a.at - b.at)
}

/** Adds rolls behind the queue, keeping the newest `max`. The one showing (index 0) is kept. */
export function enqueueRolls(
  queue: readonly RollRecord[],
  incoming: readonly RollRecord[],
  max = STAGE_MAX_QUEUE,
): RollRecord[] {
  if (!incoming.length) return queue as RollRecord[]
  const [current, ...waiting] = queue
  const next = [...waiting, ...incoming].slice(-max)
  return current ? [current, ...next] : next
}

/** How long a roll stays on stage (ms): shorter when others wait, shorter without motion. */
export function stageDuration(waiting: number, animated: boolean): number {
  if (!animated) return waiting > 0 ? 900 : 1600
  if (waiting >= 3) return 1300
  if (waiting >= 1) return 1900
  return 2600
}
