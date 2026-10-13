import { createEntity, normalizeEntityShape } from '@/domain/entity'
import { ENTITY_KINDS, STAT_KEYS, type Entity, type EntityKind } from '@/domain/types'
import { defaultRules } from '@/rules'
import { isRecord } from '@/lib/guards'

/**
 * Validates an entity coming from an import file and fills any missing field
 * with its default, so older or hand-edited files still load.
 * Returns null when the record is not an entity at all.
 */
export function normalizeEntity(value: unknown, campaignId: string): Entity | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id) return null
  if (!ENTITY_KINDS.includes(value.kind as EntityKind)) return null
  const kind = value.kind as EntityKind
  const base = createEntity(kind, campaignId, defaultRules())
  const pick = <T>(v: unknown, fallback: T): T =>
    v === undefined || v === null || typeof v !== typeof fallback ? fallback : (v as T)
  const stats = isRecord(value.stats) ? value.stats : {}
  return normalizeEntityShape({
    ...base,
    id: value.id,
    campaignId,
    identity: { ...base.identity, ...(isRecord(value.identity) ? value.identity : {}) },
    level: pick(value.level, base.level),
    hp: { ...base.hp, ...(isRecord(value.hp) ? value.hp : {}) },
    stats: Object.fromEntries(STAT_KEYS.map((k) => [k, pick(stats[k], 10)])) as Entity['stats'],
    modifiers: Array.isArray(value.modifiers) ? value.modifiers : [],
    skills: Array.isArray(value.skills) ? value.skills : [],
    conditions: Array.isArray(value.conditions) ? value.conditions : [],
    inventory: Array.isArray(value.inventory) ? value.inventory : [],
    journal: Array.isArray(value.journal) ? value.journal : [],
    details: { ...base.details, ...(isRecord(value.details) ? value.details : {}) },
    createdAt: pick(value.createdAt, base.createdAt),
    updatedAt: pick(value.updatedAt, base.updatedAt),
    purse: pick(value.purse, 0),
    exhaustion: pick(value.exhaustion, 0),
    luckSpent: pick(value.luckSpent, 0),
  } as Entity)
}
