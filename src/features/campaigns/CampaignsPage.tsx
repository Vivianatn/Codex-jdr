import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'framer-motion'
import { Plus, Upload } from 'lucide-react'
import { GameIcon } from '@/components/GameIcon'
import { useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { LogoMark, Ornament, Wordmark } from '@/components/Brand'
import { CandleDeskIllustration } from '@/components/illustrations'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { campaignRepository } from '@/db/campaigns'
import type { Campaign } from '@/db/types'
import { AppHeader } from '@/features/shell/AppHeader'
import { PageTransition } from '@/features/shell/PageTransition'
import { PlayerGames } from '@/features/online/PlayerGames'
import { useT } from '@/i18n'
import { useOnlineStore } from '@/online/onlineStore'
import { guestHome } from '@/online/routes'
import { useServerStore } from '@/online/server/serverStore'
import { useUiStore, type HomeMode } from '@/stores/uiStore'
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
  const guest = useOnlineStore((s) => (s.role === 'guest' ? s : null))
  const mode = useUiStore((s) => s.homeMode)
  const setMode = useUiStore((s) => s.setHomeMode)
  const serverCampaigns = useServerStore((s) => s.campaigns)

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

  // A player in a game sees that game only.
  if (guest?.campaignId && guest.guestRole)
    return <Navigate to={guestHome(guest.campaignId)} replace />

  // Every account plays both roles: GM of its campaigns, player in others' (D-257).
  const modeSwitch = (
    <SegmentedControl<HomeMode>
      label={t.online.modeLabel}
      value={mode}
      onValueChange={setMode}
      options={[
        { value: 'gm', label: t.online.modeGm, icon: <GameIcon name="crown" /> },
        { value: 'player', label: t.online.modePlayer, icon: <GameIcon name="tabletop-players" /> },
      ]}
    />
  )

  // A co-GM's copy is not theirs to delete: removing it leaves the campaign (D-262).
  const leaving =
    dialog.kind === 'delete' &&
    serverCampaigns.find((c) => c.id === dialog.campaign.id)?.role === 'editor'

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
              <h1 className="type-screen-title text-ink sm:text-[2.5rem]">
                {mode === 'player' ? t.online.myGames : t.campaigns.title}
              </h1>
              <p className="mt-2 text-ink-muted">
                {mode === 'player' ? t.online.myGamesHint : t.campaigns.subtitle}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {modeSwitch}
              {mode === 'gm' && campaigns && campaigns.length > 0 && (
                <>
                  {importButton}
                  {createButton}
                </>
              )}
            </div>
          </div>
          <Ornament className="mt-5 mb-10" />

          {mode === 'player' ? (
            <PlayerGames />
          ) : campaigns === undefined ? null : campaigns.length === 0 ? (
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
                  online={serverCampaigns.find((c) => c.id === campaign.id)}
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
        title={leaving ? t.online.leaveCampaignTitle : t.campaigns.deleteDialogTitle}
        description={
          dialog.kind !== 'delete'
            ? ''
            : leaving
              ? t.online.leaveCampaignBody(dialog.campaign.name)
              : t.campaigns.deleteDialogBody(dialog.campaign.name)
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
              {leaving ? t.online.leaveCampaign : t.common.delete}
            </Button>
          </>
        }
      />
    </div>
  )
}
