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
  const forceDark = useSettingsStore(
    (s) => s.surface === 'players' || (s.surface === 'play' && s.playDark),
  )
  const prefersDark = useSyncExternalStore(subscribeToSystemTheme, systemPrefersDark, () => false)
  // The play screen is dark by default and the players' window always is
  // (DA §10.6, §10.8). It applies to the whole document so menus, toasts and
  // dialogs (portals) follow.
  return forceDark ? 'dark' : resolveTheme(preference, prefersDark)
}

/** Mirrors theme and animation preferences onto <html> data attributes used by the CSS. */
export function useApplyPreferences(): void {
  const theme = useResolvedTheme()
  const animations = useSettingsStore((s) => s.animations)
  const grain = useSettingsStore((s) => s.paperGrain && s.surface === 'prep')
  const textSize = useSettingsStore((s) => s.textSize)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    document.documentElement.dataset.motion = animations
  }, [animations])

  useEffect(() => {
    document.documentElement.dataset.grain = grain ? 'on' : 'off'
  }, [grain])

  useEffect(() => {
    document.documentElement.style.fontSize = textSize === 100 ? '' : `${textSize}%`
  }, [textSize])
}
