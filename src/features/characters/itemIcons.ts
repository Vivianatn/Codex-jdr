import {
  Apple,
  Axe,
  Bomb,
  Bone,
  Book,
  CircleDot,
  Coins,
  Compass,
  Crosshair,
  Crown,
  Drumstick,
  Droplet,
  Feather,
  Flame,
  FlaskConical,
  Gem,
  Gift,
  Hammer,
  HardHat,
  Hourglass,
  Key,
  Lamp,
  Leaf,
  Map,
  Package,
  Pill,
  Scroll,
  Shield,
  Shirt,
  Skull,
  Sparkles,
  Star,
  Sword,
  Swords,
  Wand,
  Wine,
  type LucideIcon,
} from 'lucide-react'
import type { ItemIcon, ItemType, Rarity } from '@/domain/types'

export const ITEM_ICON_COMPONENTS: Record<ItemIcon, LucideIcon> = {
  sword: Sword,
  swords: Swords,
  axe: Axe,
  hammer: Hammer,
  wand: Wand,
  bow: Crosshair,
  shield: Shield,
  shirt: Shirt,
  helmet: HardHat,
  crown: Crown,
  gem: Gem,
  ring: CircleDot,
  potion: FlaskConical,
  pill: Pill,
  apple: Apple,
  meat: Drumstick,
  wine: Wine,
  key: Key,
  scroll: Scroll,
  book: Book,
  map: Map,
  compass: Compass,
  coins: Coins,
  package: Package,
  gift: Gift,
  feather: Feather,
  bone: Bone,
  skull: Skull,
  flame: Flame,
  droplet: Droplet,
  leaf: Leaf,
  sparkles: Sparkles,
  star: Star,
  lamp: Lamp,
  hourglass: Hourglass,
  bomb: Bomb,
}

const BY_TYPE: Record<ItemType, ItemIcon> = {
  weapon: 'sword',
  armor: 'shield',
  accessory: 'ring',
  consumable: 'potion',
  misc: 'package',
}

/** Key of the item's chosen icon, or one matching its type. */
export function itemIconKey(item: { icon: ItemIcon | null; type: ItemType }): ItemIcon {
  return item.icon ?? BY_TYPE[item.type]
}

/** Game-like frame per rarity: border colour, inner tint and a glow for the best ones. */
export const RARITY_FRAME: Record<Rarity, { frame: string; tint: string; text: string }> = {
  common: {
    frame: 'border-rarity-common',
    tint: 'bg-rarity-common-soft',
    text: 'text-rarity-common-text',
  },
  uncommon: {
    frame: 'border-rarity-uncommon',
    tint: 'bg-rarity-uncommon-soft',
    text: 'text-rarity-uncommon-text',
  },
  rare: { frame: 'border-rarity-rare', tint: 'bg-rarity-rare-soft', text: 'text-rarity-rare-text' },
  // « Épique » in the spec, « très rare » colours in the DA (§8.19): soft glow.
  epic: {
    frame:
      'border-rarity-very-rare shadow-[0_0_10px_color-mix(in_srgb,var(--codex-rarity-very-rare)_28%,transparent)]',
    tint: 'bg-rarity-very-rare-soft',
    text: 'text-rarity-very-rare-text',
  },
  legendary: {
    frame:
      'border-rarity-legendary shadow-[0_0_0_1px_var(--codex-gold),0_0_14px_var(--codex-gold-glow)]',
    tint: 'bg-rarity-legendary-soft',
    text: 'text-rarity-legendary-text',
  },
}
