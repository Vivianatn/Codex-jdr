import { effectiveStat, hpMax, type RulesConfig } from '@/rules'
import { normalizeCondition } from './conditions'
import { equippedItems, isOverloaded, normalizeItem } from './items'
import {
  STAT_KEYS,
  type DetailsByKind,
  type Entity,
  type EntityKind,
  type EntityOfKind,
  type Identity,
  type JournalKind,
  type Skill,
  type SkillKind,
  type StatKey,
  type StatModifier,
  type Stats,
} from './types'

export function newId(): string {
  return crypto.randomUUID()
}

export function emptyIdentity(): Identity {
  return {
    discordName: '',
    pseudo: '',
    className: '',
    weaponType: '',
    origin: '',
    description: '',
    mindset: '',
    portrait: null,
  }
}

export function uniformStats(value: number): Stats {
  return Object.fromEntries(STAT_KEYS.map((key) => [key, value])) as Stats
}

export function defaultDetails<K extends EntityKind>(kind: K): DetailsByKind[K] {
  const details: DetailsByKind = {
    player: { xp: 0 },
    enemy: { templateId: null, copyNumber: null, xpReward: 0, loot: '' },
    familiar: { ownerId: null, loyalty: 50, actsOnOwnerTurn: true },
    ally: { disposition: 'neutral', controlledBy: '' },
  }
  return details[kind]
}

export interface NewEntityInput {
  identity?: Partial<Identity>
  level?: number
  hpRoll?: number
  stats?: Stats
  now?: number
}

/** A fresh entity at full HP. */
export function createEntity<K extends EntityKind>(
  kind: K,
  campaignId: string,
  rules: RulesConfig,
  input: NewEntityInput = {},
): EntityOfKind<K> {
  const now = input.now ?? Date.now()
  const level = input.level ?? 1
  const roll = input.hpRoll ?? 10
  return {
    id: newId(),
    campaignId,
    kind,
    identity: { ...emptyIdentity(), ...input.identity },
    level,
    hp: { roll, current: hpMax(roll, level, rules), temp: 0 },
    stats: input.stats ?? uniformStats(10),
    modifiers: [],
    skills: [],
    conditions: [],
    inventory: [],
    purse: 0,
    exhaustion: 0,
    luckSpent: 0,
    journal: [],
    details: defaultDetails(kind),
    createdAt: now,
    updatedAt: now,
  } as unknown as EntityOfKind<K>
}

/** Display name: the character name, else the Discord name. */
export function entityName(entity: Pick<Entity, 'identity'>, fallback = 'Sans nom'): string {
  return entity.identity.pseudo.trim() || entity.identity.discordName.trim() || fallback
}

export function entityHpMax(entity: Pick<Entity, 'hp' | 'level'>, rules: RulesConfig): number {
  return hpMax(entity.hp.roll, entity.level, rules)
}

/** Every modifier currently applied to a characteristic, with its source. */
/**
 * Every modifier currently applied to a characteristic, with its source:
 * manual, enabled passive skills, equipped items, conditions, and — when the
 * rules are given — the overload penalty on Dexterity.
 */
export function activeModifiers(
  entity: Entity,
  stat: StatKey,
  rules?: RulesConfig,
): StatModifier[] {
  const fromSkills = entity.skills
    .filter((skill) => skill.enabled && skill.kind !== 'active')
    .flatMap((skill) => skill.modifiers.map((m) => ({ ...m, label: m.label || skill.name })))
  const fromItems = equippedItems(entity).flatMap((item) =>
    item.modifiers.map((m) => ({ ...m, label: m.label || item.name })),
  )
  const fromConditions = entity.conditions.flatMap((c) =>
    c.modifiers.map((m) => ({ ...m, label: m.label || c.name })),
  )
  const overload: StatModifier[] =
    rules && stat === 'dexterity' && rules.carry.overloadedDexPenalty && isOverloaded(entity, rules)
      ? [
          {
            id: 'overloaded',
            stat,
            value: -rules.carry.overloadedDexPenalty,
            label: OVERLOADED_LABEL,
          },
        ]
      : []
  return [...entity.modifiers, ...fromSkills, ...fromItems, ...fromConditions, ...overload].filter(
    (m) => m.stat === stat,
  )
}

/** Data label of the automatic "Surchargé" modifier (shown as is). */
export const OVERLOADED_LABEL = 'Surchargé'

export interface EffectiveStat {
  base: number
  total: number
  modifiers: StatModifier[]
}

export function effectiveStats(
  entity: Entity,
  rules?: RulesConfig,
): Record<StatKey, EffectiveStat> {
  return Object.fromEntries(
    STAT_KEYS.map((key) => {
      const modifiers = activeModifiers(entity, key, rules)
      const base = entity.stats[key]
      return [
        key,
        {
          base,
          total: effectiveStat(
            base,
            modifiers.map((m) => m.value),
          ),
          modifiers,
        },
      ]
    }),
  ) as Record<StatKey, EffectiveStat>
}

const JOURNAL_LIMIT = 500

/** Returns the entity with a new journal entry (newest last, capped). */
export function withJournal<E extends Entity>(
  entity: E,
  kind: JournalKind,
  text: string,
  now = Date.now(),
): E {
  const journal = [...entity.journal, { id: newId(), at: now, kind, text }].slice(-JOURNAL_LIMIT)
  return { ...entity, journal }
}

/** Deep copy with fresh ids everywhere (entity, skills, modifiers, items…). */
export function cloneEntity<E extends Entity>(entity: E, overrides: Partial<E> = {}): E {
  const fresh = <T extends { id: string }>(list: T[]) => list.map((x) => ({ ...x, id: newId() }))
  const copy = structuredClone(entity)
  return {
    ...copy,
    id: newId(),
    modifiers: fresh(copy.modifiers),
    skills: copy.skills.map((s) => ({ ...s, id: newId(), modifiers: fresh(s.modifiers) })),
    conditions: fresh(copy.conditions),
    inventory: fresh(copy.inventory),
    journal: [],
    ...overrides,
  }
}

export interface InstantiateOptions {
  campaignId: string
  quantity: number
  level: number
  /** Enemies already in the campaign, to continue the numbering. */
  existing: readonly Entity[]
  rules: RulesConfig
  now?: number
  journalText?: (name: string) => string
}

/**
 * Creates N numbered enemies from a bestiary template: "Gobelin 4", "Gobelin 5"…
 * Numbering continues after the highest copy already in the campaign.
 */
export function instantiateTemplate(
  template: EntityOfKind<'enemy'>,
  options: InstantiateOptions,
): EntityOfKind<'enemy'>[] {
  const now = options.now ?? Date.now()
  const highest = Math.max(
    0,
    ...options.existing
      .filter((e) => e.kind === 'enemy' && e.details.templateId === template.id)
      .map((e) => (e.kind === 'enemy' ? (e.details.copyNumber ?? 0) : 0)),
  )
  const baseName = entityName(template, 'Ennemi')
  const level = Math.max(1, Math.floor(options.level))
  return Array.from({ length: Math.max(0, Math.floor(options.quantity)) }, (_, i) => {
    const copyNumber = highest + i + 1
    const name = `${baseName} ${copyNumber}`
    const copy = cloneEntity(template, {
      campaignId: options.campaignId,
      level,
      createdAt: now,
      updatedAt: now,
    })
    const entity: EntityOfKind<'enemy'> = {
      ...copy,
      identity: { ...copy.identity, pseudo: name },
      hp: {
        roll: template.hp.roll,
        current: hpMax(template.hp.roll, level, options.rules),
        temp: 0,
      },
      details: { ...template.details, templateId: template.id, copyNumber },
    }
    return options.journalText
      ? withJournal(entity, 'created', options.journalText(name), now)
      : entity
  })
}

export function emptySkill(kind: SkillKind): Skill {
  return {
    id: newId(),
    name: '',
    kind,
    stat: null,
    description: '',
    enabled: true,
    modifiers: [],
    usesMax: null,
    usesLeft: null,
    cooldown: 0,
    cooldownLeft: 0,
    effect: { kind: 'none', expression: '', conditionId: null },
  }
}

/** Fills fields missing from skills saved before phase 2. */
export function normalizeSkill(
  raw: Partial<Skill> & { id: string; name: string; kind: SkillKind },
): Skill {
  const fallback = emptySkill(raw.kind)
  return {
    ...fallback,
    ...raw,
    id: raw.id,
    effect: { ...fallback.effect, ...(raw.effect ?? {}) },
  }
}

/** Upgrades an entity saved by an older version (phase 1) to the current shape. */
export function normalizeEntityShape<E extends Entity>(entity: E): E {
  return {
    ...entity,
    purse: entity.purse ?? 0,
    exhaustion: entity.exhaustion ?? 0,
    luckSpent: entity.luckSpent ?? 0,
    skills: entity.skills.map(normalizeSkill),
    conditions: entity.conditions.map(normalizeCondition),
    inventory: entity.inventory.map(normalizeItem),
  }
}

/** Characters that can own a familiar: players and allies. */
export function ownerOptions(entities: readonly Entity[]): { id: string; name: string }[] {
  return entities
    .filter((e) => e.kind === 'player' || e.kind === 'ally')
    .map((e) => ({ id: e.id, name: entityName(e) }))
}
