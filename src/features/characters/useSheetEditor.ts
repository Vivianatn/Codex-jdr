import { entityHpMax, entityName, newId, withJournal } from '@/domain/entity'
import type {
  AllyDetails,
  Condition,
  EnemyDetails,
  FamiliarDetails,
  PlayerDetails,
  Entity,
  Identity,
  Item,
  JournalKind,
  Skill,
  StatKey,
  StatModifier,
} from '@/domain/types'
import { useT } from '@/i18n'
import { adjustCurrentForNewMax, clampHp, hpMax, type RulesConfig } from '@/rules'

/** Applies a change to the entity being edited (store, bestiary…), with an undo label. */
export type SheetChange = (recipe: (entity: Entity) => Entity, label: string) => void

type DetailsPatch = Partial<PlayerDetails & EnemyDetails & FamiliarDetails & AllyDetails>

/**
 * Every edit a sheet can make, each producing one undoable change and,
 * where it matters for the story, a journal entry.
 */
export function useSheetEditor(entity: Entity, rules: RulesConfig, change: SheetChange) {
  const t = useT()
  const label = t.history.edit(entityName(entity))
  const edit = (recipe: (e: Entity) => Entity, journal?: [JournalKind, string]) =>
    change((e) => {
      const next = recipe(e)
      return journal ? withJournal(next, journal[0], journal[1]) : next
    }, label)

  return {
    identity<K extends keyof Identity>(field: K, value: Identity[K]) {
      if (entity.identity[field] === value) return
      edit((e) => ({ ...e, identity: { ...e.identity, [field]: value } }))
    },

    level(level: number) {
      if (level === entity.level || level < 1) return
      edit(
        (e) => {
          const oldMax = entityHpMax(e, rules)
          const newMax = hpMax(e.hp.roll, level, rules)
          const current = adjustCurrentForNewMax(e.hp.current, oldMax, newMax)
          return { ...e, level, hp: { ...e.hp, current } }
        },
        ['level', t.journal.level(entity.level, level)],
      )
    },

    hpRoll(roll: number) {
      if (roll === entity.hp.roll) return
      edit((e) => {
        const oldMax = entityHpMax(e, rules)
        const newMax = hpMax(roll, e.level, rules)
        return {
          ...e,
          hp: { ...e.hp, roll, current: adjustCurrentForNewMax(e.hp.current, oldMax, newMax) },
        }
      })
    },

    hpCurrent(current: number) {
      const next = clampHp(current, entityHpMax(entity, rules))
      if (next === entity.hp.current) return
      edit(
        (e) => ({ ...e, hp: { ...e.hp, current: next } }),
        ['hp', t.journal.hp(entity.hp.current, next)],
      )
    },

    hpTemp(temp: number) {
      const next = Math.max(0, Math.round(temp))
      if (next === entity.hp.temp) return
      edit((e) => ({ ...e, hp: { ...e.hp, temp: next } }), ['hp', t.journal.temp(next)])
    },

    stat(stat: StatKey, value: number) {
      if (value === entity.stats[stat]) return
      edit(
        (e) => ({ ...e, stats: { ...e.stats, [stat]: value } }),
        ['stats', t.journal.stat(t.stats.names[stat], entity.stats[stat], value)],
      )
    },

    addModifier(modifier: Omit<StatModifier, 'id'>) {
      edit((e) => ({ ...e, modifiers: [...e.modifiers, { ...modifier, id: newId() }] }))
    },

    removeModifier(id: string) {
      edit((e) => ({ ...e, modifiers: e.modifiers.filter((m) => m.id !== id) }))
    },

    saveSkill(skill: Skill) {
      const exists = entity.skills.some((s) => s.id === skill.id)
      edit(
        (e) => ({
          ...e,
          skills: exists
            ? e.skills.map((s) => (s.id === skill.id ? skill : s))
            : [...e.skills, skill],
        }),
        exists ? undefined : ['skill', t.journal.skillAdded(skill.name)],
      )
    },

    toggleSkill(id: string) {
      edit((e) => ({
        ...e,
        skills: e.skills.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
      }))
    },

    removeSkill(skill: Skill) {
      edit(
        (e) => ({ ...e, skills: e.skills.filter((s) => s.id !== skill.id) }),
        ['skill', t.journal.skillRemoved(skill.name)],
      )
    },

    addCondition(condition: Omit<Condition, 'id'>) {
      edit(
        (e) => ({ ...e, conditions: [...e.conditions, { ...condition, id: newId() }] }),
        ['condition', t.journal.conditionAdded(condition.name)],
      )
    },

    updateCondition(condition: Condition) {
      edit((e) => ({
        ...e,
        conditions: e.conditions.map((c) => (c.id === condition.id ? condition : c)),
      }))
    },

    removeCondition(condition: Condition) {
      edit(
        (e) => ({ ...e, conditions: e.conditions.filter((c) => c.id !== condition.id) }),
        ['condition', t.journal.conditionRemoved(condition.name)],
      )
    },

    addItem(item: Omit<Item, 'id'>) {
      edit(
        (e) => ({ ...e, inventory: [...e.inventory, { ...item, id: newId() }] }),
        ['item', t.journal.itemAdded(item.name, item.quantity)],
      )
    },

    updateItem(item: Item) {
      edit((e) => ({ ...e, inventory: e.inventory.map((i) => (i.id === item.id ? item : i)) }))
    },

    removeItem(item: Item) {
      edit(
        (e) => ({ ...e, inventory: e.inventory.filter((i) => i.id !== item.id) }),
        ['item', t.journal.itemRemoved(item.name)],
      )
    },

    details(patch: DetailsPatch) {
      edit((e) => ({ ...e, details: { ...e.details, ...patch } }) as Entity)
    },
  }
}

export type SheetEditor = ReturnType<typeof useSheetEditor>
