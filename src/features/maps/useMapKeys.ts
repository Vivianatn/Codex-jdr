import { useEffect } from 'react'
import { useT } from '@/i18n'
import { isTypingTarget } from '@/lib/dom'
import { useMapViewStore } from '@/stores/mapViewStore'
import type { MapChange } from './MapCanvas'

/**
 * Board shortcuts, the same in the editor and in play (D-260): Delete or
 * Backspace removes what is selected (element, wall or door, tokens), R turns
 * the selected element. Never while typing in a field; every change undoes.
 * In play, tokens stay out of it (`tokens: false`): clicking one opens its
 * sheet, and a stray Backspace must not take a character off the board.
 */
export function useMapKeys(onChange: MapChange | null, { tokens = true } = {}) {
  const t = useT()
  useEffect(() => {
    if (!onChange) return
    const down = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey) return
      const view = useMapViewStore.getState()
      const sel = view.selection
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (sel.type === 'element')
          onChange(
            (m) => ({ ...m, elements: m.elements.filter((x) => x.id !== sel.id) }),
            t.maps.elementDeleted,
          )
        else if (sel.type === 'wall')
          onChange(
            (m) => ({ ...m, walls: m.walls.filter((x) => x.id !== sel.id) }),
            t.maps.wallDeleted,
          )
        else if (tokens && sel.type === 'tokens' && sel.ids.length > 0)
          onChange(
            (m) => ({ ...m, tokens: m.tokens.filter((tk) => !sel.ids.includes(tk.id)) }),
            t.maps.tokensDeleted(sel.ids.length),
          )
        else return
        e.preventDefault()
        view.select({ type: 'none' })
        view.openSheet(null)
      } else if ((e.key === 'r' || e.key === 'R') && sel.type === 'element') {
        onChange(
          (m) => ({
            ...m,
            elements: m.elements.map((x) =>
              x.id === sel.id ? { ...x, rotation: (x.rotation + 90) % 360 } : x,
            ),
          }),
          t.maps.elementChanged,
        )
      }
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [onChange, t, tokens])
}
