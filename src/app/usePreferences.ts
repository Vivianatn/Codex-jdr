import { useEffect, useSyncExternalStore } from 'react'
import { resolveTheme, useSettingsStore, type ResolvedTheme } from '@/stores/settingsStore'

const DARK_QUERY = '(prefers-color-scheme: dark)'

function subscribeToSystemTheme(onChange: () => void) {
  const mq = window.matchMedia(DARK_QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

function systemPrefersDark() {
  return window.matchMedia(DARK_QUERY).matches
}

export function useResolvedTheme(): ResolvedTheme {
  const preference = useSettingsStore((s) => s.theme)
  const prefersDark = useSyncExternalStore(subscribeToSystemTheme, systemPrefersDark, () => false)
  return resolveTheme(preference, prefersDark)
}

/** Mirrors theme and animation preferences onto <html> data attributes used by the CSS. */
export function useApplyPreferences(): void {
  const theme = useResolvedTheme()
  const animations = useSettingsStore((s) => s.animations)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    document.documentElement.dataset.motion = animations
  }, [animations])
}
