import { effectiveStat, type RulesConfig } from '@/rules'
import type { EquipSlot, Entity, Item, ItemType } from './types'

export function newItem(partial: Partial<Item> & { name: string }): Item {
  return {
    id: crypto.randomUUID(),
    quantity: 1,
    description: '',
    type: 'misc',
    rarity: 'common',
    weight: 0,
    value: 0,
    slot: null,
    modifiers: [],
    defense: 0,
    damage: '',
    use: null,
    hidden: null,
    ...partial,
  }
}

/** Fills fields missing from items saved before phase 2. */
export function normalizeItem(raw: Partial<Item> & { id: string; name: string }): Item {
  const defined = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== undefined))
  return { ...newItem({ name: raw.name }), ...defined } as Item
}

/** Slots an item type can go in (first = default). */
export function slotsFor(type: ItemType): EquipSlot[] {
  switch (type) {
    case 'weapon':
      return ['mainHand', 'offHand']
    case 'armor':
      return ['armor', 'offHand']
    case 'accessory':
      return ['accessory1', 'accessory2']
    default:
      return []
  }
}

export function equippedItems(entity: Pick<Entity, 'inventory'>): Item[] {
  return entity.inventory.filter((i) => i.slot !== null)
}

/** Equips an item in a slot, unequipping whatever was there. */
export function equip<E extends Entity>(entity: E, itemId: string, slot: EquipSlot): E {
  return {
    ...entity,
    inventory: entity.inventory.map((i) =>
      i.id === itemId ? { ...i, slot } : i.slot === slot ? { ...i, slot: null } : i,
    ),
  }
}

export function unequip<E extends Entity>(entity: E, itemId: string): E {
  return {
    ...entity,
    inventory: entity.inventory.map((i) => (i.id === itemId ? { ...i, slot: null } : i)),
  }
}

export function carriedWeight(entity: Pick<Entity, 'inventory'>): number {
  const total = entity.inventory.reduce((sum, i) => sum + i.weight * i.quantity, 0)
  return Math.round(total * 100) / 100
}

/** Strength without the overload penalty (which only affects Dexterity). */
export function carryCapacity(entity: Entity, rules: RulesConfig): number {
  const strength = effectiveStat(
    entity.stats.strength,
    strengthModifiers(entity).map((m) => m.value),
  )
  return strength * rules.carry.kgPerStrength
}

function strengthModifiers(entity: Entity) {
  const fromSkills = entity.skills
    .filter((s) => s.enabled && s.kind !== 'active')
    .flatMap((s) => s.modifiers)
  return [
    ...entity.modifiers,
    ...fromSkills,
    ...equippedItems(entity).flatMap((i) => i.modifiers),
    ...entity.conditions.flatMap((c) => c.modifiers),
  ].filter((m) => m.stat === 'strength')
}

/** Defense from the GM's formula, or null when the rule is off. */
export function defenseValue(entity: Entity, rules: RulesConfig, dexterity: number): number | null {
  const { fromDexterity, fromEquipment } = rules.defense
  if (!fromDexterity && !fromEquipment) return null
  return (
    (fromDexterity ? dexterity : 0) +
    (fromEquipment ? equippedItems(entity).reduce((sum, i) => sum + i.defense, 0) : 0)
  )
}

export function hasCarryCapacity(rules: RulesConfig): boolean {
  return rules.carry.kgPerStrength > 0
}

export function isOverloaded(entity: Entity, rules: RulesConfig): boolean {
  if (!hasCarryCapacity(rules)) return false
  return carriedWeight(entity) > carryCapacity(entity, rules)
}

/** The weapon used for attacks: main hand first, then off hand. */
export function equippedWeapon(entity: Pick<Entity, 'inventory'>): Item | null {
  const weapons = entity.inventory.filter((i) => i.slot && i.damage.trim())
  return weapons.find((i) => i.slot === 'mainHand') ?? weapons[0] ?? null
}

/** Removes `quantity` units (the item disappears at 0). */
export function removeUnits<E extends Entity>(entity: E, itemId: string, quantity = 1): E {
  return {
    ...entity,
    inventory: entity.inventory.flatMap((i) => {
      if (i.id !== itemId) return [i]
      const left = i.quantity - quantity
      return left > 0 ? [{ ...i, quantity: left }] : []
    }),
  }
}

/**
 * Moves units of an item from one character to another. Equipment is
 * unequipped; identical items already carried by the receiver are stacked.
 */
export function transferItem<A extends Entity, B extends Entity>(
  from: A,
  to: B,
  itemId: string,
  quantity: number,
): [A, B] | null {
  const item = from.inventory.find((i) => i.id === itemId)
  if (!item || quantity < 1) return null
  const moved = Math.min(quantity, item.quantity)
  const stack = to.inventory.find(
    (i) =>
      i.slot === null &&
      i.name === item.name &&
      i.type === item.type &&
      i.rarity === item.rarity &&
      !i.hidden &&
      !item.hidden,
  )
  const inventory = stack
    ? to.inventory.map((i) => (i.id === stack.id ? { ...i, quantity: i.quantity + moved } : i))
    : [...to.inventory, { ...item, id: crypto.randomUUID(), quantity: moved, slot: null }]
  return [removeUnits(from, itemId, moved), { ...to, inventory }]
}

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

/** 342 → "3 po 4 pa 2 pc" (zero coins hidden; "0 pc" when empty). */
export function formatPurse(amount: number, currency: RulesConfig['currency']): string {
  if (currency.length === 0) return String(Math.round(amount))
  const coins = [...currency].sort((a, b) => b.value - a.value)
  let rest = Math.max(0, Math.round(amount))
  const parts: string[] = []
  for (const coin of coins) {
    const n = Math.floor(rest / coin.value)
    rest -= n * coin.value
    if (n > 0) parts.push(`${n} ${coin.short}`)
  }
  return parts.length ? parts.join(' ') : `0 ${coins.at(-1)?.short ?? ''}`.trim()
}

/**
 * Parses a tolerant money change: "+3 po", "-50pc", "2 po 5 pa", "-1,5 po".
 * A bare number uses the smallest coin. Returns the delta in the smallest coin, or null.
 */
export function parseMoney(text: string, currency: RulesConfig['currency']): number | null {
  const cleaned = text.trim().toLowerCase().replace(',', '.')
  if (!cleaned) return null
  const sign = cleaned.startsWith('-') ? -1 : 1
  const body = cleaned.replace(/^[+-]\s*/, '')
  const smallest = [...currency].sort((a, b) => a.value - b.value)[0] ?? {
    id: '',
    name: '',
    short: '',
    value: 1,
  }
  const pattern = /(\d+(?:\.\d+)?)\s*([a-zà-ÿ]*)/g
  let total = 0
  let matched = false
  let consumed = ''
  for (const m of body.matchAll(pattern)) {
    if (!m[0].trim()) continue
    const unit = m[2] ?? ''
    const coin = unit
      ? currency.find(
          (c) => c.short.toLowerCase() === unit || c.name.toLowerCase() === unit || c.id === unit,
        )
      : smallest
    if (!coin) return null
    total += Number(m[1]) * coin.value
    matched = true
    consumed += m[0]
  }
  if (!matched || consumed.replace(/\s/g, '') !== body.replace(/\s/g, '')) return null
  return sign * Math.round(total)
}
