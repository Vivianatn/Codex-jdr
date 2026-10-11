import { emptySkill, newId } from './entity'
import { normalize } from './text'
import type { SKILL_DEFINITION_KEYS } from './types'
import { type Entity, type Skill, type SkillDefinition, type SkillKind } from './types'

/**
 * Skill library (D-218): skills are independent entities of the campaign,
 * attachable to any character. A character holds a linked copy (`sourceId`)
 * so every rule keeps reading `entity.skills`; the copies are re-synced
 * whenever the definition changes.
 */

export type SkillLibrary = Record<string, SkillDefinition>

export function newSkillDefinition(
  kind: SkillKind,
  campaignId: string,
  now = Date.now(),
): SkillDefinition {
  return {
    ...definitionFields(emptySkill(kind)),
    id: newId(),
    campaignId,
    createdAt: now,
    updatedAt: now,
  }
}

function definitionFields(skill: Pick<Skill, (typeof SKILL_DEFINITION_KEYS)[number]>) {
  return {
    name: skill.name,
    kind: skill.kind,
    stat: skill.stat,
    description: skill.description,
    modifiers: skill.modifiers,
    usesMax: skill.usesMax,
    cooldown: skill.cooldown,
    effect: skill.effect,
  }
}

export function definitionFromSkill(
  skill: Skill,
  campaignId: string,
  id: string = newId(),
  now = Date.now(),
): SkillDefinition {
  return { ...definitionFields(skill), id, campaignId, createdAt: now, updatedAt: now }
}

/** A fresh copy of a definition for one character (full uses, no cooldown). */
export function skillFromDefinition(def: SkillDefinition): Skill {
  return {
    ...emptySkill(def.kind),
    ...definitionFields(def),
    id: newId(),
    sourceId: def.id,
    usesLeft: def.usesMax,
    cooldownLeft: 0,
  }
}

/** Updates a character's copy from its definition, keeping the per-character state. */
export function syncSkill(skill: Skill, def: SkillDefinition): Skill {
  const usesLeft =
    def.usesMax === null
      ? null
      : skill.usesMax === null || skill.usesLeft === null
        ? def.usesMax
        : Math.min(skill.usesLeft, def.usesMax)
  return {
    ...skill,
    ...definitionFields(def),
    usesLeft,
    cooldownLeft: Math.min(skill.cooldownLeft, def.cooldown),
  }
}

export function hasSkill(entity: Pick<Entity, 'skills'>, defId: string): boolean {
  return entity.skills.some((s) => s.sourceId === defId)
}

export function attachSkill<E extends Entity>(entity: E, def: SkillDefinition): E {
  if (hasSkill(entity, def.id)) return entity
  return { ...entity, skills: [...entity.skills, skillFromDefinition(def)] }
}

export function detachSkill<E extends Entity>(entity: E, skillId: string): E {
  return { ...entity, skills: entity.skills.filter((s) => s.id !== skillId) }
}

/** Re-syncs every copy of the given definitions; returns the same entity if nothing changed. */
export function syncEntitySkills<E extends Entity>(entity: E, library: SkillLibrary): E {
  let changed = false
  const skills = entity.skills.map((s) => {
    const def = s.sourceId ? library[s.sourceId] : undefined
    if (!def) return s
    const next = syncSkill(s, def)
    if (JSON.stringify(next) !== JSON.stringify(s)) changed = true
    return next
  })
  return changed ? { ...entity, skills } : entity
}

/** Characters holding a copy of the definition. */
export function holdersOf(entities: readonly Entity[], defId: string): Entity[] {
  return entities.filter((e) => hasSkill(e, defId))
}

const signature = (s: Pick<Skill, 'name' | 'kind' | 'description'>) =>
  `${s.kind}|${normalize(s.name)}|${normalize(s.description)}`

/**
 * Puts every skill of `entities` into the library: copies whose definition
 * is missing are matched to an identical definition (same kind, name and
 * description) or become a new one. Used when loading older saves, importing
 * a Discord sheet or adding enemies from a template made in another campaign.
 * Returns the definitions to add and the entities with linked skills.
 */
export function adoptSkills<E extends Entity>(
  entities: readonly E[],
  library: SkillLibrary,
  campaignId: string,
  now = Date.now(),
): { added: SkillDefinition[]; entities: E[] } {
  const known = new Map(Object.values(library).map((d) => [signature(d), d]))
  const byId = new Map(Object.values(library).map((d) => [d.id, d]))
  const added: SkillDefinition[] = []
  const result = entities.map((entity) => {
    let changed = false
    const skills = entity.skills.map((skill) => {
      if (skill.sourceId && byId.has(skill.sourceId)) return skill
      let def = known.get(signature(skill))
      if (!def) {
        // Keep the original id when possible (same template seen in several campaigns).
        const id = skill.sourceId && !byId.has(skill.sourceId) ? skill.sourceId : newId()
        def = definitionFromSkill(skill, campaignId, id, now)
        known.set(signature(def), def)
        byId.set(def.id, def)
        added.push(def)
      }
      changed = true
      return { ...skill, sourceId: def.id }
    })
    return changed ? { ...entity, skills } : entity
  })
  return { added, entities: result }
}
