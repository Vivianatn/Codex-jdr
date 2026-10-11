import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Locale } from '@/i18n'

export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'
export type AnimationLevel = 'full' | 'reduced' | 'off'

/** localStorage key — also read by the inline script in index.html to avoid a theme flash. */
export const SETTINGS_STORAGE_KEY = 'codex.settings'

export interface SettingsState {
  theme: ThemePreference
  animations: AnimationLevel
  locale: Locale
  /** Animated dice in the roll feed (results are shown either way). */
  diceAnimation: boolean
  setTheme: (theme: ThemePreference) => void
  setAnimations: (level: AnimationLevel) => void
  setLocale: (locale: Locale) => void
  setDiceAnimation: (on: boolean) => void
}

/**
 * Device-level preferences. Kept in localStorage (not IndexedDB) because they
 * are per device, not per campaign, and must be readable synchronously at boot.
 */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'light',
      animations: 'full',
      locale: 'fr',
      diceAnimation: true,
      setTheme: (theme) => set({ theme }),
      setAnimations: (animations) => set({ animations }),
      setLocale: (locale) => set({ locale }),
      setDiceAnimation: (diceAnimation) => set({ diceAnimation }),
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ theme, animations, locale, diceAnimation }) => ({
        theme,
        animations,
        locale,
        diceAnimation,
      }),
    },
  ),
)

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light'
  return preference
}
