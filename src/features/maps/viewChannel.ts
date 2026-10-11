import type { Point } from '@/domain/maps'
import type { Camera } from '@/stores/mapViewStore'

/**
 * Live link between the GM window and the players' window (SPEC §5.3).
 * Map data reaches the players' window through IndexedDB (Dexie live queries
 * work across tabs); fast things — camera and pings — go through a
 * BroadcastChannel.
 */

export type ViewMessage =
  | { type: 'camera'; mapId: string; camera: Camera; width: number; height: number }
  | { type: 'ping'; mapId: string; point: Point }

export function openViewChannel(campaignId: string, onMessage?: (message: ViewMessage) => void) {
  if (typeof BroadcastChannel === 'undefined') return { post: () => {}, close: () => {} }
  const channel = new BroadcastChannel(`codex-view-${campaignId}`)
  if (onMessage) channel.onmessage = (event: MessageEvent<ViewMessage>) => onMessage(event.data)
  return {
    post: (message: ViewMessage) => channel.postMessage(message),
    close: () => channel.close(),
  }
}
