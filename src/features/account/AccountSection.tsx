import { KeyRound, LockKeyhole, Trash2, UserRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useIntlLocale, useT } from '@/i18n'
import { accounts, AUTO_LOCK_CHOICES, type AutoLockMinutes } from '@/security/accounts'
import { MIN_PASSWORD_LENGTH } from '@/security/passwords'
import { lockSession, updateSessionAccount, useSessionStore } from '@/security/session'
import { clearLocalPreferences } from '@/features/campaigns/useCampaignActions'
import { server } from '@/online/server/api'
import { accountErrorMessage } from './accountErrors'
import { PasswordField } from './PasswordField'
import { OnlineAccountSection } from './OnlineAccountSection'
import { RecoveryCodePanel } from './RecoveryCodePanel'

type Pending = 'none' | 'password' | 'code' | 'delete'

/** Settings › Compte: lock, auto-lock, password, recovery code, deletion (D-241). */
export function AccountSection() {
  const t = useT()
  const account = useSessionStore((s) => s.account)
  const [pending, setPending] = useState<Pending>('none')
  if (!account) return null
  const close = () => setPending('none')

  return (
    <section className="space-y-3" data-testid="account-section">
      <h3 className="flex items-center gap-2 font-sans text-sm font-medium tracking-normal text-ink">
        <UserRound className="size-4 text-ink-muted" aria-hidden />
        {t.account.account}
      </h3>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-muted">{t.account.signedInAs(account.username)}</p>
        <Button size="sm" icon={<LockKeyhole />} onClick={() => void lockSession()}>
          {t.account.lock}
        </Button>
      </div>

      <div className="space-y-1">
        <p className="text-sm text-ink">{t.account.autoLock}</p>
        <SegmentedControl<string>
          label={t.account.autoLock}
          value={String(account.autoLockMinutes)}
          onValueChange={async (v) => {
            const minutes = Number(v) as AutoLockMinutes
            await accounts.setAutoLock(account.id, minutes)
            updateSessionAccount({ autoLockMinutes: minutes })
          }}
          options={AUTO_LOCK_CHOICES.map((m) => ({
            value: String(m),
            label: t.account.autoLockChoice(m),
          }))}
        />
        <p className="text-xs text-ink-muted">{t.account.autoLockHint}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" icon={<KeyRound />} onClick={() => setPending('password')}>
          {t.account.changePassword}
        </Button>
        <Button size="sm" icon={<KeyRound />} onClick={() => setPending('code')}>
          {t.account.renewCode}
        </Button>
        <Button size="sm" variant="danger" icon={<Trash2 />} onClick={() => setPending('delete')}>
          {t.account.deleteAccount}
        </Button>
      </div>

      <ChangePasswordDialog open={pending === 'password'} accountId={account.id} onClose={close} />
      <RenewCodeDialog
        open={pending === 'code'}
        accountId={account.id}
        username={account.username}
        onClose={close}
      />
      <DeleteAccountDialog open={pending === 'delete'} accountId={account.id} onClose={close} />
      <OnlineAccountSection />
    </section>
  )
}

function useAccountForm() {
  const t = useT()
  const locale = useIntlLocale()
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
      setError(accountErrorMessage(t, e, locale))
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, setError, submit }
}

function ChangePasswordDialog({
  open,
  accountId,
  onClose,
}: {
  open: boolean
  accountId: string
  onClose: () => void
}) {
  const t = useT()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const { busy, error, setError, submit } = useAccountForm()
  const reset = () => {
    setCurrent('')
    setNext('')
    setConfirm('')
    setError(null)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && reset()} title={t.account.changePassword}>
      <form
        className="space-y-4"
        onSubmit={submit(async () => {
          if (next !== confirm) {
            setError(t.account.errors.passwordMismatch)
            return
          }
          await accounts.changePassword(accountId, current, next)
          // The online account keeps the same password (D-262).
          if (useSessionStore.getState().account?.online)
            await server
              .changePassword(current, next)
              .catch(() => toast.error(t.account.online.passwordNotChanged))
          toast.success(t.account.passwordChanged)
          reset()
        })}
      >
        <PasswordField
          label={t.account.currentPassword}
          autoComplete="current-password"
          required
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
        <PasswordField
          label={t.account.newPassword}
          hint={t.account.passwordHint(MIN_PASSWORD_LENGTH)}
          autoComplete="new-password"
          required
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
        <p className="text-xs text-ink-muted">{t.account.passwordAdvice}</p>
        <PasswordField
          label={t.account.confirmPassword}
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={error}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={reset}>
            {t.common.cancel}
          </Button>
          <Button type="submit" variant="primary" disabled={busy || !current || !next}>
            {t.account.confirm}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

function RenewCodeDialog({
  open,
  accountId,
  username,
  onClose,
}: {
  open: boolean
  accountId: string
  username: string
  onClose: () => void
}) {
  const t = useT()
  const [password, setPassword] = useState('')
  const [code, setCode] = useState<string | null>(null)
  const { busy, error, setError, submit } = useAccountForm()
  const reset = () => {
    setPassword('')
    setCode(null)
    setError(null)
    onClose()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && !code && reset()}
      title={t.account.renewCode}
      description={code ? undefined : t.account.renewCodeHint}
    >
      {code ? (
        <RecoveryCodePanel code={code} username={username} onDone={reset} />
      ) : (
        <form
          className="space-y-4"
          onSubmit={submit(async () => {
            setCode(await accounts.renewRecoveryCode(accountId, password))
            setPassword('')
          })}
        >
          <PasswordField
            label={t.account.currentPassword}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={error}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={reset}>
              {t.common.cancel}
            </Button>
            <Button type="submit" variant="primary" disabled={busy || !password}>
              {t.account.confirm}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  )
}

function DeleteAccountDialog({
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
  const { busy, error, setError, submit } = useAccountForm()
  const reset = () => {
    setPassword('')
    setError(null)
    onClose()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && reset()}
      title={`${t.account.deleteAccount} ?`}
      description={t.account.deleteAccountBody}
    >
      <form
        className="space-y-4"
        onSubmit={submit(async () => {
          // Check the password before locking, so a typo does not lock the session.
          await accounts.verify(accountId, password)
          await lockSession()
          await accounts.remove(accountId, password)
          clearLocalPreferences()
          toast.success(t.account.deleted)
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
          <Button variant="ghost" onClick={reset}>
            {t.common.cancel}
          </Button>
          <Button type="submit" variant="danger" disabled={busy || !password}>
            {t.account.deleteAccount}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
