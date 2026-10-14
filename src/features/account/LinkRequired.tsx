import { LockKeyhole } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useT } from '@/i18n'
import { lockSession, useSessionStore } from '@/security/session'
import { Frame } from './LockScreen'
import { LinkForm } from './OnlineAccountSection'

/**
 * Codex is online only (D-266): an older account that lives on this device
 * alone opens once it is linked to an online account; its campaigns go up.
 */
export function LinkRequired() {
  const t = useT()
  const username = useSessionStore((s) => s.account?.username ?? '')
  return (
    <Frame title={t.account.online.linkRequiredTitle}>
      <LinkForm username={username} />
      <Button
        variant="ghost"
        className="w-full"
        icon={<LockKeyhole />}
        onClick={() => void lockSession()}
      >
        {t.account.online.linkRequiredLock}
      </Button>
    </Frame>
  )
}
