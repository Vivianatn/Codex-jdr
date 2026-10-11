/** Core game data model. Pure types: no React, no storage. */

export const ENTITY_KINDS = ['player', 'enemy', 'familiar', 'ally'] as const
export type EntityKind = (typeof ENTITY_KINDS)[number]

/** Order matches the Discord sheet. */
export const STAT_KEYS = [
  'strength',
  'constitution',
  'dexterity',
  'intelligence',
  'charisma',
  'wisdom',
  'luck',
] as const
export type StatKey = (typeof STAT_KEYS)[number]
export type Stats = Record<StatKey, number>

export interface StatModifier {
  id: string
  stat: StatKey
  value: number
  /** Where it comes from, shown next to the value ("Bouclier", "Béni"…). */
  label: string
}

/** `class` is the class passive ("caractéristique physique"), distinct from regular passives. */
export type SkillKind = 'active' | 'passive' | 'class'

export type SkillEffectKind = 'none' | 'damage' | 'heal' | 'condition'

export interface SkillEffect {
  kind: SkillEffectKind
  /** Dice expression for damage / heal ("2d6+1"). */
  expression: string
  /** Condition applied to the targets (library id) when kind = condition. */
  conditionId: string | null
}

/**
 * A skill as attached to a character: a copy of a library definition
 * (`sourceId`, see SkillDefinition) plus this character's own state
 * (enabled, uses left, cooldown left). Definition fields are kept in sync
 * with the library.
 */
export interface Skill {
  id: string
  /** Library definition this skill comes from; null until adopted into the library. */
  sourceId: string | null
  name: string
  kind: SkillKind
  stat: StatKey | null
  description: string
  /** Passives and class passives can be switched off to test the sheet without them. */
  enabled: boolean
  modifiers: StatModifier[]
  /** Uses before a long rest; null = unlimited. */
  usesMax: number | null
  usesLeft: number | null
  /** Turns to wait after use (0 = none) and turns still to wait. */
  cooldown: number
  cooldownLeft: number
  effect: SkillEffect
}

/** Fields owned by the library definition (the rest is per character). */
export const SKILL_DEFINITION_KEYS = [
  'name',
  'kind',
  'stat',
  'description',
  'modifiers',
  'usesMax',
  'cooldown',
  'effect',
] as const satisfies readonly (keyof Skill)[]

/** An independent skill of the campaign library, attachable to any character. */
export type SkillDefinition = Pick<Skill, (typeof SKILL_DEFINITION_KEYS)[number]> & {
  id: string
  campaignId: string
  createdAt: number
  updatedAt: number
}

/** Curated icon keys, mapped to Lucide icons in the UI. */
export const CONDITION_ICONS = [
  'skull',
  'flame',
  'zap',
  'eye-off',
  'heart',
  'ghost',
  'eye',
  'arrow-down',
  'droplet',
  'sparkles',
  'brain',
  'snail',
  'shield',
  'snowflake',
  'moon',
  'star',
] as const
export type ConditionIcon = (typeof CONDITION_ICONS)[number]

export const CONDITION_COLORS = [
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'violet',
  'pink',
  'gray',
] as const
export type ConditionColor = (typeof CONDITION_COLORS)[number]

/** What a condition does, shared by the library entry and the applied condition. */
export interface ConditionEffects {
  icon: ConditionIcon
  color: ConditionColor
  modifiers: StatModifier[]
  /** Rolled at the start of each turn of the affected character. */
  perTurn: { kind: 'damage' | 'heal'; expression: string } | null
  /** Characteristic tested to break free, or null. */
  save: StatKey | null
  /** "Concentration": taking damage prompts a Constitution check. */
  concentration: boolean
}

/** A condition in the library (built-in or created by the GM). */
export interface ConditionTemplate extends ConditionEffects {
  id: string
  name: string
  description: string
  /** Default duration in turns; null = until removed. */
  duration: number | null
}

/** A condition applied to a character. */
export interface Condition extends ConditionEffects {
  id: string
  name: string
  note: string
  /** Library entry it comes from, if any. */
  templateId: string | null
  /** Turns left; null = until removed. */
  remaining: number | null
}

export const ITEM_TYPES = ['weapon', 'armor', 'accessory', 'consumable', 'misc'] as const
export type ItemType = (typeof ITEM_TYPES)[number]

export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const
export type Rarity = (typeof RARITIES)[number]

/** An item of a campaign's item library (D-224). */
export type LibraryItem = Item & { campaignId: string }

/** Icon keys for items (mapped to drawings in the UI). */
export const ITEM_ICONS = [
  'sword',
  'swords',
  'axe',
  'hammer',
  'wand',
  'bow',
  'shield',
  'shirt',
  'helmet',
  'crown',
  'gem',
  'ring',
  'potion',
  'pill',
  'apple',
  'meat',
  'wine',
  'key',
  'scroll',
  'book',
  'map',
  'compass',
  'coins',
  'package',
  'gift',
  'feather',
  'bone',
  'skull',
  'flame',
  'droplet',
  'leaf',
  'sparkles',
  'star',
  'lamp',
  'hourglass',
  'bomb',
] as const
export type ItemIcon = (typeof ITEM_ICONS)[number]

export const EQUIP_SLOTS = ['mainHand', 'offHand', 'armor', 'accessory1', 'accessory2'] as const
export type EquipSlot = (typeof EQUIP_SLOTS)[number]

export interface Item {
  id: string
  name: string
  /** Icon shown in the bag; null = the type's default. */
  icon: ItemIcon | null
  /** Custom picture (data URL), shown instead of the icon. */
  image: string | null
  quantity: number
  description: string
  type: ItemType
  rarity: Rarity
  /** Weight of one unit, in kg. */
  weight: number
  /** Price of one unit, in the smallest coin. */
  value: number
  /** Equipment slot it occupies, or null when carried. */
  slot: EquipSlot | null
  /** Applied while equipped. */
  modifiers: StatModifier[]
  /** Defense bonus while equipped (armour, shield). */
  defense: number
  /** Weapon damage dice ("1d8"), empty if not a weapon. */
  damage: string
  /** Consumable effect of "Utiliser" (one unit). */
  use: { kind: 'heal' | 'damage'; expression: string } | null
  /** Hidden property revealed by an Intelligence check. */
  hidden: { text: string; difficulty: number; identified: boolean } | null
}

export type JournalKind =
  | 'created'
  | 'imported'
  | 'level'
  | 'hp'
  | 'stats'
  | 'skill'
  | 'condition'
  | 'item'
  | 'edit'
  | 'roll'
  | 'rest'
  | 'money'

export interface JournalEntry {
  id: string
  at: number
  kind: JournalKind
  text: string
}

export interface Identity {
  discordName: string
  /** The character's name. */
  pseudo: string
  className: string
  weaponType: string
  origin: string
  description: string
  mindset: string
  /** Square portrait as a data URL (already cropped), or null. */
  portrait: string | null
  /** Full-body image shown in play and on the inventory (data URL), or null. */
  body: string | null
}

export interface HitPoints {
  /** The pre-rolled 1d20 of the level-1 formula `10 + 1d20 + Nv`. Max HP is derived from it. */
  roll: number
  /** Max HP given directly instead of the d20 (null = use the d20), and its level. */
  fixedMax: number | null
  fixedLevel: number
  current: number
  temp: number
}

export const DISPOSITIONS = ['hostile', 'wary', 'neutral', 'friendly', 'devoted'] as const
export type Disposition = (typeof DISPOSITIONS)[number]

export interface PlayerDetails {
  xp: number
}
export interface EnemyDetails {
  /** Bestiary template it was created from. */
  templateId: string | null
  /** "Gobelin 3" → 3. */
  copyNumber: number | null
  xpReward: number
  loot: string
}
export interface FamiliarDetails {
  ownerId: string | null
  /** 0–100 */
  loyalty: number
  actsOnOwnerTurn: boolean
}
export interface AllyDetails {
  disposition: Disposition
  /** Empty = controlled by the GM, otherwise the player's name. */
  controlledBy: string
}

interface EntityBase {
  id: string
  /** Owning campaign; empty string for bestiary templates (shared library). */
  campaignId: string
  identity: Identity
  level: number
  hp: HitPoints
  /** Base values of the characteristics (pre-rolled). */
  stats: Stats
  /** Manual modifiers (equipment, blessings…). Skill modifiers live on the skills. */
  modifiers: StatModifier[]
  skills: Skill[]
  conditions: Condition[]
  inventory: Item[]
  /** Money, in the smallest coin (see rules.currency). */
  purse: number
  /** Exhaustion level (0 = rested). */
  exhaustion: number
  /** Luck points spent since the last long rest. */
  luckSpent: number
  journal: JournalEntry[]
  createdAt: number
  updatedAt: number
}

export type Entity =
  | (EntityBase & { kind: 'player'; details: PlayerDetails })
  | (EntityBase & { kind: 'enemy'; details: EnemyDetails })
  | (EntityBase & { kind: 'familiar'; details: FamiliarDetails })
  | (EntityBase & { kind: 'ally'; details: AllyDetails })

export interface DetailsByKind {
  player: PlayerDetails
  enemy: EnemyDetails
  familiar: FamiliarDetails
  ally: AllyDetails
}

export type EntityOfKind<K extends EntityKind> = Extract<Entity, { kind: K }>
export type EnemyTemplate = EntityOfKind<'enemy'>
