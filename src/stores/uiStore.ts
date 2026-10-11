import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export const PREP_SECTIONS = [
  'dashboard',
  'players',
  'bestiary',
  'allies',
  'items',
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
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      lastPrepSection: {},
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
