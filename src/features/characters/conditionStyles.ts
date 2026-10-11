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

/** Pill classes per condition colour (text stays ink for contrast). */
export const CONDITION_COLOR_CLASSES: Record<
  ConditionColor,
  { pill: string; icon: string; swatch: string; edge: string }
> = {
  red: {
    pill: 'bg-[#e05252]/15 border-[#e05252]/40',
    icon: 'text-[#c43d3d] dark:text-[#f08080]',
    swatch: 'bg-[#e05252]',
    edge: 'border-l-[#e05252]',
  },
  orange: {
    pill: 'bg-[#e8833d]/15 border-[#e8833d]/40',
    icon: 'text-[#b85f1f] dark:text-[#f0a46b]',
    swatch: 'bg-[#e8833d]',
    edge: 'border-l-[#e8833d]',
  },
  yellow: {
    pill: 'bg-[#d9a441]/18 border-[#d9a441]/45',
    icon: 'text-[#8a6417] dark:text-[#e6bd6a]',
    swatch: 'bg-[#d9a441]',
    edge: 'border-l-[#d9a441]',
  },
  green: {
    pill: 'bg-[#3fa96b]/15 border-[#3fa96b]/40',
    icon: 'text-[#23774a] dark:text-[#6fcf97]',
    swatch: 'bg-[#3fa96b]',
    edge: 'border-l-[#3fa96b]',
  },
  blue: {
    pill: 'bg-[#4a90d9]/15 border-[#4a90d9]/40',
    icon: 'text-[#2f6db0] dark:text-[#8bb8ea]',
    swatch: 'bg-[#4a90d9]',
    edge: 'border-l-[#4a90d9]',
  },
  violet: {
    pill: 'bg-[#6d5bd0]/15 border-[#6d5bd0]/40',
    icon: 'text-[#5a48bd] dark:text-[#a99cf2]',
    swatch: 'bg-[#6d5bd0]',
    edge: 'border-l-[#6d5bd0]',
  },
  pink: {
    pill: 'bg-[#d3558f]/15 border-[#d3558f]/40',
    icon: 'text-[#b03a72] dark:text-[#e57aab]',
    swatch: 'bg-[#d3558f]',
    edge: 'border-l-[#d3558f]',
  },
  gray: {
    pill: 'bg-surface-2 border-line-strong',
    icon: 'text-ink-muted',
    swatch: 'bg-[#8a869c]',
    edge: 'border-l-line-strong',
  },
}

/** Coloured edge per rarity (SPEC §4.11), plus a dot for the legend. */
export const RARITY_CLASSES: Record<Rarity, { edge: string; dot: string }> = {
  common: { edge: 'border-l-line-strong', dot: 'bg-line-strong' },
  uncommon: { edge: 'border-l-heal', dot: 'bg-heal' },
  rare: { edge: 'border-l-info', dot: 'bg-info' },
  epic: { edge: 'border-l-accent', dot: 'bg-accent' },
  legendary: { edge: 'border-l-gold', dot: 'bg-gold' },
}
