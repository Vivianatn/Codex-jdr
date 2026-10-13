import { KeyRound } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { LogoMark, Ornament, Wordmark } from '@/components/Brand'
import { Button } from '@/components/ui/Button'
import { useT } from '@/i18n'
import { server } from '@/online/server/api'
import { checkPassword, MIN_PASSWORD_LENGTH } from '@/security/passwords'
import { signInErrorMessage } from './signInErrors'
import { PasswordField } from './PasswordField'

/**
 * The link of a password-reset e-mail (…/app/#/reinitialiser/TOKEN, D-262). The
 * new password is for the online account; the lock screen then signs in with
 * it (this device's copy follows).
 */
export function ResetPasswordPage() {
  const t = useT()
  const navigate = useNavigate()
  const { token = '' } = useParams()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <main
      id="main"
      className="flex min-h-full flex-col items-center justify-center px-4 py-10"
      data-testid="reset-password"
    >
      <div className="mb-6 flex items-center gap-2.5">
        <LogoMark />
        <Wordmark />
      </div>
      <form
        className="w-full max-w-[440px] space-y-5 rounded-xl border border-line bg-surface-raised p-6 shadow-overlay sm:p-8"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault()
          const problem = checkPassword(password)
          if (problem) return setError(t.account.errors[problem])
          if (password !== confirm) return setError(t.account.errors.passwordMismatch)
          setBusy(true)
          setError(null)
          try {
            await server.confirmReset(token, password)
            toast.success(t.account.online.resetDone)
            navigate('/', { replace: true })
          } catch (err) {
            setError(signInErrorMessage(t, err))
          } finally {
            setBusy(false)
          }
        }}
      >
        <div>
          <h1 className="type-screen-title text-[1.75rem] text-ink">
            {t.account.online.resetTitle}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">{t.account.online.resetSubtitle}</p>
          <Ornament className="mt-4" />
        </div>
        <PasswordField
          label={t.account.newPassword}
          hint={t.account.passwordHint(MIN_PASSWORD_LENGTH)}
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <PasswordField
          label={t.account.confirmPassword}
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={error}
        />
        <Button
          type="submit"
          variant="primary"
          className="w-full"
          icon={<KeyRound />}
          disabled={busy || !password || !confirm}
        >
          {t.account.online.resetSave}
        </Button>
      </form>
    </main>
  )
}
