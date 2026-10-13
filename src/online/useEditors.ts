import { useMemo } from 'react'
import type { Participant } from '@/domain/turns'
import { useOnlineStore } from './onlineStore'
import { useServerStore } from './server/serverStore'

/** Who could take the table: the campaign's GMs connected right now, except oneself (D-262). */
export function useEditors(campaignId: string): Participant[] {
  const selfId = useOnlineStore((s) => s.selfId)
  const presence = useServerStore((s) => s.presence[campaignId])
  return useMemo(
    () =>
      (presence ?? [])
        .filter((u) => u.role !== 'player' && u.id !== selfId)
        .map((u) => ({ id: u.id, name: u.name })),
    [presence, selfId],
  )
}
