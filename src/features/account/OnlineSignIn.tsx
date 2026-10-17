import { Cloud, Mail } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { useT } from '@/i18n'
import { server } from '@/online/server/api'
import { registerOnline, signInOnline } from '@/online/server/signIn'
import type { AccountSummary } from '@/security/accounts'
import { checkPassword } from '@/security/passwords'
import { consentComplete, legalApi, type ConsentValue } from '@/features/legal/legalApi'
import { TermsConsent } from '@/features/legal/TermsConsent'
import { signInErrorMessage } from './signInErrors'
import { PasswordField } from './PasswordField'

function useSubmit() {
  const t = useT()
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
      setError(signInErrorMessage(t, e))
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, setError, run }
}

type Entered = (account: AccountSummary, key: Uint8Array) => Promise<void>

/** Lock screen: e-mail and password of an online account. */
export function OnlineSignInForm({ onEntered }: { onEntered: Entered }) {
  const t = useT()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { busy, error, run } = useSubmit()
  return (
    <form
      className="space-y-4"
      onSubmit={run(async () => {
        const { account, key } = await signInOnline(email, password)
        setPassword('')
        await onEntered(account, key)
      })}
    >
      <TextField
        label={t.account.online.email}
        type="email"
        autoComplete="email"
        autoFocus
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <PasswordField
        label={t.account.password}
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={error}
      />
      <Button
        type="submit"
        variant="primary"
        className="w-full"
        icon={<Cloud />}
        disabled={busy || !email || !password}
      >
        {busy ? t.account.online.signingIn : t.account.online.signIn}
      </Button>
    </form>
  )
}

/** Lock screen: a new online account (and its copy on this device). */
export function OnlineRegisterForm({
  onEntered,
  newPassword,
}: {
  onEntered: Entered
  /** The lock screen's new password + confirmation fields, with their checks. */
  newPassword: (props: {
    password: string
    confirm: string
    onPassword: (v: string) => void
    onConfirm: (v: string) => void
    username: string
    showErrors: boolean
  }) => ReactNode
}) {
  const t = useT()
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  // Honeypot (launch checklist point 18): people never see it, bots fill it in.
  const [website, setWebsite] = useState('')
  // Terms accepted and age declared (D-271), recorded on the server right after sign-up.
  const [consent, setConsent] = useState<ConsentValue>({ accepted: false, age: null })
  const [sent, setSent] = useState(false)
  const { busy, error, run } = useSubmit()
  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={run(async () => {
        setSent(true)
        if (checkPassword(password, displayName) || password !== confirm || website) return
        if (!consentComplete(consent)) return
        const { account, key } = await registerOnline({ email, displayName, password })
        // If this fails, the terms gate asks again once inside (never a lost account).
        await legalApi.acceptTerms(consent.age).catch(() => null)
        await onEntered(account, key)
      })}
    >
      <TextField
        label={t.account.online.email}
        hint={t.account.online.emailHint}
        type="email"
        autoComplete="email"
        autoFocus
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <TextField
        label={t.account.online.displayName}
        hint={t.account.online.displayNameHint}
        autoComplete="nickname"
        required
        maxLength={40}
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
      />
      <div className="hidden" aria-hidden>
        <label>
          Site web
          <input
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
      </div>
      {newPassword({
        password,
        confirm,
        onPassword: setPassword,
        onConfirm: setConfirm,
        username: displayName,
        showErrors: sent,
      })}
      <TermsConsent value={consent} onChange={setConsent} showErrors={sent} />
      {error && (
        <p role="alert" className="text-sm font-medium text-hp-text">
          {error}
        </p>
      )}
      <Button
        type="submit"
        variant="primary"
        className="w-full"
        icon={<Cloud />}
        disabled={busy || !email || !displayName.trim() || !password || !confirm}
      >
        {busy ? t.account.online.creating : t.account.online.create}
      </Button>
    </form>
  )
}

/** Lock screen: a reset link by e-mail. */
export function ForgotOnlineForm() {
  const t = useT()
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)
  const { busy, error, run } = useSubmit()
  if (done)
    return (
      <p role="status" className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink">
        {t.account.online.linkSent}
      </p>
    )
  return (
    <form
      className="space-y-4"
      onSubmit={run(async () => {
        await server.requestReset(email)
        setDone(true)
      })}
    >
      <TextField
        label={t.account.online.email}
        type="email"
        autoComplete="email"
        autoFocus
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={error ?? undefined}
      />
      <Button
        type="submit"
        variant="primary"
        className="w-full"
        icon={<Mail />}
        disabled={busy || !email}
      >
        {t.account.online.sendLink}
      </Button>
    </form>
  )
}
