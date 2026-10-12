import { Copy, LogIn, LogOut } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { TextAreaField } from '@/components/ui/TextField'
import { useT } from '@/i18n'
import { copyText } from '@/lib/clipboard'
import { leaveGuest, prepareJoin, type PendingJoin } from '@/online/controller'
import { useOnlineStore } from '@/online/onlineStore'
import { guestHome } from '@/online/routes'
import { InvalidCodeError } from '@/online/signaling'

/** « Rejoindre une partie »: invitation in, reply code out, then wait for the host (D-245). */
export function JoinDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const t = useT()
  const navigate = useNavigate()
  const [invite, setInvite] = useState('')
  const [pending, setPending] = useState<PendingJoin | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const current = useRef<PendingJoin | null>(null)

  useEffect(() => {
    current.current = pending
    if (!pending) return
    let alive = true
    pending.joined.then(
      (welcome) => {
        if (!alive) return
        onOpenChange(false)
        navigate(guestHome(welcome.campaignId, welcome.role))
      },
      () => alive && setError(t.online.failed),
    )
    return () => {
      alive = false
    }
  }, [pending, navigate, onOpenChange, t])

  const close = (o: boolean) => {
    if (!o) {
      // Closing before the host connects cancels the attempt.
      if (useOnlineStore.getState().role !== 'guest') current.current?.cancel()
      setPending(null)
      setInvite('')
      setError(null)
    }
    onOpenChange(o)
  }

  const role = pending?.invite.role === 'editor' ? t.online.roleEditor : t.online.rolePlayer
  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title={t.online.join}
      description={pending ? undefined : t.online.joinIntro}
    >
      {!pending ? (
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault()
            setBusy(true)
            setError(null)
            try {
              setPending(await prepareJoin(invite))
            } catch (err) {
              setError(err instanceof InvalidCodeError ? t.online.invalidCode : t.online.failed)
            } finally {
              setBusy(false)
            }
          }}
        >
          <TextAreaField
            label={t.online.inviteLabel}
            value={invite}
            onChange={(e) => setInvite(e.target.value)}
            spellCheck={false}
            className="font-mono text-xs"
            error={error}
          />
          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              icon={<LogIn />}
              disabled={busy || !invite.trim()}
            >
              {busy ? t.online.preparing : t.online.next}
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-3" data-testid="join-reply">
          <p className="text-sm text-ink">
            {t.online.joinAs(
              pending.invite.campaignName,
              pending.invite.hostName,
              role.toLowerCase(),
            )}
          </p>
          <p className="text-xs text-ink-muted">{t.online.replyStep}</p>
          <p
            className="max-h-24 overflow-y-auto rounded-md bg-surface-2 p-2 font-mono text-[0.6875rem] break-all text-ink select-all"
            data-testid="reply-code"
          >
            {pending.replyCode}
          </p>
          <Button
            size="sm"
            icon={<Copy />}
            onClick={() => copyText(pending.replyCode).then(() => toast.success(t.online.copied))}
          >
            {t.online.copy}
          </Button>
          <p role="status" className="text-sm text-ink-muted">
            {error ?? t.online.waiting}
          </p>
        </div>
      )}
    </Dialog>
  )
}

/** Header of a guest: whose game this is, and the way out. */
export function GuestBadge() {
  const t = useT()
  const navigate = useNavigate()
  const { hostName, guestRole } = useOnlineStore()
  if (!hostName || !guestRole) return null
  return (
    <span className="flex items-center gap-2" data-testid="guest-badge">
      <span className="hidden rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-text sm:inline">
        {t.online.guestBar(
          hostName,
          guestRole === 'editor' ? t.online.roleEditor : t.online.rolePlayer,
        )}
      </span>
      <Button
        size="sm"
        variant="ghost"
        icon={<LogOut />}
        onClick={async () => {
          await leaveGuest()
          toast(t.online.leftSession)
          navigate('/')
        }}
      >
        {t.online.leave}
      </Button>
    </span>
  )
}
