import { create } from 'zustand'
import { HOST_ID, type Participant } from '@/domain/turns'
import { useSessionStore } from '@/security/session'
import { useServerStore } from './server/serverStore'

/**
 * What this device is in a live online game (D-262): serving the players of
 * its running game (`host`), a player in someone else's (`guest`), or neither.
 */
export type OnlineRole = 'offline' | 'host' | 'guest'

/** Only players enter a game through the relay; co-GMs work on their own synced copy. */
export type GuestRole = 'player'

export interface PeerInfo {
  /** The player's online account id. */
  id: string
  name: string
  role: GuestRole
  status: 'connected' | 'closed'
  /** Character this player acts through. */
  characterIds: string[]
}

interface OnlineState {
  role: OnlineRole
  /** Campaign served (host) or entered (guest). */
  campaignId: string | null
  /** This device's participant id: the online account's id, HOST_ID for a local-only account. */
  selfId: string
  /** Guest only. */
  guestRole: GuestRole | null
  hostName: string | null
  campaignName: string | null
  /** Host: the players in the game. Guest: the others, as told by the operator. */
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

/** Who acts from this device: the online account when there is one, else the local one. */
export function selfParticipant(): Participant {
  return {
    id: useOnlineStore.getState().selfId,
    name:
      useServerStore.getState().user?.displayName ??
      useSessionStore.getState().account?.username ??
      'MJ',
  }
}

/** False on a player's device, which only shows someone else's game. */
export function isHostDevice(): boolean {
  return useOnlineStore.getState().role !== 'guest'
}
