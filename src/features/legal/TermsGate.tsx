import { Check, Download, LockKeyhole } from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Frame } from '@/features/account/LockScreen'
import { useT } from '@/i18n'
import { lockSession } from '@/security/session'
import type { TermsStatus } from '@shared/legal'
import {
  consentComplete,
  downloadAccountData,
  legalApi,
  needsTerms,
  type ConsentValue,
} from './legalApi'
import { TermsConsent } from './TermsConsent'

/**
 * Asks an online account to accept the current terms once (D-271): accounts
 * made before consent was recorded, or after the terms changed. While the
 * server cannot be reached, Codex opens as usual and asks next time.
 */
export function TermsGate({ userId, children }: { userId: string; children: ReactNode }) {
  // The answer for one account only: another account starts unchecked.
  const [checked, setChecked] = useState<{ userId: string; status: TermsStatus } | null>(null)
  const status = checked?.userId === userId ? checked.status : null
  const setStatus = (next: TermsStatus) => setChecked({ userId, status: next })
  useEffect(() => {
    let alive = true
    legalApi.terms().then(
      (s) => alive && setChecked({ userId, status: s }),
      () => {
        // Offline or signed out: never block the app on this check.
      },
    )
    return () => {
      alive = false
    }
  }, [userId])
  if (status && needsTerms(status))
    return <TermsPrompt changed={status.accepted !== null} onAccepted={setStatus} />
  return children
}

function TermsPrompt({
  changed,
  onAccepted,
}: {
  changed: boolean
  onAccepted: (status: TermsStatus) => void
}) {
  const t = useT()
  const [value, setValue] = useState<ConsentValue>({ accepted: false, age: null })
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSent(true)
    if (!consentComplete(value) || busy) return
    setBusy(true)
    setError(null)
    try {
      onAccepted(await legalApi.acceptTerms(value.age))
    } catch {
      setError(t.legal.gateFailed)
      setBusy(false)
    }
  }
  return (
    <Frame title={t.legal.gateTitle} subtitle={changed ? t.legal.gateChanged : t.legal.gateNew}>
      <form className="space-y-4" noValidate onSubmit={submit} data-testid="terms-gate">
        <TermsConsent value={value} onChange={setValue} showErrors={sent} />
        {error && (
          <p role="alert" className="text-sm font-medium text-hp-text">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" className="w-full" icon={<Check />} disabled={busy}>
          {t.legal.gateContinue}
        </Button>
        <Button
          variant="ghost"
          className="w-full"
          icon={<LockKeyhole />}
          onClick={() => void lockSession()}
        >
          {t.legal.gateLock}
        </Button>
        <p className="text-xs text-ink-muted">{t.legal.gateRefuseHint}</p>
        <Button
          size="sm"
          variant="ghost"
          className="w-full"
          icon={<Download />}
          onClick={() =>
            void downloadAccountData().then(
              () => toast.success(t.legal.downloaded),
              () => toast.error(t.legal.downloadFailed),
            )
          }
        >
          {t.legal.downloadData}
        </Button>
      </form>
    </Frame>
  )
}
