import { History, RotateCcw, Save } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { backupService } from '@/db/backups'
import { useIntlLocale, useT } from '@/i18n'
import { flushAutosave, useCampaignStore } from '@/stores/campaignStore'

/** Settings › Sauvegardes: encrypted snapshots of every campaign (D-242). */
export function BackupsSection() {
  const t = useT()
  const locale = useIntlLocale()
  const backups = useLiveQuery(() => backupService.list(), [])
  const [restoring, setRestoring] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async (task: () => Promise<void>) => {
    setBusy(true)
    try {
      await task()
    } catch (error) {
      console.error(error)
      toast.error(t.errors.generic)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-3" data-testid="backups-section">
      <h3 className="flex items-center gap-2 font-sans text-sm font-medium tracking-normal text-ink">
        <History className="size-4 text-ink-muted" aria-hidden />
        {t.backups.title}
      </h3>
      <p className="text-sm text-ink-muted">{t.backups.hint}</p>
      {backups && backups.length === 0 && (
        <p className="text-sm text-ink-muted italic">{t.backups.empty}</p>
      )}
      {backups && backups.length > 0 && (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {backups.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="text-sm text-ink">
                {new Date(b.createdAt).toLocaleString(locale, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
                <span className="block text-xs text-ink-muted">
                  {t.backups.reason[b.reason]} · {t.backups.summary(b.campaignCount)}
                </span>
              </span>
              <Button
                size="sm"
                variant="ghost"
                icon={<RotateCcw />}
                disabled={busy}
                onClick={() => setRestoring(b.id)}
              >
                {t.backups.restore}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Button
        icon={<Save />}
        disabled={busy}
        onClick={() =>
          run(async () => {
            await flushAutosave()
            await backupService.create('manual')
            toast.success(t.backups.created)
          })
        }
      >
        {t.backups.create}
      </Button>

      <Dialog
        open={restoring !== null}
        onOpenChange={(open) => !open && setRestoring(null)}
        title={t.backups.restoreTitle}
        description={t.backups.restoreBody}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRestoring(null)}>
              {t.common.cancel}
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              data-testid="restore-confirm"
              onClick={() =>
                run(async () => {
                  const id = restoring!
                  // The open campaign is saved, then reloaded from the restored data.
                  const open = useCampaignStore.getState().campaignId
                  await useCampaignStore.getState().unload()
                  await backupService.restore(id)
                  if (open) await useCampaignStore.getState().load(open)
                  setRestoring(null)
                  toast.success(t.backups.restored)
                })
              }
            >
              {t.backups.restore}
            </Button>
          </>
        }
      />
    </section>
  )
}
