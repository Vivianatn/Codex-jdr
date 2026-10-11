import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'framer-motion'
import { Plus, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { LogoMark, Ornament, Wordmark } from '@/components/Brand'
import { CandleDeskIllustration } from '@/components/illustrations'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { campaignRepository } from '@/db/campaigns'
import type { Campaign } from '@/db/types'
import { AppHeader } from '@/features/shell/AppHeader'
import { PageTransition } from '@/features/shell/PageTransition'
import { useT } from '@/i18n'
import { useUiStore } from '@/stores/uiStore'
import { CampaignCard } from './CampaignCard'
import { CampaignFormDialog } from './CampaignFormDialog'
import { useCampaignActions } from './useCampaignActions'

type DialogState =
  | { kind: 'none' }
  | { kind: 'create' }
  | { kind: 'edit'; campaign: Campaign }
  | { kind: 'delete'; campaign: Campaign }

export function CampaignsPage() {
  const t = useT()
  const navigate = useNavigate()
  const actions = useCampaignActions()
  const forgetCampaign = useUiStore((s) => s.forgetCampaign)
  const campaigns = useLiveQuery(() => campaignRepository.list(), [])
  const [dialog, setDialog] = useState<DialogState>({ kind: 'none' })
  const fileInput = useRef<HTMLInputElement>(null)
  const close = () => setDialog({ kind: 'none' })

  const importButton = (
    <Button
      icon={<Upload />}
      onClick={() => fileInput.current?.click()}
      title={t.campaigns.importHint}
    >
      {t.campaigns.import}
    </Button>
  )
  const createButton = (
    <Button variant="primary" icon={<Plus />} onClick={() => setDialog({ kind: 'create' })}>
      {t.campaigns.new}
    </Button>
  )

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader
        start={
          <div className="flex items-center gap-2.5">
            <LogoMark />
            <Wordmark />
          </div>
        }
      />

      <PageTransition>
        <main id="main" className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-14 sm:px-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-2 type-eyebrow">{t.campaigns.welcome}</p>
              <h1 className="type-screen-title text-ink sm:text-[2.5rem]">{t.campaigns.title}</h1>
              <p className="mt-2 text-ink-muted">{t.campaigns.subtitle}</p>
            </div>
            {campaigns && campaigns.length > 0 && (
              <div className="flex gap-2">
                {importButton}
                {createButton}
              </div>
            )}
          </div>
          <Ornament className="mt-5 mb-10" />

          {campaigns === undefined ? null : campaigns.length === 0 ? (
            <EmptyState
              illustration={<CandleDeskIllustration label={t.illustrations.candle} />}
              title={t.campaigns.emptyTitle}
              body={t.campaigns.emptyBody}
              actions={
                <>
                  {createButton}
                  {importButton}
                </>
              }
            />
          ) : (
            <motion.ul
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              initial="hidden"
              animate="visible"
              variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
              aria-label={t.campaigns.title}
            >
              {campaigns.map((campaign) => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  onRename={() => setDialog({ kind: 'edit', campaign })}
                  onExport={() => void actions.exportToFile(campaign)}
                  onDelete={() => setDialog({ kind: 'delete', campaign })}
                />
              ))}
            </motion.ul>
          )}
        </main>
      </PageTransition>

      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        data-testid="campaign-import-input"
        aria-label={t.campaigns.importHint}
        onChange={async (event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) await actions.importFromFile(file)
        }}
      />

      <CampaignFormDialog
        open={dialog.kind === 'create'}
        onOpenChange={(open) => !open && close()}
        mode="create"
        onSubmit={async (values) => {
          const campaign = await actions.create(values)
          close()
          navigate(`/c/${campaign.id}`)
        }}
      />

      <CampaignFormDialog
        open={dialog.kind === 'edit'}
        onOpenChange={(open) => !open && close()}
        mode="edit"
        initial={dialog.kind === 'edit' ? dialog.campaign : undefined}
        onSubmit={async (values) => {
          if (dialog.kind !== 'edit') return
          await actions.update(dialog.campaign.id, values)
          close()
        }}
      />

      <Dialog
        open={dialog.kind === 'delete'}
        onOpenChange={(open) => !open && close()}
        title={t.campaigns.deleteDialogTitle}
        description={
          dialog.kind === 'delete' ? t.campaigns.deleteDialogBody(dialog.campaign.name) : ''
        }
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              {t.common.cancel}
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (dialog.kind !== 'delete') return
                await actions.remove(dialog.campaign)
                forgetCampaign(dialog.campaign.id)
                close()
              }}
            >
              {t.common.delete}
            </Button>
          </>
        }
      />
    </div>
  )
}
