import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Locale } from '@/i18n'

export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'
export type AnimationLevel = 'full' | 'reduced' | 'off'
export type TextSize = 100 | 112 | 125
/** Which kind of screen is showing: preparation, the GM's play screen, the players' window. */
export type Surface = 'prep' | 'play' | 'players'

/** localStorage key — also read by the inline script in index.html to avoid a theme flash. */
export const SETTINGS_STORAGE_KEY = 'codex.settings'

/** Public STUN server used unless the GM changes it (D-245). */
export const DEFAULT_STUN = 'stun:stun.l.google.com:19302'

export interface SettingsState {
  theme: ThemePreference
  animations: AnimationLevel
  locale: Locale
  /** Animated dice in the roll feed (results are shown either way). */
  diceAnimation: boolean
  /** The play screen is always dark (« table à la chandelle », DA §10.6). */
  playDark: boolean
  /** Barely visible paper grain behind the preparation screens (DA §6.5). */
  paperGrain: boolean
  /** STUN server for the online mode (D-245); empty = same network only. */
  stunServer: string
  /** Interface text size in percent (not the board). */
  textSize: TextSize
  /** Screen currently showing (not saved). */
  surface: Surface
  setTheme: (theme: ThemePreference) => void
  setAnimations: (level: AnimationLevel) => void
  setLocale: (locale: Locale) => void
  setDiceAnimation: (on: boolean) => void
  setPlayDark: (on: boolean) => void
  setPaperGrain: (on: boolean) => void
  setStunServer: (url: string) => void
  setTextSize: (size: TextSize) => void
  setSurface: (surface: Surface) => void
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
      playDark: true,
      paperGrain: true,
      stunServer: DEFAULT_STUN,
      textSize: 100,
      surface: 'prep',
      setTheme: (theme) => set({ theme }),
      setAnimations: (animations) => set({ animations }),
      setLocale: (locale) => set({ locale }),
      setDiceAnimation: (diceAnimation) => set({ diceAnimation }),
      setPlayDark: (playDark) => set({ playDark }),
      setPaperGrain: (paperGrain) => set({ paperGrain }),
      setStunServer: (stunServer) => set({ stunServer: stunServer.trim() }),
      setTextSize: (textSize) => set({ textSize }),
      setSurface: (surface) => set({ surface }),
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({
        theme,
        animations,
        locale,
        diceAnimation,
        playDark,
        paperGrain,
        stunServer,
        textSize,
      }) => ({
        theme,
        animations,
        locale,
        diceAnimation,
        playDark,
        paperGrain,
        stunServer,
        textSize,
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
