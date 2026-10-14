import { Download, ShieldCheck, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useState } from 'react'
import { CheckboxField } from '@/components/ui/fields'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { useCampaignActions } from '@/features/campaigns/useCampaignActions'
import { useT } from '@/i18n'
import {
  ANALYTICS_WEBSITE_ID,
  analyticsChoice,
  browserRefusesTracking,
  setAnalyticsChoice,
} from '@/lib/analytics'

/** GDPR: what Codex keeps, data portability and erasure (D-240). */
export function PrivacySection() {
  const t = useT()
  const actions = useCampaignActions()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [measured, setMeasured] = useState(() => analyticsChoice() !== 'refused')

  return (
    <section className="space-y-3" data-testid="privacy-section">
      <h3 className="flex items-center gap-2 font-sans text-sm font-medium tracking-normal text-ink">
        <ShieldCheck className="size-4 text-ink-muted" aria-hidden />
        {t.privacy.title}
      </h3>
      <p className="text-sm text-ink-muted">{t.privacy.summary}</p>
      <details className="text-sm text-ink-muted">
        <summary className="cursor-pointer font-medium text-ink">{t.privacy.noticeToggle}</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {t.privacy.notice.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <a href="/confidentialite" className="mt-2 inline-block text-accent-text underline">
          {t.analytics.fullNotice}
        </a>
      </details>

      {ANALYTICS_WEBSITE_ID && !browserRefusesTracking() && (
        <CheckboxField
          label={t.analytics.setting}
          hint={t.analytics.settingHint}
          checked={measured}
          onChange={(checked) => {
            setAnalyticsChoice(checked ? 'accepted' : 'refused')
            setMeasured(checked)
          }}
        />
      )}

      <div className="space-y-1">
        <Button icon={<Download />} onClick={() => void actions.exportAllToFile()}>
          {t.privacy.exportAll}
        </Button>
        <p className="text-xs text-ink-muted">{t.privacy.exportAllHint}</p>
      </div>
      <div className="space-y-1">
        <Button variant="danger" icon={<Trash2 />} onClick={() => setConfirming(true)}>
          {t.privacy.eraseAll}
        </Button>
        <p className="text-xs text-ink-muted">{t.privacy.eraseAllHint}</p>
      </div>

      <Dialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t.privacy.eraseDialogTitle}
        description={t.privacy.eraseDialogBody}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              {t.common.cancel}
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  await actions.eraseAll()
                } catch (error) {
                  console.error(error)
                  toast.error(t.privacy.eraseFailed)
                  setBusy(false)
                }
              }}
              data-testid="erase-all-confirm"
            >
              {t.privacy.eraseConfirm}
            </Button>
          </>
        }
      />
    </section>
  )
}
