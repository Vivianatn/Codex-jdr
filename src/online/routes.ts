/** Where a player lands once in a game (D-262). */
export function guestHome(campaignId: string): string {
  return `/c/${campaignId}/player`
}
