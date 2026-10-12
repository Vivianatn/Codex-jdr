import { gameIcon, type IconComponent } from '@/components/iconFactory'
import type { Messages } from '@/i18n/locales/fr'
import type { PrepSection } from '@/stores/uiStore'

/** Engraved game glyphs for the preparation sections (game-icons.net, D-250). */
export const SECTION_ICONS: Record<PrepSection, IconComponent> = {
  dashboard: gameIcon('castle'),
  players: gameIcon('two-shadows'),
  bestiary: gameIcon('dragon-head'),
  allies: gameIcon('shaking-hands'),
  skills: gameIcon('spell-book'),
  items: gameIcon('knapsack'),
  maps: gameIcon('treasure-map'),
  sessions: gameIcon('scroll-unfurled'),
  notes: gameIcon('quill-ink'),
  conditions: gameIcon('magic-swirl'),
  rules: gameIcon('scales'),
}

export function sectionLabel(t: Messages, section: PrepSection): string {
  return t.nav[section]
}
