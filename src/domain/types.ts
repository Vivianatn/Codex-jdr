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

export interface Skill {
  id: string
  name: string
  kind: SkillKind
  stat: StatKey | null
  description: string
  /** Passives and class passives can be switched off to test the sheet without them. */
  enabled: boolean
  modifiers: StatModifier[]
}

export interface Condition {
  id: string
  name: string
  note: string
}

export interface Item {
  id: string
  name: string
  quantity: number
  description: string
}

export type JournalKind =
  'created' | 'imported' | 'level' | 'hp' | 'stats' | 'skill' | 'condition' | 'item' | 'edit'

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
}

export interface HitPoints {
  /** The pre-rolled 1d20 of the level-1 formula `10 + 1d20 + Nv`. Max HP is derived from it. */
  roll: number
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
