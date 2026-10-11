import { roll, type Rng } from '@/dice'
import type { RulesConfig } from '@/rules'
import { applyHpDelta } from '@/rules'
import type { Condition, ConditionEffects, ConditionTemplate, Entity, StatModifier } from './types'

const mod = (stat: StatModifier['stat'], value: number, label: string): StatModifier => ({
  id: `builtin-${label}-${stat}`,
  stat,
  value,
  label,
})

const base: Omit<ConditionEffects, 'icon' | 'color'> = {
  modifiers: [],
  perTurn: null,
  save: null,
  concentration: false,
}

/**
 * Built-in condition library (SPEC §4.10). Read-only; the GM can duplicate and
 * adapt any of them in Préparation › États. Numbers are sensible defaults.
 */
export const BUILTIN_CONDITIONS: ConditionTemplate[] = [
  {
    ...base,
    id: 'poisoned',
    name: 'Empoisonné',
    icon: 'skull',
    color: 'green',
    description: 'Le poison ronge le corps : 1d4 dégâts au début de chaque tour.',
    duration: 3,
    perTurn: { kind: 'damage', expression: '1d4' },
    save: 'constitution',
  },
  {
    ...base,
    id: 'burning',
    name: 'En feu',
    icon: 'flame',
    color: 'orange',
    description: '1d6 dégâts au début de chaque tour, tant que le feu n’est pas éteint.',
    duration: 3,
    perTurn: { kind: 'damage', expression: '1d6' },
    save: 'dexterity',
  },
  {
    ...base,
    id: 'bleeding',
    name: 'Saignement',
    icon: 'droplet',
    color: 'red',
    description: '1d4 dégâts au début de chaque tour.',
    duration: 3,
    perTurn: { kind: 'damage', expression: '1d4' },
    save: 'constitution',
  },
  {
    ...base,
    id: 'stunned',
    name: 'Étourdi',
    icon: 'zap',
    color: 'yellow',
    description: 'Ne peut ni agir ni réagir.',
    duration: 1,
    modifiers: [mod('dexterity', -2, 'Étourdi')],
  },
  {
    ...base,
    id: 'blinded',
    name: 'Aveuglé',
    icon: 'eye-off',
    color: 'gray',
    description: 'Ne voit plus rien.',
    duration: 2,
    modifiers: [mod('dexterity', -2, 'Aveuglé'), mod('wisdom', -2, 'Aveuglé')],
  },
  {
    ...base,
    id: 'charmed',
    name: 'Charmé',
    icon: 'heart',
    color: 'pink',
    description: 'Considère celui qui l’a charmé comme un ami.',
    duration: 3,
    save: 'wisdom',
  },
  {
    ...base,
    id: 'frightened',
    name: 'Effrayé',
    icon: 'ghost',
    color: 'violet',
    description: 'Ne peut pas s’approcher de la source de sa peur.',
    duration: 2,
    modifiers: [mod('charisma', -2, 'Effrayé')],
    save: 'wisdom',
  },
  {
    ...base,
    id: 'invisible',
    name: 'Invisible',
    icon: 'eye',
    color: 'blue',
    description: 'Impossible à voir sans magie.',
    duration: null,
  },
  {
    ...base,
    id: 'prone',
    name: 'Au sol',
    icon: 'arrow-down',
    color: 'gray',
    description: 'Renversé : se relever coûte un déplacement.',
    duration: null,
  },
  {
    ...base,
    id: 'slowed',
    name: 'Ralenti',
    icon: 'snail',
    color: 'blue',
    description: 'Se déplace moitié moins vite.',
    duration: 2,
    modifiers: [mod('dexterity', -2, 'Ralenti')],
  },
  {
    ...base,
    id: 'frozen',
    name: 'Gelé',
    icon: 'snowflake',
    color: 'blue',
    description: 'Le froid engourdit les membres.',
    duration: 2,
    modifiers: [mod('dexterity', -2, 'Gelé'), mod('strength', -1, 'Gelé')],
    save: 'constitution',
  },
  {
    ...base,
    id: 'blessed',
    name: 'Béni',
    icon: 'sparkles',
    color: 'yellow',
    description: 'Une faveur divine guide ses gestes.',
    duration: 3,
    modifiers: [mod('luck', 2, 'Béni')],
  },
  {
    ...base,
    id: 'concentration',
    name: 'Concentration',
    icon: 'brain',
    color: 'violet',
    description:
      'Maintient un sort ou une capacité : subir des dégâts demande un test de Constitution.',
    duration: null,
    concentration: true,
  },
]

export function allConditionTemplates(custom: readonly ConditionTemplate[]): ConditionTemplate[] {
  return [...BUILTIN_CONDITIONS, ...custom]
}

export function isBuiltinCondition(id: string): boolean {
  return BUILTIN_CONDITIONS.some((c) => c.id === id)
}

export function conditionFromTemplate(template: ConditionTemplate, note = ''): Condition {
  return {
    id: crypto.randomUUID(),
    templateId: template.id,
    name: template.name,
    note,
    icon: template.icon,
    color: template.color,
    modifiers: template.modifiers.map((m) => ({ ...m, id: crypto.randomUUID() })),
    perTurn: template.perTurn,
    save: template.save,
    concentration: template.concentration,
    remaining: template.duration,
  }
}

/** A free-text condition without effects (phase-1 sheets, quick notes). */
export function plainCondition(name: string, note = ''): Condition {
  return {
    id: crypto.randomUUID(),
    templateId: null,
    name,
    note,
    icon: 'star',
    color: 'gray',
    modifiers: [],
    perTurn: null,
    save: null,
    concentration: false,
    remaining: null,
  }
}

/** Fills fields missing from conditions saved before phase 2. */
export function normalizeCondition(
  raw: Partial<Condition> & { id: string; name: string },
): Condition {
  return { ...plainCondition(raw.name, raw.note ?? ''), ...raw }
}

export type TurnEvent =
  | {
      type: 'perTurn'
      condition: string
      kind: 'damage' | 'heal'
      amount: number
      breakdown: string
    }
  | { type: 'expired'; condition: string }
  | { type: 'save'; condition: string; stat: NonNullable<Condition['save']> }
  | { type: 'cooldownReady'; skill: string }

/**
 * Start of a character's turn (used by the "Passer un tour" button now and by
 * the combat tracker in phase 3):
 * 1. per-turn effects are rolled and applied (damage eats temporary HP first),
 * 2. a reminder is produced for each condition that allows a save,
 * 3. durations go down by one; conditions reaching 0 expire,
 * 4. skill cooldowns go down by one.
 */
export function startOfTurn<E extends Entity>(
  entity: E,
  rules: RulesConfig,
  maxHp: number,
  rng?: Rng,
): { entity: E; events: TurnEvent[] } {
  const events: TurnEvent[] = []
  let hp = { current: entity.hp.current, temp: entity.hp.temp }

  for (const c of entity.conditions) {
    if (c.perTurn) {
      const r = roll(c.perTurn.expression, { rng, rounding: rules.stats.rounding })
      const amount = Math.max(0, r.total)
      hp = applyHpDelta(hp, c.perTurn.kind === 'damage' ? -amount : amount, maxHp)
      events.push({
        type: 'perTurn',
        condition: c.name,
        kind: c.perTurn.kind,
        amount,
        breakdown: r.breakdown,
      })
    }
    if (c.save) events.push({ type: 'save', condition: c.name, stat: c.save })
  }

  const conditions: Condition[] = []
  for (const c of entity.conditions) {
    if (c.remaining === null) conditions.push(c)
    else if (c.remaining <= 1) events.push({ type: 'expired', condition: c.name })
    else conditions.push({ ...c, remaining: c.remaining - 1 })
  }
  // Saves are only relevant for conditions that are still there.
  const kept = events.filter(
    (e) => e.type !== 'save' || conditions.some((c) => c.name === e.condition),
  )

  const skills = entity.skills.map((s) => {
    if (s.cooldownLeft <= 0) return s
    const left = s.cooldownLeft - 1
    if (left === 0) kept.push({ type: 'cooldownReady', skill: s.name })
    return { ...s, cooldownLeft: left }
  })

  return { entity: { ...entity, hp: { ...entity.hp, ...hp }, conditions, skills }, events: kept }
}

export function emptyConditionTemplate(): ConditionTemplate {
  return {
    id: crypto.randomUUID(),
    name: '',
    description: '',
    icon: 'star',
    color: 'violet',
    duration: null,
    modifiers: [],
    perTurn: null,
    save: null,
    concentration: false,
  }
}
