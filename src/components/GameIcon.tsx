import type { ComponentType, SVGProps } from 'react'
import { cn } from '@/lib/cn'
import { GAME_ICON_BODIES, type GameIconName } from './gameIcons.generated'

export type { GameIconName }

/** Any icon component: a game glyph, or a Lucide icon for plain interface actions. */
export type IconComponent = ComponentType<SVGProps<SVGSVGElement>>

/**
 * A game-icons.net glyph (CC BY 3.0, D-250): filled, engraved silhouettes for
 * everything that belongs to the game (sections, items, conditions, dice).
 * Plain interface actions (close, undo, add) keep their simple line icons.
 */
export function GameIcon({
  name,
  className,
  ...props
}: SVGProps<SVGSVGElement> & { name: GameIconName }) {
  return (
    <svg
      viewBox="0 0 512 512"
      fill="currentColor"
      className={cn('size-6 shrink-0', className)}
      // Trusted, generated at build time from the icon set (scripts/game-icons.ts).
      dangerouslySetInnerHTML={{ __html: GAME_ICON_BODIES[name] }}
      {...props}
    />
  )
}
