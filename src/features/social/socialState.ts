import { useServerStore } from '@/online/server/serverStore'
import type { FriendsList, Relation } from '@shared/sync'

/** Where this account stands with `userId`, from the lists the server last sent (D-267). */
export function relationIn(
  friends: FriendsList | null,
  selfId: string | undefined,
  userId: string,
): Relation {
  if (userId === selfId) return 'self'
  if (!friends) return 'none'
  if (friends.friends.some((f) => f.id === userId)) return 'friend'
  if (friends.outgoing.some((f) => f.id === userId)) return 'sent'
  if (friends.incoming.some((f) => f.id === userId)) return 'received'
  return 'none'
}

export function useRelation(userId: string): Relation {
  return useServerStore((s) => relationIn(s.friends, s.user?.id, userId))
}

/** Adventurer requests waiting for this account's answer. */
export function usePendingAdventurers(): number {
  return useServerStore((s) => s.friends?.incoming.length ?? 0)
}

/** The link that opens someone's profile from their adventurer code. */
export function adventurerUrl(code: string): string {
  return `${location.origin}/app/#/aventurier/${code}`
}

/** « K7QFM2XA » → « K7QF-M2XA », easier to read aloud. */
export function formatCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code
}
