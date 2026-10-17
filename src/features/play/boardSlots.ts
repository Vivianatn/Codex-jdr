import { createContext, useContext } from 'react'

/**
 * Where the board chrome goes on the play screen (D-272): the map controls
 * (top row, next to the party strip) and the tools (bottom row). The play
 * layout owns these slots so floating panels never cover one another; the map
 * (lazy, Konva) portals its controls into them.
 */
export interface BoardSlots {
  top: HTMLElement | null
  bottom: HTMLElement | null
}

export const BoardSlotsContext = createContext<BoardSlots | null>(null)

export function useBoardSlots(): BoardSlots | null {
  return useContext(BoardSlotsContext)
}
