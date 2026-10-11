import { roll, type Rng } from '@/dice'
import type { RulesConfig } from '@/rules'
import { applyHpDelta } from '@/rules'
import type { Condition, ConditionTemplate, Entity } from './types'

/**
 * Starter condition list (SPEC §4.10), copied into every new campaign where
 * the GM can rename, change or delete each entry. Names, icons and colours
 * only: no duration and no numeric effect — the GM decides those (D-217).
 */
const STARTERS: Pick<ConditionTemplate, 'id' | 'name' | 'icon' | 'color' | 'description'>[] = [
  {
    id: 'poisoned',
    name: 'Empoisonné',
    icon: 'skull',
    color: 'green',
    description: 'Le poison ronge le corps.',
  },
  {
    id: 'burning',
    name: 'En feu',
    icon: 'flame',
    color: 'orange',
    description: 'Les flammes le dévorent.',
  },
  {
    id: 'bleeding',
    name: 'Saignement',
    icon: 'droplet',
    color: 'red',
    description: 'Une blessure qui ne se referme pas.',
  },
  {
    id: 'stunned',
    name: 'Étourdi',
    icon: 'zap',
    color: 'yellow',
    description: 'Sonné, il peine à agir.',
  },
  {
    id: 'blinded',
    name: 'Aveuglé',
    icon: 'eye-off',
    color: 'gray',
    description: 'Ne voit plus rien.',
  },
  {
    id: 'charmed',
    name: 'Charmé',
    icon: 'heart',
    color: 'pink',
    description: 'Considère celui qui l’a charmé comme un ami.',
  },
  {
    id: 'frightened',
    name: 'Effrayé',
    icon: 'ghost',
    color: 'violet',
    description: 'La peur le paralyse.',
  },
  {
    id: 'invisible',
    name: 'Invisible',
    icon: 'eye',
    color: 'blue',
    description: 'Impossible à voir sans magie.',
  },
  { id: 'prone', name: 'Au sol', icon: 'arrow-down', color: 'gray', description: 'Renversé.' },
  {
    id: 'slowed',
    name: 'Ralenti',
    icon: 'snail',
    color: 'blue',
    description: 'Ses mouvements sont entravés.',
  },
  {
    id: 'frozen',
    name: 'Gelé',
    icon: 'snowflake',
    color: 'blue',
    description: 'Le froid engourdit ses membres.',
  },
  {
    id: 'blessed',
    name: 'Béni',
    icon: 'sparkles',
    color: 'yellow',
    description: 'Une faveur divine guide ses gestes.',
  },
  {
    id: 'concentration',
    name: 'Concentration',
    icon: 'brain',
    color: 'violet',
    description: 'Maintient un sort ou une capacité.',
  },
]

export function starterConditions(): ConditionTemplate[] {
  return STARTERS.map((c) => ({
    ...c,
    duration: null,
    modifiers: [],
    perTurn: null,
    save: null,
    concentration: false,
  }))
}

/** The campaign's condition library (the GM's list, starters included). */
export function allConditionTemplates(library: readonly ConditionTemplate[]): ConditionTemplate[] {
  return [...library]
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
