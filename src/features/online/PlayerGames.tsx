import { DoorOpen, Link2, LogIn, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { GameIcon } from '@/components/GameIcon'
import { Button, IconButton } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { SettingsDialog } from '@/features/settings/SettingsDialog'
import { useT } from '@/i18n'
import { EnterError, enterGame, refreshOnline } from '@/online/controller'
import { guestHome } from '@/online/routes'
import { server } from '@/online/server/api'
import { useServerStore } from '@/online/server/serverStore'
import type { CampaignSummary } from '@shared/sync'
import { JoinDialog } from './JoinDialog'
import { onlineErrorMessage } from './onlineMessages'
import { ServerStatusLine } from './OnlinePanel'

/** « Mes parties »: the campaigns this account plays in, and the way in (D-257). */
export function PlayerGames() {
  const t = useT()
  const user = useServerStore((s) => s.user)
  const campaigns = useServerStore((s) => s.campaigns)
  const games = useMemo(() => campaigns.filter((c) => c.role === 'player'), [campaigns])
  const requests = useServerStore((s) => s.requests)
  const [joining, setJoining] = useState(false)
  const [settings, setSettings] = useState(false)

  if (!user)
    return (
      <EmptyState
        icon={<GameIcon name="tabletop-players" className="size-7" />}
        title={t.online.notLinkedTitle}
        body={t.online.notLinkedPlayer}
        actions={
          <>
            <Button variant="primary" icon={<Link2 />} onClick={() => setSettings(true)}>
              {t.online.openAccount}
            </Button>
            <SettingsDialog open={settings} onOpenChange={setSettings} />
          </>
        }
      />
    )

  const joinButton = (
    <Button variant="primary" icon={<LogIn />} onClick={() => setJoining(true)}>
      {t.online.join}
    </Button>
  )

  return (
    <div className="space-y-8" data-testid="player-games">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ServerStatusLine />
        {games.length > 0 && joinButton}
      </div>
      {games.length === 0 ? (
        <EmptyState
          icon={<GameIcon name="tabletop-players" className="size-7" />}
          title={t.online.myGamesEmptyTitle}
          body={t.online.myGamesEmptyBody}
          actions={joinButton}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </ul>
      )}
      {requests.length > 0 && (
        <section className="space-y-2">
          <h2 className="type-section text-ink">{t.online.myRequests}</h2>
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
            {requests.map((r) => (
              <li key={r.id} className="flex items-center gap-2 px-4 py-2 text-sm text-ink">
                <span className="min-w-0 flex-1">
                  {t.online.campaignBy(r.campaignName, r.ownerName)}
                </span>
                <IconButton
                  size="sm"
                  label={t.online.withdraw}
                  icon={<X />}
                  onClick={async () => {
                    try {
                      await server.decline(r.campaignId, r.id)
                      toast(t.online.withdrawn)
                      refreshOnline()
                    } catch (error) {
                      toast.error(onlineErrorMessage(t, error))
                    }
                  }}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
      <JoinDialog open={joining} onOpenChange={setJoining} />
    </div>
  )
}

function GameCard({ game }: { game: CampaignSummary }) {
  const t = useT()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const live = game.live?.mode === 'online' ? game.live : null
  return (
    <li
      className="flex min-h-36 flex-col gap-2 rounded-lg border border-line bg-surface p-5 shadow-soft"
      data-testid="player-game"
    >
      <span className="font-title text-[1.375rem] leading-snug font-semibold text-ink">
        {game.name}
      </span>
      <span className="text-sm text-ink-muted">{t.online.guestBar(game.ownerName)}</span>
      <span className="text-sm text-ink">
        {live ? t.online.liveBy(live.operatorName) : t.online.noLive}
      </span>
      <div className="mt-auto flex flex-wrap justify-between gap-2 pt-2">
        <Button size="sm" variant="ghost" onClick={() => setLeaving(true)}>
          {t.online.leaveCampaign}
        </Button>
        <Button
          size="sm"
          variant="primary"
          icon={<DoorOpen />}
          disabled={!live || busy}
          onClick={async () => {
            setBusy(true)
            try {
              const welcome = await enterGame(game.id)
              navigate(guestHome(welcome.campaignId))
            } catch (error) {
              toast.error(
                error instanceof EnterError
                  ? t.online.enterFailed[error.reason]
                  : onlineErrorMessage(t, error),
              )
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? t.online.entering : t.online.enter}
        </Button>
      </div>
      <Dialog
        open={leaving}
        onOpenChange={setLeaving}
        title={t.online.leaveCampaignTitle}
        description={t.online.leaveCampaignBody(game.name)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setLeaving(false)}>
              {t.common.cancel}
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                try {
                  await server.leaveCampaign(game.id)
                  refreshOnline()
                  setLeaving(false)
                } catch (error) {
                  toast.error(onlineErrorMessage(t, error))
                }
              }}
            >
              {t.online.leaveCampaign}
            </Button>
          </>
        }
      />
    </li>
  )
}
