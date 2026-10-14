import { create } from 'zustand'
import type {
  AdventurerProfile,
  CampaignSummary,
  FriendsList,
  OpenSession,
  PresenceUser,
  PublicUser,
} from '@shared/sync'
import type { MyRequest } from './api'

/**
 * - `off`: this local account has no online account;
 * - `connecting` / `online` / `offline`: the server can or cannot be reached;
 * - `signedOut`: the server forgot this device (session expired, password reset).
 */
export type ServerStatus = 'off' | 'connecting' | 'online' | 'offline' | 'signedOut'

interface ServerState {
  /** The online account linked to the unlocked local account (D-262). */
  user: PublicUser | null
  status: ServerStatus
  /** Campaigns this account belongs to, as the server last said. */
  campaigns: CampaignSummary[]
  /** Join requests this account sent, still waiting. */
  requests: MyRequest[]
  /** Other GMs' games open to players right now (catalogue). */
  sessions: OpenSession[]
  /** Own profile (picture, banner, adventurer code), once read (D-267). */
  profile: AdventurerProfile | null
  /** Adventurers and requests, once read. */
  friends: FriendsList | null
  /** Members of each campaign connected right now. */
  presence: Record<string, PresenceUser[]>
  /** Local changes not yet accepted by the server. */
  pending: number
  /** Campaigns of this device kept on the server. */
  synced: string[]
}

export const initialServerState: ServerState = {
  user: null,
  status: 'off',
  campaigns: [],
  requests: [],
  sessions: [],
  profile: null,
  friends: null,
  presence: {},
  pending: 0,
  synced: [],
}

export const useServerStore = create<ServerState>()(() => initialServerState)

/** True when this device keeps the campaign on the server (D-262). */
export function useIsOnlineCampaign(campaignId: string | undefined): boolean {
  return useServerStore((s) => (campaignId ? s.synced.includes(campaignId) : false))
}

/** This account's summary of a campaign, when it is online. */
export function useServerCampaign(campaignId: string | undefined): CampaignSummary | undefined {
  return useServerStore((s) => s.campaigns.find((c) => c.id === campaignId))
}
