import {
  CalendarDays,
  Flag,
  Gem,
  Handshake,
  LayoutDashboard,
  Map,
  NotebookPen,
  Scale,
  Skull,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { Messages } from '@/i18n/locales/fr'
import type { PrepSection } from '@/stores/uiStore'

export const SECTION_ICONS: Record<PrepSection, LucideIcon> = {
  dashboard: LayoutDashboard,
  players: Users,
  bestiary: Skull,
  allies: Handshake,
  items: Gem,
  maps: Map,
  sessions: CalendarDays,
  quests: Flag,
  notes: NotebookPen,
  rules: Scale,
}

export function sectionLabel(t: Messages, section: PrepSection): string {
  return t.nav[section]
}
