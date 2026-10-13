import { isRecord } from '@/lib/guards'
/**
 * Sessions (D-244): the former « quêtes » became reusable session plans. A plan
 * is prepared once (objectives, rewards, notes, map, encounters) and put in
 * play as many times as wanted; each time creates a run, the record of what
 * happened at the table.
 */

export interface SessionObjective {
  id: string
  text: string
}

/** Enemies brought into play from the bestiary when the session starts. */
export interface SessionEncounter {
  id: string
  templateId: string
  count: number
}

export interface SessionPlan {
  id: string
  campaignId: string
  title: string
  summary: string
  objectives: SessionObjective[]
  rewards: { xp: number; money: number; items: string }
  /** GM only, never shown to players. */
  notes: string
  /**
   * The session's maps in their order of appearance (D-258): the first is put
   * on the board when the session starts, the GM moves on to the next ones.
   */
  mapIds: string[]
  encounters: SessionEncounter[]
  timesPlayed: number
  lastPlayedAt: number | null
  createdAt: number
  updatedAt: number
}

/** `local`: the GM alone moves and rolls. `online`: players join and act (D-245). */
export type PlayMode = 'local' | 'online'

export interface SessionRun {
  id: string
  campaignId: string
  /** Plan it was started from; null for a free game. */
  planId: string | null
  title: string
  mode: PlayMode
  startedAt: number
  endedAt: number | null
  /** Who started it, then who ran it (handovers). */
  operators: string[]
  /** Names of everyone who joined (online). */
  participants: string[]
  objectivesDone: string[]
  notes: string
}

export function newSessionPlan(campaignId: string, title: string, now = Date.now()): SessionPlan {
  return {
    id: crypto.randomUUID(),
    campaignId,
    title,
    summary: '',
    objectives: [],
    rewards: { xp: 0, money: 0, items: '' },
    notes: '',
    mapIds: [],
    encounters: [],
    timesPlayed: 0,
    lastPlayedAt: null,
    createdAt: now,
    updatedAt: now,
  }
}

const text = (v: unknown, max = 20_000) => (typeof v === 'string' ? v.slice(0, max) : '')
const count = (v: unknown, min = 0) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.floor(v)) : min

/** Validates a plan from a file or a peer; null when it is not a plan at all. */
export function normalizeSessionPlan(raw: unknown, campaignId: string): SessionPlan | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || !raw.id) return null
  const base = newSessionPlan(campaignId, text(raw.title, 200) || 'Session')
  const rewards = isRecord(raw.rewards) ? raw.rewards : {}
  return {
    ...base,
    id: raw.id,
    summary: text(raw.summary),
    notes: text(raw.notes),
    objectives: (Array.isArray(raw.objectives) ? raw.objectives : [])
      .filter((o): o is SessionObjective => isRecord(o) && typeof o.id === 'string')
      .map((o) => ({ id: o.id, text: text(o.text, 500) })),
    rewards: {
      xp: count(rewards.xp),
      money: count(rewards.money),
      items: text(rewards.items, 2000),
    },
    // Plans saved before D-258 had one map.
    mapIds: [
      ...new Set(
        Array.isArray(raw.mapIds)
          ? raw.mapIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
          : typeof raw.mapId === 'string'
            ? [raw.mapId]
            : [],
      ),
    ].slice(0, 100),
    encounters: (Array.isArray(raw.encounters) ? raw.encounters : [])
      .filter(
        (e): e is SessionEncounter =>
          isRecord(e) && typeof e.id === 'string' && typeof e.templateId === 'string',
      )
      .map((e) => ({ id: e.id, templateId: e.templateId, count: Math.min(50, count(e.count, 1)) })),
    timesPlayed: count(raw.timesPlayed),
    lastPlayedAt: typeof raw.lastPlayedAt === 'number' ? raw.lastPlayedAt : null,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : base.createdAt,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : base.updatedAt,
  }
}

export function normalizeSessionRun(raw: unknown, campaignId: string): SessionRun | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || !raw.id) return null
  const strings = (v: unknown) =>
    (Array.isArray(v) ? v : []).filter((s): s is string => typeof s === 'string')
  return {
    id: raw.id,
    campaignId,
    planId: typeof raw.planId === 'string' ? raw.planId : null,
    title: text(raw.title, 200),
    mode: raw.mode === 'online' ? 'online' : 'local',
    startedAt: typeof raw.startedAt === 'number' ? raw.startedAt : 0,
    endedAt: typeof raw.endedAt === 'number' ? raw.endedAt : null,
    operators: strings(raw.operators),
    participants: strings(raw.participants),
    objectivesDone: strings(raw.objectivesDone),
    notes: text(raw.notes),
  }
}

/** "2 / 3" objectives done in a run of this plan. */
export function objectivesProgress(plan: SessionPlan, run: SessionRun | null) {
  const ids = new Set(plan.objectives.map((o) => o.id))
  const done = (run?.objectivesDone ?? []).filter((id) => ids.has(id)).length
  return { done, total: ids.size }
}

/** Map shown when the session starts. */
export function startMapId(plan: Pick<SessionPlan, 'mapIds'> | null | undefined): string | null {
  return plan?.mapIds[0] ?? null
}

/** The map after `currentId` in the session's order (the first when the board is elsewhere). */
export function nextSessionMapId(
  plan: Pick<SessionPlan, 'mapIds'>,
  currentId: string | null,
): string | null {
  const index = currentId ? plan.mapIds.indexOf(currentId) : -1
  return plan.mapIds[index + 1] ?? null
}

/** Moves the map at `from` to `to` in the session's order. */
export function moveSessionMap(mapIds: readonly string[], from: number, to: number): string[] {
  if (from === to || from < 0 || from >= mapIds.length) return [...mapIds]
  const next = [...mapIds]
  const [moved] = next.splice(from, 1)
  next.splice(Math.max(0, Math.min(to, next.length)), 0, moved!)
  return next
}
