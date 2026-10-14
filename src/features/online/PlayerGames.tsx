import { Check, DoorOpen, Link2, LogIn, Send, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { GameIcon } from '@/components/GameIcon'
import { Button, IconButton } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { SettingsDialog } from '@/features/settings/SettingsDialog'
import { useIntlLocale, useT } from '@/i18n'
import { EnterError, enterGame, refreshOnline } from '@/online/controller'
import { guestHome } from '@/online/routes'
import { server } from '@/online/server/api'
import { useServerStore } from '@/online/server/serverStore'
import type { CampaignSummary, OpenSession } from '@shared/sync'
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
  const sessions = useServerStore((s) => s.sessions)
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
      <section className="space-y-3" data-testid="open-sessions">
        <div>
          <h2 className="type-section text-ink">{t.online.openSessions}</h2>
          <p className="mt-1 text-sm text-ink-muted">{t.online.openSessionsHint}</p>
        </div>
        {sessions.length === 0 ? (
          <p className="text-sm text-ink-muted">{t.online.noOpenSessions}</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sessions.map((s) => (
              <SessionCard key={s.campaignId} session={s} />
            ))}
          </ul>
        )}
      </section>
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

/** Enters a campaign's running game; the player then picks a free character (PlayerScreen). */
function useEnterGame(campaignId: string) {
  const t = useT()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const enter = async () => {
    setBusy(true)
    try {
      const welcome = await enterGame(campaignId)
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
  }
  return { busy, enter }
}

/** An open session of the catalogue: ask to join in one click, then enter once accepted. */
function SessionCard({ session }: { session: OpenSession }) {
  const t = useT()
  const locale = useIntlLocale()
  const { busy, enter } = useEnterGame(session.campaignId)
  const [asking, setAsking] = useState(false)
  const time = new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(session.startedAt)
  return (
    <li
      className="flex min-h-36 flex-col gap-2 rounded-lg border border-line bg-surface p-5 shadow-soft"
      data-testid="open-session"
    >
      <span className="font-title text-[1.375rem] leading-snug font-semibold text-ink">
        {session.title || session.campaignName}
      </span>
      <span className="text-sm text-ink-muted">
        {t.online.campaignBy(session.campaignName, session.ownerName)}
      </span>
      <span className="text-sm text-ink">{t.online.sessionSince(time)}</span>
      <div className="mt-auto flex flex-wrap justify-end gap-2 pt-2">
        {session.status === 'member' ? (
          <Button size="sm" variant="primary" icon={<DoorOpen />} disabled={busy} onClick={enter}>
            {busy ? t.online.entering : t.online.enter}
          </Button>
        ) : session.status === 'requested' ? (
          <Button size="sm" variant="secondary" icon={<Check />} disabled>
            {t.online.asked}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="primary"
            icon={<Send />}
            disabled={asking}
            onClick={async () => {
              setAsking(true)
              try {
                await server.requestSession(session.campaignId)
                toast.success(t.online.requestSent)
                refreshOnline()
              } catch (error) {
                toast.error(onlineErrorMessage(t, error))
              } finally {
                setAsking(false)
              }
            }}
          >
            {t.online.askToJoin}
          </Button>
        )}
      </div>
    </li>
  )
}

function GameCard({ game }: { game: CampaignSummary }) {
  const t = useT()
  const { busy, enter } = useEnterGame(game.id)
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
          onClick={enter}
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
