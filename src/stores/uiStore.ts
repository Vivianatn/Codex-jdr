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
  'notes',
  'rules',
] as const

export type PrepSection = (typeof PREP_SECTIONS)[number]

export function isPrepSection(value: string | undefined): value is PrepSection {
  return (PREP_SECTIONS as readonly string[]).includes(value ?? '')
}

/** The campaign list as a GM (own campaigns) or as a player (games joined) (D-257). */
export type HomeMode = 'gm' | 'player'

interface UiState {
  homeMode: HomeMode
  setHomeMode: (mode: HomeMode) => void
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
  /** Play screen panels, remembered per device (D-272). */
  play: PlayPanels
  setPlayPanels: (patch: Partial<PlayPanels>) => void
}

/** Which play panels are open on this device (D-272). */
export interface PlayPanels {
  /** Turns and groups rail (desktop; on small screens it opens on demand). */
  rail: boolean
  /** Party strip with names and HP bars, or portraits only. */
  partyCompact: boolean
  /** Lower section of the quick panel. */
  quickTab: 'items' | 'conditions'
  /** The player's sheet panel on small screens (online player). */
  playerSheet: boolean
}

const PLAY_PANELS: PlayPanels = {
  rail: true,
  partyCompact: false,
  quickTab: 'items',
  playerSheet: true,
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      lastPrepSection: {},
      homeMode: 'gm',
      setHomeMode: (homeMode) => set({ homeMode }),
      diceOpen: false,
      setDiceOpen: (diceOpen) => set({ diceOpen }),
      playSheetId: null,
      openPlaySheet: (playSheetId) => set({ playSheetId, quickId: null }),
      quickId: null,
      openQuick: (quickId) => set({ quickId, playSheetId: null }),
      play: PLAY_PANELS,
      setPlayPanels: (patch) => set((s) => ({ play: { ...s.play, ...patch } })),
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
      partialize: ({ lastPrepSection, homeMode, play }) => ({ lastPrepSection, homeMode, play }),
      // Older saves have no play panels; new keys get their default.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<UiState>
        return { ...current, ...p, play: { ...PLAY_PANELS, ...p.play } }
      },
    },
  ),
)
