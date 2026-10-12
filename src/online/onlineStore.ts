import { create } from 'zustand'
import { HOST_ID, type Participant } from '@/domain/turns'
import { useSessionStore } from '@/security/session'

/** What this device is in the online game (D-245). */
export type OnlineRole = 'offline' | 'host' | 'guest'

/** Editors prepare and may run the game; players act through their own character. */
export type GuestRole = 'editor' | 'player'

export interface PeerInfo {
  id: string
  name: string
  role: GuestRole
  status: 'inviting' | 'connected' | 'closed'
  /** Characters a player has chosen. */
  characterIds: string[]
}

interface OnlineState {
  role: OnlineRole
  /** Campaign shared (host) or joined (guest). */
  campaignId: string | null
  /** This device's participant id: HOST_ID unless joined as a guest. */
  selfId: string
  /** Guest only. */
  guestRole: GuestRole | null
  hostName: string | null
  campaignName: string | null
  /** Host: everyone invited or connected. Guest: the others, as told by the host. */
  peers: PeerInfo[]
}

export const useOnlineStore = create<OnlineState>()(() => ({
  role: 'offline',
  campaignId: null,
  selfId: HOST_ID,
  guestRole: null,
  hostName: null,
  campaignName: null,
  peers: [],
}))

/** Who acts from this device. */
export function selfParticipant(): Participant {
  return {
    id: useOnlineStore.getState().selfId,
    name: useSessionStore.getState().account?.username ?? 'MJ',
  }
}

/** True for the device that owns the campaign (offline or hosting). */
export function isHostDevice(): boolean {
  return useOnlineStore.getState().role !== 'guest'
}
