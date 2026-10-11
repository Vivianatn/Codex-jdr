import { entityHpMax, entityName, newId, withJournal } from '@/domain/entity'
import { equip, unequip } from '@/domain/items'
import type {
  AllyDetails,
  Condition,
  EquipSlot,
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
import { toast } from 'sonner'
import {
  adjustCurrentForNewMax,
  clampHp,
  hpMaxAt,
  skillMilestonesReached,
  type RulesConfig,
} from '@/rules'

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
      const milestones = skillMilestonesReached(entity.level, level, rules)
      edit(
        (e) => {
          const oldMax = entityHpMax(e, rules)
          const newMax = hpMaxAt(e.hp, level, rules)
          const current = adjustCurrentForNewMax(e.hp.current, oldMax, newMax)
          return milestones.reduce(
            (next, m) => withJournal(next, 'skill', t.journal.skillMilestone(m)),
            { ...e, level, hp: { ...e.hp, current } },
          )
        },
        ['level', t.journal.level(entity.level, level)],
      )
      // A reminder only: the GM decides whether and which skill to add.
      for (const m of milestones)
        toast.info(t.skills.milestoneToast(entityName(entity), m), { duration: 10_000 })
    },

    /** Max HP from the d20 (switches back from a given max if needed). */
    hpRoll(roll: number) {
      if (roll === entity.hp.roll && entity.hp.fixedMax === null) return
      edit((e) => {
        const hp = { ...e.hp, roll, fixedMax: null }
        const current = adjustCurrentForNewMax(
          e.hp.current,
          entityHpMax(e, rules),
          hpMaxAt(hp, e.level, rules),
        )
        return { ...e, hp: { ...hp, current } }
      })
    },

    /** Max HP given directly at the current level, as for a character made before Codex. */
    hpFixedMax(max: number) {
      const value = Math.max(1, Math.round(max))
      if (entity.hp.fixedMax !== null && entityHpMax(entity, rules) === value) return
      edit((e) => {
        const hp = { ...e.hp, fixedMax: value, fixedLevel: e.level }
        const current = adjustCurrentForNewMax(e.hp.current, entityHpMax(e, rules), value)
        return { ...e, hp: { ...hp, current } }
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

    equip(itemId: string, slot: EquipSlot) {
      edit((e) => equip(e, itemId, slot))
    },

    unequip(itemId: string) {
      edit((e) => unequip(e, itemId))
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
