import {
  ArrowDown,
  Brain,
  Droplet,
  Eye,
  EyeOff,
  Flame,
  Ghost,
  Heart,
  Moon,
  Shield,
  Skull,
  Snail,
  Snowflake,
  Sparkles,
  Star,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { ConditionColor, ConditionIcon, Rarity } from '@/domain/types'

export const CONDITION_ICON_COMPONENTS: Record<ConditionIcon, LucideIcon> = {
  skull: Skull,
  flame: Flame,
  zap: Zap,
  'eye-off': EyeOff,
  heart: Heart,
  ghost: Ghost,
  eye: Eye,
  'arrow-down': ArrowDown,
  droplet: Droplet,
  sparkles: Sparkles,
  brain: Brain,
  snail: Snail,
  shield: Shield,
  snowflake: Snowflake,
  moon: Moon,
  star: Star,
}

/**
 * Pill classes per condition colour, on the DA tokens (§8.16): soft
 * background, text in the matching *-text tone (AA in both themes).
 * The GM picks the colour; it maps onto the DA families.
 */
export const CONDITION_COLOR_CLASSES: Record<
  ConditionColor,
  { pill: string; icon: string; swatch: string; edge: string }
> = {
  red: {
    pill: 'bg-hp-soft border-hp/35 text-hp-text',
    icon: 'text-hp-text',
    swatch: 'bg-hp',
    edge: 'border-l-hp',
  },
  orange: {
    pill: 'bg-warning-soft border-warning/40 text-warning-text',
    icon: 'text-warning-text',
    swatch: 'bg-warning',
    edge: 'border-l-warning',
  },
  yellow: {
    pill: 'bg-gold-soft border-gold-line/50 text-gold-text',
    icon: 'text-gold-text',
    swatch: 'bg-gold',
    edge: 'border-l-gold',
  },
  green: {
    pill: 'bg-heal-soft border-heal/35 text-heal-text',
    icon: 'text-heal-text',
    swatch: 'bg-heal',
    edge: 'border-l-heal',
  },
  blue: {
    pill: 'bg-info-soft border-info/35 text-info-text',
    icon: 'text-info-text',
    swatch: 'bg-info',
    edge: 'border-l-info',
  },
  violet: {
    pill: 'bg-stat-wisdom-soft border-stat-wisdom/35 text-stat-wisdom-text',
    icon: 'text-stat-wisdom-text',
    swatch: 'bg-stat-wisdom',
    edge: 'border-l-stat-wisdom',
  },
  pink: {
    pill: 'bg-stat-charisma-soft border-stat-charisma/35 text-stat-charisma-text',
    icon: 'text-stat-charisma-text',
    swatch: 'bg-stat-charisma',
    edge: 'border-l-stat-charisma',
  },
  gray: {
    pill: 'bg-surface-2 border-line-strong text-ink',
    icon: 'text-ink-muted',
    swatch: 'bg-line-strong',
    edge: 'border-l-line-strong',
  },
}

/** Coloured edge per rarity (SPEC §4.11, DA §8.19), plus a dot for the legend. */
export const RARITY_CLASSES: Record<Rarity, { edge: string; dot: string }> = {
  common: { edge: 'border-l-rarity-common', dot: 'bg-rarity-common' },
  uncommon: { edge: 'border-l-rarity-uncommon', dot: 'bg-rarity-uncommon' },
  rare: { edge: 'border-l-rarity-rare', dot: 'bg-rarity-rare' },
  epic: { edge: 'border-l-rarity-very-rare', dot: 'bg-rarity-very-rare' },
  legendary: { edge: 'border-l-rarity-legendary', dot: 'bg-rarity-legendary' },
}
