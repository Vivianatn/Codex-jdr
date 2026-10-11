import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export const PREP_SECTIONS = [
  'dashboard',
  'players',
  'bestiary',
  'allies',
  'skills',
  'items',
  'conditions',
  'maps',
  'sessions',
  'quests',
  'notes',
  'rules',
] as const

export type PrepSection = (typeof PREP_SECTIONS)[number]

export function isPrepSection(value: string | undefined): value is PrepSection {
  return (PREP_SECTIONS as readonly string[]).includes(value ?? '')
}

interface UiState {
  /** Last visited prep section per campaign, so the mode switch returns where you left off. */
  lastPrepSection: Record<string, PrepSection>
  rememberPrepSection: (campaignId: string, section: PrepSection) => void
  forgetCampaign: (campaignId: string) => void
  /** Dice tray drawer (not persisted). */
  diceOpen: boolean
  setDiceOpen: (open: boolean) => void
  /** Character sheet opened over the map in play mode (not persisted). */
  playSheetId: string | null
  openPlaySheet: (id: string | null) => void
  /** Character in the quick manipulation panel (not persisted). */
  quickId: string | null
  openQuick: (id: string | null) => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      lastPrepSection: {},
      diceOpen: false,
      setDiceOpen: (diceOpen) => set({ diceOpen }),
      playSheetId: null,
      openPlaySheet: (playSheetId) => set({ playSheetId, quickId: null }),
      quickId: null,
      openQuick: (quickId) => set({ quickId, playSheetId: null }),
      rememberPrepSection: (campaignId, section) =>
        set((s) =>
          s.lastPrepSection[campaignId] === section
            ? s
            : { lastPrepSection: { ...s.lastPrepSection, [campaignId]: section } },
        ),
      forgetCampaign: (campaignId) =>
        set((s) => {
          const { [campaignId]: _removed, ...rest } = s.lastPrepSection
          return { lastPrepSection: rest }
        }),
    }),
    {
      name: 'codex.ui',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ lastPrepSection }) => ({ lastPrepSection }),
    },
  ),
)
