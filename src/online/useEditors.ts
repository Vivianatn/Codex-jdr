import { useMemo } from 'react'
import { HOST_ID, type Participant } from '@/domain/turns'
import { useOnlineStore } from './onlineStore'

/** Editors who could take the table: connected editors, and the host seen from a guest. */
export function useEditors(): Participant[] {
  const online = useOnlineStore()
  return useMemo(() => {
    const editors = online.peers
      .filter((p) => p.role === 'editor' && p.status === 'connected')
      .map((p) => ({ id: p.id, name: p.name }))
    if (online.role === 'guest' && online.hostName)
      editors.unshift({ id: HOST_ID, name: online.hostName })
    return editors.filter((p) => p.id !== online.selfId)
  }, [online])
}
