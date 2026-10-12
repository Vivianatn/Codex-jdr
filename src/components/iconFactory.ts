import { createElement, type SVGProps } from 'react'
import { GameIcon, type GameIconName, type IconComponent } from './GameIcon'

export type { IconComponent } from './GameIcon'

const cache = new Map<GameIconName, IconComponent>()

/** A component for one glyph, usable wherever an icon component is expected. */
export function gameIcon(name: GameIconName): IconComponent {
  let component = cache.get(name)
  if (!component) {
    const Icon = (props: SVGProps<SVGSVGElement>) => createElement(GameIcon, { ...props, name })
    Icon.displayName = `GameIcon(${name})`
    component = Icon
    cache.set(name, component)
  }
  return component
}
