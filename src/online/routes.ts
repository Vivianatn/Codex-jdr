import type { GuestRole } from './onlineStore'

/** Where a guest lands once joined: editors prepare, players play (D-245). */
export function guestHome(campaignId: string, role: GuestRole): string {
  return role === 'player' ? `/c/${campaignId}/player` : `/c/${campaignId}/prep/dashboard`
}
