import { Check, UserCheck, UserMinus, UserPlus, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button, IconButton } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { onlineErrorMessage } from '@/features/online/onlineMessages'
import { useT } from '@/i18n'
import { refreshSocial } from '@/online/controller'
import { server } from '@/online/server/api'
import { useRelation } from './socialState'

/** Asks, accepts, declines, withdraws or ends an adventurer bond, as the relation allows (D-267). */
export function RelationButton({
  user,
  compact = false,
}: {
  user: { id: string; displayName: string }
  /** Icon buttons, for lists. */
  compact?: boolean
}) {
  const t = useT()
  const relation = useRelation(user.id)
  const [busy, setBusy] = useState(false)
  const [parting, setParting] = useState(false)
  const run = async (task: () => Promise<unknown>, done?: string) => {
    setBusy(true)
    try {
      await task()
      if (done) toast.success(done)
      await refreshSocial()
    } catch (error) {
      toast.error(onlineErrorMessage(t, error))
    } finally {
      setBusy(false)
    }
  }
  const ask = () => run(() => server.befriend(user.id), t.adventurers.requestSent(user.displayName))
  const accept = () => run(() => server.befriend(user.id), t.adventurers.accepted(user.displayName))
  const drop = () => run(() => server.unfriend(user.id))

  switch (relation) {
    case 'self':
      return null
    case 'none':
      return compact ? (
        <IconButton
          size="sm"
          label={t.adventurers.addNamed(user.displayName)}
          icon={<UserPlus />}
          disabled={busy}
          onClick={ask}
        />
      ) : (
        <Button size="sm" variant="primary" icon={<UserPlus />} disabled={busy} onClick={ask}>
          {t.adventurers.add}
        </Button>
      )
    case 'sent':
      return compact ? (
        <IconButton
          size="sm"
          label={t.adventurers.cancel}
          icon={<X />}
          disabled={busy}
          onClick={drop}
        />
      ) : (
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-ink-muted">{t.adventurers.sent}</span>
          <Button size="sm" variant="ghost" disabled={busy} onClick={drop}>
            {t.adventurers.cancel}
          </Button>
        </span>
      )
    case 'received':
      return (
        <span className="flex flex-wrap items-center gap-1">
          {compact ? (
            <IconButton
              size="sm"
              label={t.adventurers.acceptNamed(user.displayName)}
              icon={<Check />}
              disabled={busy}
              onClick={accept}
            />
          ) : (
            <Button size="sm" variant="primary" icon={<Check />} disabled={busy} onClick={accept}>
              {t.adventurers.accept}
            </Button>
          )}
          {compact ? (
            <IconButton
              size="sm"
              label={t.adventurers.declineNamed(user.displayName)}
              icon={<X />}
              disabled={busy}
              onClick={drop}
            />
          ) : (
            <Button size="sm" variant="ghost" disabled={busy} onClick={drop}>
              {t.adventurers.decline}
            </Button>
          )}
        </span>
      )
    case 'friend':
      return (
        <>
          {compact ? (
            <IconButton
              size="sm"
              label={t.adventurers.removeTitle(user.displayName)}
              icon={<UserMinus />}
              disabled={busy}
              onClick={() => setParting(true)}
            />
          ) : (
            <span className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-text">
                <UserCheck className="size-3.5" aria-hidden />
                {t.adventurers.friend}
              </span>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setParting(true)}>
                {t.adventurers.remove}
              </Button>
            </span>
          )}
          <Dialog
            open={parting}
            onOpenChange={setParting}
            title={t.adventurers.removeTitle(user.displayName)}
            description={t.adventurers.removeBody}
            footer={
              <>
                <Button variant="ghost" onClick={() => setParting(false)}>
                  {t.common.cancel}
                </Button>
                <Button
                  variant="danger"
                  onClick={async () => {
                    await drop()
                    setParting(false)
                  }}
                >
                  {t.adventurers.remove}
                </Button>
              </>
            }
          />
        </>
      )
  }
}
