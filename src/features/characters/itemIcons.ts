import { gameIcon, type IconComponent } from '@/components/iconFactory'
import type { ItemIcon, ItemType, Rarity } from '@/domain/types'

/** Engraved game glyphs (game-icons.net, D-250). */
export const ITEM_ICON_COMPONENTS: Record<ItemIcon, IconComponent> = {
  sword: gameIcon('broadsword'),
  swords: gameIcon('crossed-swords'),
  axe: gameIcon('battle-axe'),
  hammer: gameIcon('warhammer'),
  wand: gameIcon('fairy-wand'),
  bow: gameIcon('pocket-bow'),
  shield: gameIcon('round-shield'),
  shirt: gameIcon('leather-armor'),
  helmet: gameIcon('visored-helm'),
  crown: gameIcon('crown'),
  gem: gameIcon('emerald'),
  ring: gameIcon('ring'),
  potion: gameIcon('potion-ball'),
  pill: gameIcon('pill'),
  apple: gameIcon('shiny-apple'),
  meat: gameIcon('meat'),
  wine: gameIcon('wine-bottle'),
  key: gameIcon('key'),
  scroll: gameIcon('scroll-unfurled'),
  book: gameIcon('book-cover'),
  map: gameIcon('treasure-map'),
  compass: gameIcon('compass'),
  coins: gameIcon('two-coins'),
  package: gameIcon('wooden-crate'),
  gift: gameIcon('present'),
  feather: gameIcon('feather'),
  bone: gameIcon('crossed-bones'),
  skull: gameIcon('death-skull'),
  flame: gameIcon('flame'),
  droplet: gameIcon('drop'),
  leaf: gameIcon('oak-leaf'),
  sparkles: gameIcon('sparkles'),
  star: gameIcon('star-formation'),
  lamp: gameIcon('lantern-flame'),
  hourglass: gameIcon('hourglass'),
  bomb: gameIcon('unlit-bomb'),
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
