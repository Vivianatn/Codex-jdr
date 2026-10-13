import { Cloud, CloudOff, LogIn, Pencil, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { TextField } from '@/components/ui/TextField'
import { onlineErrorMessage } from '@/features/online/onlineMessages'
import { ServerStatusLine } from '@/features/online/OnlinePanel'
import { useT } from '@/i18n'
import {
  forgetOnline,
  LinkedElsewhereError,
  linkAccount,
  reconnect,
  renameOnline,
  unlinkAccount,
} from '@/online/controller'
import { server } from '@/online/server/api'
import { useServerStore } from '@/online/server/serverStore'
import { AccountError, accounts } from '@/security/accounts'
import { accountErrorMessage } from './accountErrors'
import { useSessionStore } from '@/security/session'
import { PasswordField } from './PasswordField'

/** Settings › Compte en ligne (D-262): link this local account, see the connection, leave. */
export function OnlineAccountSection() {
  const t = useT()
  const account = useSessionStore((s) => s.account)
  const status = useServerStore((s) => s.status)
  const [dialog, setDialog] = useState<'none' | 'rename' | 'unlink' | 'delete' | 'reconnect'>(
    'none',
  )
  if (!account) return null
  const close = () => setDialog('none')

  return (
    <section className="space-y-3" data-testid="online-account">
      <h3 className="flex items-center gap-2 font-sans text-sm font-medium tracking-normal text-ink">
        <Cloud className="size-4 text-ink-muted" aria-hidden />
        {t.account.online.title}
      </h3>
      {!account.online ? (
        <LinkForm username={account.username} />
      ) : (
        <>
          <p className="text-sm text-ink">
            {t.account.online.linkedAs(account.online.displayName, account.online.email)}
          </p>
          <ServerStatusLine />
          <div className="flex flex-wrap gap-2">
            {status === 'signedOut' && (
              <Button
                size="sm"
                variant="primary"
                icon={<LogIn />}
                onClick={() => setDialog('reconnect')}
              >
                {t.account.online.reconnect}
              </Button>
            )}
            <Button size="sm" icon={<Pencil />} onClick={() => setDialog('rename')}>
              {t.account.online.rename}
            </Button>
            <Button size="sm" icon={<CloudOff />} onClick={() => setDialog('unlink')}>
              {t.account.online.unlink}
            </Button>
            <Button
              size="sm"
              variant="danger"
              icon={<Trash2 />}
              onClick={() => setDialog('delete')}
            >
              {t.account.online.deleteOnline}
            </Button>
          </div>
          <RenameDialog
            open={dialog === 'rename'}
            current={account.online.displayName}
            onClose={close}
          />
          <ReconnectDialog open={dialog === 'reconnect'} onClose={close} />
          <Dialog
            open={dialog === 'unlink'}
            onOpenChange={(o) => !o && close()}
            title={`${t.account.online.unlink} ?`}
            description={t.account.online.unlinkHint}
            footer={
              <>
                <Button variant="ghost" onClick={close}>
                  {t.common.cancel}
                </Button>
                <Button
                  variant="danger"
                  onClick={async () => {
                    await unlinkAccount()
                    toast(t.account.online.unlinked)
                    close()
                  }}
                >
                  {t.account.online.unlink}
                </Button>
              </>
            }
          />
          <DeleteOnlineDialog open={dialog === 'delete'} accountId={account.id} onClose={close} />
        </>
      )}
    </section>
  )
}

/** Shared busy flag and error of the forms here. */
function useForm() {
  const t = useT()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = (task: () => Promise<void>) => async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await task()
    } catch (e) {
      setError(
        e instanceof LinkedElsewhereError
          ? t.online.errors.linkedElsewhere(e.username)
          : e instanceof AccountError
            ? accountErrorMessage(t, e)
            : onlineErrorMessage(t, e),
      )
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, setError, submit }
}

function LinkForm({ username }: { username: string }) {
  const t = useT()
  const [mode, setMode] = useState<'register' | 'login'>('register')
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState(username)
  const [password, setPassword] = useState('')
  const { busy, error, submit } = useForm()
  return (
    <form
      className="space-y-3"
      onSubmit={submit(async () => {
        const local = useSessionStore.getState().account!
        // The online account takes the local password: check it first.
        if (mode === 'register') await accounts.verify(local.id, password)
        await linkAccount(
          mode === 'register' ? { mode, email, password, displayName } : { mode, email, password },
        )
        setPassword('')
        toast.success(t.account.online.linked)
      })}
    >
      <p className="text-sm text-ink-muted">{t.account.online.intro}</p>
      <TextField
        label={t.account.online.email}
        hint={t.account.online.emailHint}
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      {mode === 'register' && (
        <TextField
          label={t.account.online.displayName}
          hint={t.account.online.displayNameHint}
          required
          maxLength={40}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      )}
      <PasswordField
        label={mode === 'register' ? t.account.currentPassword : t.account.password}
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={error}
      />
      {mode === 'register' && (
        <p className="text-xs text-ink-muted">{t.account.online.samePassword}</p>
      )}
      <div className="flex flex-wrap justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMode(mode === 'register' ? 'login' : 'register')}
        >
          {mode === 'register' ? t.account.online.haveOne : t.account.online.wantNew}
        </Button>
        <Button
          type="submit"
          size="sm"
          variant="primary"
          icon={<Cloud />}
          disabled={busy || !email || !password}
        >
          {busy
            ? mode === 'register'
              ? t.account.online.creating
              : t.account.online.signingIn
            : mode === 'register'
              ? t.account.online.create
              : t.account.online.signIn}
        </Button>
      </div>
    </form>
  )
}

function RenameDialog({
  open,
  current,
  onClose,
}: {
  open: boolean
  current: string
  onClose: () => void
}) {
  const t = useT()
  const [name, setName] = useState(current)
  const { busy, error, submit } = useForm()
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()} title={t.account.online.rename}>
      <form
        className="space-y-4"
        onSubmit={submit(async () => {
          await renameOnline(name)
          toast.success(t.account.online.renamed)
          onClose()
        })}
      >
        <TextField
          label={t.account.online.displayName}
          required
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={error}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button type="submit" variant="primary" disabled={busy || !name.trim()}>
            {t.account.confirm}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

function ReconnectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const [password, setPassword] = useState('')
  const { busy, error, submit } = useForm()
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()} title={t.account.online.reconnect}>
      <form
        className="space-y-4"
        onSubmit={submit(async () => {
          await reconnect(password)
          setPassword('')
          onClose()
        })}
      >
        <PasswordField
          label={t.account.password}
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button type="submit" variant="primary" disabled={busy || !password}>
            {t.account.online.signIn}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

function DeleteOnlineDialog({
  open,
  accountId,
  onClose,
}: {
  open: boolean
  accountId: string
  onClose: () => void
}) {
  const t = useT()
  const [password, setPassword] = useState('')
  const { busy, error, submit } = useForm()
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={`${t.account.online.deleteOnline} ?`}
      description={t.account.online.deleteOnlineBody}
    >
      <form
        className="space-y-4"
        onSubmit={submit(async () => {
          await server.deleteAccount(password)
          await forgetOnline(accountId)
          toast.success(t.account.online.deletedOnline)
          onClose()
        })}
      >
        <PasswordField
          label={t.account.password}
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button type="submit" variant="danger" disabled={busy || !password}>
            {t.account.online.deleteOnline}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
