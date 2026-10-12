import { Download, ShieldCheck, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { useCampaignActions } from '@/features/campaigns/useCampaignActions'
import { useT } from '@/i18n'

/** GDPR: what Codex keeps, data portability and erasure (D-240). */
export function PrivacySection() {
  const t = useT()
  const actions = useCampaignActions()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

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
      </details>

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
                await actions.eraseAll()
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
