import { useEffect } from 'react'
import { useSettingsStore, type Surface } from '@/stores/settingsStore'

/** Declares the kind of screen showing while the calling component is mounted. */
export function useSurface(surface: Surface) {
  useEffect(() => {
    useSettingsStore.getState().setSurface(surface)
    return () => useSettingsStore.getState().setSurface('prep')
  }, [surface])
}
