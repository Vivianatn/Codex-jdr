import type { StatKey } from '@/domain/types'

/** Static class names (so Tailwind can see them) for each characteristic colour. */
export const STAT_STYLES: Record<StatKey, { dot: string; border: string; soft: string }> = {
  strength: {
    dot: 'bg-stat-strength',
    border: 'border-t-stat-strength',
    soft: 'bg-stat-strength/12',
  },
  constitution: {
    dot: 'bg-stat-constitution',
    border: 'border-t-stat-constitution',
    soft: 'bg-stat-constitution/12',
  },
  dexterity: {
    dot: 'bg-stat-dexterity',
    border: 'border-t-stat-dexterity',
    soft: 'bg-stat-dexterity/12',
  },
  intelligence: {
    dot: 'bg-stat-intelligence',
    border: 'border-t-stat-intelligence',
    soft: 'bg-stat-intelligence/12',
  },
  charisma: {
    dot: 'bg-stat-charisma',
    border: 'border-t-stat-charisma',
    soft: 'bg-stat-charisma/12',
  },
  wisdom: { dot: 'bg-stat-wisdom', border: 'border-t-stat-wisdom', soft: 'bg-stat-wisdom/12' },
  luck: { dot: 'bg-stat-luck', border: 'border-t-stat-luck', soft: 'bg-stat-luck/12' },
}
