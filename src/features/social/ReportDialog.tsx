import { Flag, Send } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { CheckboxField, SelectField } from '@/components/ui/fields'
import { TextAreaField } from '@/components/ui/TextField'
import { onlineErrorMessage } from '@/features/online/onlineMessages'
import { legalApi } from '@/features/legal/legalApi'
import { useT } from '@/i18n'
import {
  REPORT_CATEGORIES,
  REPORT_EXPLANATION_MAX,
  REPORT_EXPLANATION_MIN,
  type ReportCategory,
} from '@shared/legal'

/**
 * « Signaler » on someone's profile (DSA art. 16, D-271): a reason, an
 * explanation, a good-faith statement; anonymous only for child sexual abuse.
 * Outside play, so a dialog is allowed.
 */
export function ReportButton({ userId, name }: { userId: string; name: string }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="ghost" size="sm" icon={<Flag />} onClick={() => setOpen(true)}>
        {t.legal.report}
      </Button>
      {open && <ReportDialog userId={userId} name={name} onClose={() => setOpen(false)} />}
    </>
  )
}

function ReportDialog({
  userId,
  name,
  onClose,
}: {
  userId: string
  name: string
  onClose: () => void
}) {
  const t = useT()
  const [category, setCategory] = useState<ReportCategory>('harassment')
  const [explanation, setExplanation] = useState('')
  const [goodFaith, setGoodFaith] = useState(false)
  const [anonymous, setAnonymous] = useState(false)
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tooShort = explanation.trim().length < REPORT_EXPLANATION_MIN
  const canBeAnonymous = category === 'childAbuse'

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSent(true)
    if (tooShort || !goodFaith || busy) return
    setBusy(true)
    setError(null)
    try {
      const asAnonymous = canBeAnonymous && anonymous
      const { reference } = await legalApi.report({
        targetId: userId,
        category,
        explanation: explanation.trim(),
        anonymous: asAnonymous,
      })
      toast.success(
        asAnonymous ? t.legal.reportSentAnonymous(reference) : t.legal.reportSent(reference),
      )
      onClose()
    } catch (e) {
      setError(onlineErrorMessage(t, e))
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`${t.legal.reportTitle} · ${name}`}
      description={t.legal.reportIntro}
    >
      <form className="space-y-4" noValidate onSubmit={submit} data-testid="report-dialog">
        <SelectField<ReportCategory>
          label={t.legal.reportCategory}
          value={category}
          onChange={setCategory}
          options={(REPORT_CATEGORIES as ReportCategory[]).map((c) => ({
            value: c,
            label: t.legal.categories[c],
          }))}
        />
        {(category === 'childAbuse' || category === 'terrorism') && (
          <p className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning-text">
            {t.legal.reportPharos}
          </p>
        )}
        <TextAreaField
          label={t.legal.reportExplanation}
          hint={t.legal.reportExplanationHint(REPORT_EXPLANATION_MIN, REPORT_EXPLANATION_MAX)}
          required
          maxLength={REPORT_EXPLANATION_MAX}
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          error={sent && tooShort ? t.legal.reportExplanationShort(REPORT_EXPLANATION_MIN) : null}
        />
        {canBeAnonymous && (
          <CheckboxField
            label={t.legal.reportAnonymous}
            hint={t.legal.reportAnonymousHint}
            checked={anonymous}
            onChange={setAnonymous}
          />
        )}
        <div className="space-y-1">
          <CheckboxField
            label={t.legal.reportGoodFaith}
            checked={goodFaith}
            onChange={setGoodFaith}
          />
          {sent && !goodFaith && (
            <p role="alert" className="text-[0.8125rem] font-medium text-hp-text">
              {t.legal.reportGoodFaithRequired}
            </p>
          )}
        </div>
        {error && (
          <p role="alert" className="text-sm font-medium text-hp-text">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button type="submit" variant="primary" icon={<Send />} disabled={busy}>
            {t.legal.reportSend}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
