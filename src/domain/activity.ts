import type { Participant } from './turns'

/**
 * Activity log of a campaign (D-247): who did what, for the dashboard. Each
 * undoable change and each library edit adds a line signed by the editor who
 * made it (the GM offline, the host or a co-editor online). Repeated lines
 * (dragging a token, typing in a field) are merged instead of piling up.
 */

export type ActivityKind = 'do' | 'undo' | 'redo'

export interface ActivityRecord {
  id: string
  campaignId: string
  at: number
  author: Participant
  kind: ActivityKind
  /** What was done, as the undo history names it ("Gorak −7 PV"). */
  label: string
  /** How many identical actions this line stands for. */
  count: number
}

/** Kept per campaign; older lines are dropped. */
export const ACTIVITY_LIMIT = 300
/** Same author, same action within this delay: one line. */
export const ACTIVITY_MERGE_MS = 2 * 60_000
export const ACTIVITY_LABEL_MAX = 200

export interface NewActivity {
  campaignId: string
  author: Participant
  kind: ActivityKind
  label: string
  at: number
}

/**
 * The record to write for `next`: the latest line updated when it is the same
 * action by the same author a moment ago, otherwise a new line.
 */
export function nextActivity(
  latest: ActivityRecord | undefined,
  next: NewActivity,
  newId: () => string = () => crypto.randomUUID(),
): ActivityRecord {
  const label = next.label.trim().slice(0, ACTIVITY_LABEL_MAX)
  if (
    latest &&
    latest.campaignId === next.campaignId &&
    latest.author.id === next.author.id &&
    latest.kind === next.kind &&
    latest.label === label &&
    next.at - latest.at <= ACTIVITY_MERGE_MS
  )
    return { ...latest, at: next.at, count: latest.count + 1 }
  return { ...next, label, id: newId(), count: 1 }
}

/** Editors who appear in the log, most recently active first. */
export function activityAuthors(records: readonly ActivityRecord[]): Participant[] {
  const seen = new Map<string, Participant>()
  for (const r of [...records].sort((a, b) => b.at - a.at))
    if (!seen.has(r.author.id)) seen.set(r.author.id, r.author)
  return [...seen.values()]
}

/** True when `value` is a well-formed activity line of `campaignId` signed by `author`. */
export function isValidActivity(
  value: Record<string, unknown>,
  campaignId: string,
  author: Participant,
): boolean {
  const a = value.author as Record<string, unknown> | null | undefined
  return (
    value.campaignId === campaignId &&
    typeof value.at === 'number' &&
    Number.isFinite(value.at) &&
    (value.kind === 'do' || value.kind === 'undo' || value.kind === 'redo') &&
    typeof value.label === 'string' &&
    value.label.length <= ACTIVITY_LABEL_MAX &&
    typeof value.count === 'number' &&
    Number.isInteger(value.count) &&
    value.count >= 1 &&
    typeof a === 'object' &&
    a !== null &&
    a.id === author.id &&
    a.name === author.name
  )
}
