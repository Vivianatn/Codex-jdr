import type { StatKey } from '@/domain/types'

/**
 * Static class names (so Tailwind can see them) for each characteristic
 * colour (DA §2): dot / border for interface marks, soft for pill
 * backgrounds, text for coloured text (AA in both themes).
 */
export const STAT_STYLES: Record<
  StatKey,
  { dot: string; border: string; soft: string; text: string; ring: string }
> = {
  strength: {
    dot: 'bg-stat-strength',
    border: 'border-t-stat-strength',
    soft: 'bg-stat-strength-soft',
    text: 'text-stat-strength-text',
    ring: 'hover:shadow-[inset_0_0_0_1px_var(--codex-stat-strength)]',
  },
  constitution: {
    dot: 'bg-stat-constitution',
    border: 'border-t-stat-constitution',
    soft: 'bg-stat-constitution-soft',
    text: 'text-stat-constitution-text',
    ring: 'hover:shadow-[inset_0_0_0_1px_var(--codex-stat-constitution)]',
  },
  dexterity: {
    dot: 'bg-stat-dexterity',
    border: 'border-t-stat-dexterity',
    soft: 'bg-stat-dexterity-soft',
    text: 'text-stat-dexterity-text',
    ring: 'hover:shadow-[inset_0_0_0_1px_var(--codex-stat-dexterity)]',
  },
  intelligence: {
    dot: 'bg-stat-intelligence',
    border: 'border-t-stat-intelligence',
    soft: 'bg-stat-intelligence-soft',
    text: 'text-stat-intelligence-text',
    ring: 'hover:shadow-[inset_0_0_0_1px_var(--codex-stat-intelligence)]',
  },
  charisma: {
    dot: 'bg-stat-charisma',
    border: 'border-t-stat-charisma',
    soft: 'bg-stat-charisma-soft',
    text: 'text-stat-charisma-text',
    ring: 'hover:shadow-[inset_0_0_0_1px_var(--codex-stat-charisma)]',
  },
  wisdom: {
    dot: 'bg-stat-wisdom',
    border: 'border-t-stat-wisdom',
    soft: 'bg-stat-wisdom-soft',
    text: 'text-stat-wisdom-text',
    ring: 'hover:shadow-[inset_0_0_0_1px_var(--codex-stat-wisdom)]',
  },
  luck: {
    dot: 'bg-stat-luck',
    border: 'border-t-stat-luck',
    soft: 'bg-stat-luck-soft',
    text: 'text-stat-luck-text',
    ring: 'hover:shadow-[inset_0_0_0_1px_var(--codex-stat-luck)]',
  },
}
