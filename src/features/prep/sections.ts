import {
  CalendarDays,
  Gem,
  Handshake,
  LayoutDashboard,
  Map,
  NotebookPen,
  Sparkles,
  Scale,
  Skull,
  Users,
  WandSparkles,
  type LucideIcon,
} from 'lucide-react'
import type { Messages } from '@/i18n/locales/fr'
import type { PrepSection } from '@/stores/uiStore'

export const SECTION_ICONS: Record<PrepSection, LucideIcon> = {
  dashboard: LayoutDashboard,
  players: Users,
  bestiary: Skull,
  allies: Handshake,
  skills: WandSparkles,
  items: Gem,
  maps: Map,
  sessions: CalendarDays,
  notes: NotebookPen,
  conditions: Sparkles,
  rules: Scale,
}

export function sectionLabel(t: Messages, section: PrepSection): string {
  return t.nav[section]
}
