import { useLiveQuery } from 'dexie-react-hooks'
import { Cloud, LockKeyhole, LogIn, ShieldCheck, UserPlus } from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { toast } from 'sonner'
import { LogoMark, Ornament, Wordmark } from '@/components/Brand'
import { Button } from '@/components/ui/Button'
import { SelectField } from '@/components/ui/fields'
import { TextField } from '@/components/ui/TextField'
import { accountDbName, CodexDB } from '@/db/db'
import { useIntlLocale, useT } from '@/i18n'
import {
  accounts,
  legacyCampaignCount,
  migrateLegacyData,
  type AccountSummary,
} from '@/security/accounts'
import { checkPassword, MIN_PASSWORD_LENGTH } from '@/security/passwords'
import { startSession, useSessionStore } from '@/security/session'
import { accountErrorMessage } from './accountErrors'
import { PasswordField } from './PasswordField'
import { ForgotOnlineForm, OnlineRegisterForm, OnlineSignInForm } from './OnlineSignIn'
import { RecoveryCodePanel } from './RecoveryCodePanel'

type Mode =
  | { kind: 'welcome' }
  | { kind: 'login' }
  | { kind: 'create' }
  | { kind: 'recover' }
  | { kind: 'onlineSignIn' }
  | { kind: 'onlineRegister' }
  | { kind: 'onlineForgot' }
  | { kind: 'code'; code: string; account: AccountSummary; key: Uint8Array }

/** Login, account creation and password recovery (D-241). Full page, before anything else. */
export function LockScreen() {
  const t = useT()
  const list = useLiveQuery(() => accounts.list(), [])
  const [mode, setMode] = useState<Mode | null>(null)
  // No account on this device yet: ask first whether to create one or bring back an existing one.
  const current: Mode = mode ?? (list && list.length === 0 ? { kind: 'welcome' } : { kind: 'login' })

  const enter = async (account: AccountSummary, key: Uint8Array) => {
    useSessionStore.setState({ status: 'unlocking' })
    try {
      await startSession(account, key)
    } catch (error) {
      console.error(error)
      useSessionStore.setState({ status: 'locked' })
      toast.error(t.account.errors.generic)
    }
  }

  if (list === undefined) return <Frame>{null}</Frame>

  if (current.kind === 'code')
    return (
      <Frame>
        <RecoveryCodePanel
          code={current.code}
          username={current.account.username}
          onDone={() => void enter(current.account, current.key)}
        />
      </Frame>
    )

  const back = (
    <Button variant="ghost" className="w-full" onClick={() => setMode(null)}>
      {list.length ? t.account.backToLogin : t.common.back}
    </Button>
  )
  const onlineButton = (
    <Button
      variant="secondary"
      className="w-full"
      icon={<Cloud />}
      onClick={() => setMode({ kind: 'onlineSignIn' })}
    >
      {t.account.online.lockSignIn}
    </Button>
  )

  if (current.kind === 'welcome')
    return (
      <Frame title={t.account.welcomeTitle} subtitle={t.account.welcomeChoice}>
        <Button
          variant="primary"
          className="w-full"
          icon={<UserPlus />}
          onClick={() => setMode({ kind: 'create' })}
        >
          {t.account.welcomeCreate}
        </Button>
        <div className="space-y-2">
          <Button
            variant="secondary"
            className="w-full"
            icon={<LogIn />}
            onClick={() => setMode({ kind: 'onlineSignIn' })}
          >
            {t.account.welcomeExisting}
          </Button>
          <p className="text-xs text-ink-muted">{t.account.welcomeExistingHint}</p>
        </div>
      </Frame>
    )

  if (current.kind === 'onlineSignIn')
    return (
      <Frame
        title={t.account.online.lockSignInTitle}
        subtitle={t.account.online.lockSignInSubtitle}
      >
        <OnlineSignInForm onEntered={enter} />
        <div className="flex flex-wrap justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => setMode({ kind: 'onlineForgot' })}>
            {t.account.online.forgot}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setMode({ kind: 'onlineRegister' })}>
            {t.account.online.wantNew}
          </Button>
        </div>
        {back}
      </Frame>
    )

  if (current.kind === 'onlineRegister')
    return (
      <Frame
        title={t.account.online.lockRegisterTitle}
        subtitle={t.account.online.lockRegisterSubtitle}
      >
        <OnlineRegisterForm
          onEntered={enter}
          newPassword={(props) => <NewPasswordFields label={t.account.password} {...props} />}
        />
        {back}
      </Frame>
    )

  if (current.kind === 'onlineForgot')
    return (
      <Frame title={t.account.online.forgotTitle} subtitle={t.account.online.forgotSubtitle}>
        <ForgotOnlineForm />
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => setMode({ kind: 'onlineSignIn' })}
        >
          {t.common.back}
        </Button>
      </Frame>
    )

  if (current.kind === 'create')
    return (
      <Frame
        title={list.length ? t.account.createAnother : t.account.createTitle}
        subtitle={t.account.welcomeSubtitle}
      >
        <CreateForm
          onCreated={(code, account, key) => setMode({ kind: 'code', code, account, key })}
        />
        <Button
          variant="secondary"
          className="w-full"
          icon={<Cloud />}
          onClick={() => setMode({ kind: 'onlineRegister' })}
        >
          {t.account.online.wantNew}
        </Button>
        {back}
      </Frame>
    )

  if (current.kind === 'recover')
    return (
      <Frame title={t.account.recoverTitle} subtitle={t.account.recoverSubtitle}>
        <RecoverForm
          accounts={list}
          onRecovered={(code, account, key) => setMode({ kind: 'code', code, account, key })}
        />
        <Button variant="ghost" className="w-full" onClick={() => setMode({ kind: 'login' })}>
          {t.account.backToLogin}
        </Button>
      </Frame>
    )

  return (
    <Frame title={t.account.lockTitle} subtitle={t.account.lockSubtitle}>
      <LoginForm accounts={list} onUnlocked={enter} />
      {onlineButton}
      <div className="flex flex-wrap justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => setMode({ kind: 'recover' })}>
          {t.account.forgot}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setMode({ kind: 'create' })}>
          {t.account.createAnother}
        </Button>
      </div>
    </Frame>
  )
}

function Frame({
  title,
  subtitle,
  children,
}: {
  title?: string
  subtitle?: string
  children: ReactNode
}) {
  const t = useT()
  return (
    <main
      id="main"
      className="flex min-h-full flex-col items-center justify-center px-4 py-10"
      data-testid="lock-screen"
    >
      <div className="mb-6 flex items-center gap-2.5">
        <LogoMark />
        <Wordmark />
      </div>
      <div className="w-full max-w-[440px] space-y-5 rounded-xl border border-line bg-surface-raised p-6 shadow-overlay sm:p-8">
        {title && (
          <div>
            <h1 className="type-screen-title text-[1.75rem] text-ink">{title}</h1>
            {subtitle && <p className="mt-2 text-sm text-ink-muted">{subtitle}</p>}
            <Ornament className="mt-4" />
          </div>
        )}
        {children}
      </div>
      <p className="mt-6 flex max-w-[440px] items-start gap-2 text-xs text-ink-muted">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>{t.privacy.summary}</span>
      </p>
    </main>
  )
}

/** Shared state of the three forms: busy flag and error message. */
function useSubmit() {
  const t = useT()
  const locale = useIntlLocale()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = (task: () => Promise<void>) => async (event: FormEvent) => {
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
  return { busy, error, setError, run }
}

function AccountPicker({
  accounts: list,
  value,
  onChange,
}: {
  accounts: AccountSummary[]
  value: string
  onChange: (id: string) => void
}) {
  const t = useT()
  if (list.length === 1)
    return (
      <p className="text-sm text-ink">
        <span className="text-ink-muted">{t.account.account} : </span>
        <strong className="font-semibold">{list[0]!.username}</strong>
      </p>
    )
  return (
    <SelectField
      label={t.account.account}
      value={value}
      onChange={onChange}
      options={list.map((a) => ({ value: a.id, label: a.username }))}
    />
  )
}

function LoginForm({
  accounts: list,
  onUnlocked,
}: {
  accounts: AccountSummary[]
  onUnlocked: (account: AccountSummary, key: Uint8Array) => Promise<void>
}) {
  const t = useT()
  const [accountId, setAccountId] = useState(list[0]?.id ?? '')
  const [password, setPassword] = useState('')
  const { busy, error, run } = useSubmit()
  const username = list.find((a) => a.id === accountId)?.username ?? ''

  return (
    <form
      className="space-y-4"
      onSubmit={run(async () => {
        const { account, key } = await accounts.unlock(accountId, password)
        setPassword('')
        await onUnlocked(account, key)
      })}
    >
      <AccountPicker accounts={list} value={accountId} onChange={setAccountId} />
      {/* Lets password managers pair the password with the account. */}
      <input type="text" hidden readOnly autoComplete="username" value={username} />
      <PasswordField
        label={t.account.password}
        autoComplete="current-password"
        autoFocus
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={error}
      />
      <Button
        type="submit"
        variant="primary"
        className="w-full"
        icon={<LockKeyhole />}
        disabled={busy || !password}
      >
        {busy ? t.account.unlocking : t.account.unlock}
      </Button>
    </form>
  )
}

/** First problem of a new password and its confirmation, as messages (null = fine). */
function newPasswordProblems(
  t: ReturnType<typeof useT>,
  password: string,
  confirm: string,
  username = '',
): { password: string | null; confirm: string | null } {
  const problem = checkPassword(password, username)
  return {
    password: problem ? t.account.errors[problem] : null,
    confirm: confirm !== password ? t.account.errors.passwordMismatch : null,
  }
}

/**
 * New password + confirmation, checked as you go (checklist point 17): each
 * field says what is wrong once you leave it, or when the form is sent.
 */
function NewPasswordFields({
  password,
  confirm,
  onPassword,
  onConfirm,
  label,
  username,
  showErrors,
}: {
  password: string
  confirm: string
  onPassword: (v: string) => void
  onConfirm: (v: string) => void
  label: string
  username?: string
  /** The form was sent: show every problem. */
  showErrors: boolean
}) {
  const t = useT()
  const [left, setLeft] = useState({ password: false, confirm: false })
  const problems = newPasswordProblems(t, password, confirm, username)
  return (
    <>
      <PasswordField
        label={label}
        hint={t.account.passwordHint(MIN_PASSWORD_LENGTH)}
        autoComplete="new-password"
        required
        value={password}
        error={(showErrors || left.password) && password ? problems.password : null}
        onBlur={() => setLeft((l) => ({ ...l, password: true }))}
        onChange={(e) => onPassword(e.target.value)}
      />
      <p className="text-xs text-ink-muted">{t.account.passwordAdvice}</p>
      <PasswordField
        label={t.account.confirmPassword}
        autoComplete="new-password"
        required
        value={confirm}
        error={(showErrors || left.confirm) && confirm ? problems.confirm : null}
        onBlur={() => setLeft((l) => ({ ...l, confirm: true }))}
        onChange={(e) => onConfirm(e.target.value)}
      />
    </>
  )
}

function CreateForm({
  onCreated,
}: {
  onCreated: (code: string, account: AccountSummary, key: Uint8Array) => void
}) {
  const t = useT()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [legacy, setLegacy] = useState(0)
  const [sent, setSent] = useState(false)
  const { busy, error, run } = useSubmit()

  useEffect(() => {
    legacyCampaignCount().then(setLegacy, () => setLegacy(0))
  }, [])

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={run(async () => {
        setSent(true)
        const problems = newPasswordProblems(t, password, confirm, username)
        if (problems.password || problems.confirm) return
        const { account, key, recoveryCode } = await accounts.create({ username, password })
        if (legacy > 0) {
          const db = new CodexDB(accountDbName(account.id), { key })
          try {
            await migrateLegacyData(db)
          } catch (e) {
            console.error(e)
            toast.error(t.account.legacyFailed)
          } finally {
            db.close()
          }
        }
        onCreated(recoveryCode, account, key)
      })}
    >
      <TextField
        label={t.account.username}
        hint={t.account.usernameHint}
        autoComplete="username"
        autoFocus
        required
        maxLength={40}
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <NewPasswordFields
        label={t.account.password}
        password={password}
        confirm={confirm}
        onPassword={setPassword}
        onConfirm={setConfirm}
        username={username}
        showErrors={sent}
      />
      {legacy > 0 && (
        <p className="rounded-xl bg-gold-soft px-3 py-2 text-sm text-ink">
          {t.account.legacyNotice(legacy)}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm font-medium text-hp-text">
          {error}
        </p>
      )}
      <Button
        type="submit"
        variant="primary"
        className="w-full"
        disabled={busy || !username.trim() || !password || !confirm}
      >
        {busy ? t.account.creating : t.account.create}
      </Button>
    </form>
  )
}

function RecoverForm({
  accounts: list,
  onRecovered,
}: {
  accounts: AccountSummary[]
  onRecovered: (code: string, account: AccountSummary, key: Uint8Array) => void
}) {
  const t = useT()
  const [accountId, setAccountId] = useState(list[0]?.id ?? '')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [sent, setSent] = useState(false)
  const { busy, error, run } = useSubmit()
  const username = list.find((a) => a.id === accountId)?.username

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={run(async () => {
        setSent(true)
        const problems = newPasswordProblems(t, password, confirm, username)
        if (problems.password || problems.confirm) return
        const { account, key, recoveryCode } = await accounts.recover(accountId, code, password)
        onRecovered(recoveryCode, account, key)
      })}
    >
      <AccountPicker accounts={list} value={accountId} onChange={setAccountId} />
      <TextField
        label={t.account.recoveryCode}
        autoComplete="off"
        spellCheck={false}
        required
        inputClassName="font-mono uppercase tracking-wider"
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
      <NewPasswordFields
        label={t.account.newPassword}
        password={password}
        confirm={confirm}
        onPassword={setPassword}
        onConfirm={setConfirm}
        username={username}
        showErrors={sent}
      />
      {error && (
        <p role="alert" className="text-sm font-medium text-hp-text">
          {error}
        </p>
      )}
      <Button
        type="submit"
        variant="primary"
        className="w-full"
        disabled={busy || !code || !password || !confirm}
      >
        {busy ? t.account.creating : t.account.recover}
      </Button>
    </form>
  )
}
