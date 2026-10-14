import * as Popover from '@radix-ui/react-popover'
import { Copy, Link2, RefreshCw, Unlink, UserMinus, Wifi, WifiOff, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { GameIcon } from '@/components/GameIcon'
import { Button, IconButton } from '@/components/ui/Button'
import { CheckboxField, SelectField } from '@/components/ui/fields'
import { SettingsDialog } from '@/features/settings/SettingsDialog'
import { createLiveActions } from '@/features/game/liveActions'
import { useCampaign } from '@/features/shell/campaignContext'
import { useT } from '@/i18n'
import type { Messages } from '@/i18n/locales/fr'
import { copyText } from '@/lib/clipboard'
import { cn } from '@/lib/cn'
import { hostSession, refreshOnline, uploadCampaign } from '@/online/controller'
import { useOnlineStore } from '@/online/onlineStore'
import { server } from '@/online/server/api'
import { inviteUrl, onlineErrorMessage } from './onlineMessages'
import { useIsOnlineCampaign, useServerCampaign, useServerStore } from '@/online/server/serverStore'
import { selectEntitiesOfKinds, useCampaignStore } from '@/stores/campaignStore'
import type { JoinRequestInfo, MemberInfo, MemberRole } from '@shared/sync'

/** Header button + non-blocking panel: the campaign online (D-262). */
export function OnlinePanel() {
  const t = useT()
  const campaign = useCampaign()
  const user = useServerStore((s) => s.user)
  const status = useServerStore((s) => s.status)
  const online = useIsOnlineCampaign(campaign.id)
  const summary = useServerCampaign(campaign.id)
  const requests = summary?.pendingRequests ?? 0

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button
          variant={online ? 'secondary' : 'ghost'}
          size="sm"
          icon={online && status === 'online' ? <Wifi /> : <WifiOff />}
          data-testid="online-button"
        >
          <span className="sr-only sm:not-sr-only">{t.online.button}</span>
          {requests > 0 && (
            <span className="rounded-full bg-accent px-1.5 text-xs text-on-accent tabular-nums">
              {requests}
            </span>
          )}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          collisionPadding={16}
          className="z-50 max-h-[calc(100dvh-5rem)] w-[420px] max-w-[calc(100vw-2rem)] space-y-4 overflow-y-auto rounded-xl border border-line bg-surface-raised p-4 shadow-lifted"
          data-testid="online-panel"
        >
          <div>
            <p className="type-eyebrow">{t.online.title}</p>
            {user && <ServerStatusLine />}
          </div>
          {!user ? (
            <NotLinked />
          ) : !online ? (
            <PutOnline />
          ) : (
            <>
              <LiveSection />
              {summary?.role === 'owner' || summary?.role === 'editor' ? (
                <>
                  <Requests campaignId={campaign.id} role={summary.role} />
                  <Sharing campaignId={campaign.id} role={summary.role} />
                  <Members campaignId={campaign.id} role={summary.role} />
                </>
              ) : null}
            </>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/** Connected / offline, and what waits to be sent. */
export function ServerStatusLine() {
  const t = useT()
  const status = useServerStore((s) => s.status)
  const pending = useServerStore((s) => s.pending)
  return (
    <p className="mt-1 flex items-start gap-2 text-sm text-ink-muted" role="status">
      <span
        className={cn(
          'mt-1.5 size-2 shrink-0 rounded-full',
          status === 'online' ? 'bg-heal' : 'bg-line-strong',
        )}
        aria-hidden
      />
      <span>
        {t.online.status[status]}
        {pending > 0 && ` · ${t.online.pending(pending)}`}
      </span>
    </p>
  )
}

function NotLinked() {
  const t = useT()
  const [settings, setSettings] = useState(false)
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-ink">{t.online.notLinkedTitle}</p>
      <p className="text-sm text-ink-muted">{t.online.notLinkedBody}</p>
      <Button
        variant="primary"
        className="w-full"
        icon={<Link2 />}
        onClick={() => setSettings(true)}
      >
        {t.online.openAccount}
      </Button>
      <SettingsDialog open={settings} onOpenChange={setSettings} />
    </div>
  )
}

function PutOnline() {
  const t = useT()
  const campaign = useCampaign()
  const status = useServerStore((s) => s.status)
  const [busy, setBusy] = useState(false)
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-muted">{t.online.localOnly}</p>
      <Button
        variant="primary"
        className="w-full"
        icon={<Wifi />}
        disabled={busy || status !== 'online'}
        onClick={async () => {
          setBusy(true)
          try {
            await uploadCampaign(campaign.id)
            toast.success(t.online.putOnlineDone)
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy ? t.online.puttingOnline : t.online.putOnline}
      </Button>
    </div>
  )
}

/** Reads something from the server when the panel opens, and again when the campaign changes. */
function useServerData<T>(load: () => Promise<T>, key: unknown): [T | null, () => void] {
  const [data, setData] = useState<T | null>(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let alive = true
    load().then(
      (value) => alive && setData(value),
      () => {},
    )
    return () => {
      alive = false
    }
    // `load` is rebuilt each render; `key` and `tick` say when to read again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick])
  return [data, useCallback(() => setTick((n) => n + 1), [])]
}

/** Players' characters of the open campaign, for choosing one. */
function useCharacterOptions(t: Messages) {
  const entities = useCampaignStore((s) => s.entities)
  return useMemo(
    () => [
      { value: '', label: t.online.noCharacter },
      ...selectEntitiesOfKinds(entities, ['player']).map((e) => ({
        value: e.id,
        label: e.identity.pseudo,
      })),
    ],
    [entities, t],
  )
}

function LiveSection() {
  const t = useT()
  const campaign = useCampaign()
  const live = useCampaignStore((s) => s.play.live)
  const serving = useOnlineStore((s) => s.role === 'host')
  const peers = useOnlineStore((s) => s.peers)
  const entities = useCampaignStore((s) => s.entities)
  if (live?.mode !== 'online') return null
  const inGame = peers.filter((p) => p.status === 'connected')
  return (
    <section className="space-y-2" data-testid="online-live">
      <p className="text-sm font-semibold text-ink">{t.online.liveTitle}</p>
      <p className="text-xs text-ink-muted">
        {serving ? t.online.serving : t.sessions.operator(live.operator.name)}
      </p>
      {serving && (
        <CheckboxField
          label={t.sessions.listed}
          hint={t.sessions.listedHint}
          checked={live.listed}
          onChange={(listed) => createLiveActions(t, campaign).setListed(listed)}
        />
      )}
      {serving && (
        <ul
          className="divide-y divide-line rounded-lg border border-line"
          data-testid="participants"
        >
          {inGame.length === 0 && (
            <li className="px-3 py-2 text-sm text-ink-muted">{t.online.nobodyInGame}</li>
          )}
          {inGame.map((p) => (
            <li key={p.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <span className="size-2 shrink-0 rounded-full bg-heal" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="text-ink">{p.name}</span>
                {p.characterIds.map(
                  (id) =>
                    entities[id] && (
                      <span key={id} className="block text-xs text-ink-muted">
                        {t.online.playsAs(entities[id].identity.pseudo)}
                      </span>
                    ),
                )}
              </span>
              <IconButton
                size="sm"
                label={t.online.kick(p.name)}
                icon={<X />}
                onClick={() => hostSession()?.remove(p.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Requests({ campaignId, role }: { campaignId: string; role: MemberRole }) {
  const t = useT()
  const pending = useServerCampaign(campaignId)?.pendingRequests ?? 0
  const [data, reload] = useServerData(
    () => server.requests(campaignId),
    `${campaignId}:${pending}`,
  )
  const requests = data?.requests ?? []
  return (
    <section className="space-y-2" data-testid="join-requests">
      <p className="text-sm font-semibold text-ink">{t.online.requestsTitle}</p>
      {requests.length === 0 ? (
        <p className="text-xs text-ink-muted">{t.online.noRequests}</p>
      ) : (
        <ul className="space-y-2">
          {requests.map((r) => (
            <RequestRow
              key={r.id}
              campaignId={campaignId}
              request={r}
              role={role}
              onDone={reload}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function RequestRow({
  campaignId,
  request,
  role,
  onDone,
}: {
  campaignId: string
  request: JoinRequestInfo
  role: MemberRole
  onDone: () => void
}) {
  const t = useT()
  const characters = useCharacterOptions(t)
  const [as, setAs] = useState<'player' | 'editor'>('player')
  const [character, setCharacter] = useState('')
  const [busy, setBusy] = useState(false)
  const act = async (task: () => Promise<unknown>, done: string) => {
    setBusy(true)
    try {
      await task()
      toast.success(done)
      onDone()
      refreshOnline()
    } catch (error) {
      toast.error(onlineErrorMessage(t, error))
    } finally {
      setBusy(false)
    }
  }
  return (
    <li
      className="space-y-2 rounded-lg border border-line bg-surface p-3"
      data-testid="join-request"
    >
      <p className="text-sm text-ink">
        <strong className="font-semibold">{request.displayName}</strong>
        {request.message && (
          <span className="block text-xs text-ink-muted">
            {t.online.requestMessage(request.message)}
          </span>
        )}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {role === 'owner' && (
          <SelectField<'player' | 'editor'>
            label={t.online.role}
            value={as}
            onChange={setAs}
            options={[
              { value: 'player', label: t.online.rolePlayer },
              { value: 'editor', label: t.online.roleEditor },
            ]}
          />
        )}
        {as === 'player' && (
          <SelectField<string>
            label={t.online.character}
            value={character}
            onChange={setCharacter}
            options={characters}
          />
        )}
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() =>
            act(
              () => server.decline(campaignId, request.id),
              t.online.declined(request.displayName),
            )
          }
        >
          {t.online.decline}
        </Button>
        <Button
          size="sm"
          variant="primary"
          disabled={busy}
          onClick={() =>
            act(
              () =>
                server.accept(
                  campaignId,
                  request.id,
                  as,
                  as === 'player' && character ? character : null,
                ),
              t.online.accepted(request.displayName),
            )
          }
        >
          {t.online.accept}
        </Button>
      </div>
    </li>
  )
}

function Sharing({ campaignId, role }: { campaignId: string; role: MemberRole }) {
  const t = useT()
  const [data, reload] = useServerData(() => server.sharing(campaignId), campaignId)
  const [busy, setBusy] = useState(false)
  const run = async (task: () => Promise<unknown>, done?: string) => {
    setBusy(true)
    try {
      await task()
      if (done) toast.success(done)
      reload()
    } catch (error) {
      toast.error(onlineErrorMessage(t, error))
    } finally {
      setBusy(false)
    }
  }
  const code = data?.inviteCode ?? null
  return (
    <section className="space-y-2" data-testid="invite">
      <p className="text-sm font-semibold text-ink">{t.online.inviteTitle}</p>
      <p className="text-xs text-ink-muted">{t.online.inviteHint}</p>
      {code ? (
        <>
          <p
            className="rounded-md bg-surface-2 p-2 font-mono text-xs break-all text-ink select-all"
            data-testid="invite-link"
          >
            {inviteUrl(code)}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              icon={<Copy />}
              onClick={() => copyText(inviteUrl(code)).then(() => toast.success(t.online.copied))}
            >
              {t.online.copyLink}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={<RefreshCw />}
              disabled={busy}
              onClick={() => run(() => server.newInvite(campaignId), t.online.newLinkDone)}
            >
              {t.online.newLink}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={<Unlink />}
              disabled={busy}
              onClick={() => run(() => server.newInvite(campaignId, true))}
            >
              {t.online.disableLink}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs text-ink-muted">{data ? t.online.noLink : '…'}</p>
          <Button
            size="sm"
            variant="primary"
            icon={<Link2 />}
            disabled={busy || !data}
            onClick={() => run(() => server.newInvite(campaignId))}
          >
            {t.online.createLink}
          </Button>
        </>
      )}
      {role === 'owner' && data && (
        <CheckboxField
          label={t.online.listed}
          hint={t.online.listedHint}
          checked={data.listed}
          onChange={(listed) => void run(() => server.setListed(campaignId, listed))}
        />
      )}
    </section>
  )
}

function Members({ campaignId, role }: { campaignId: string; role: MemberRole }) {
  const t = useT()
  const summary = useServerCampaign(campaignId)
  const selfId = useOnlineStore((s) => s.selfId)
  const presence = useServerStore((s) => s.presence[campaignId])
  const operator = useCampaignStore((s) => s.play.live?.operator.id)
  const characters = useCharacterOptions(t)
  const [data, reload] = useServerData(
    () => server.members(campaignId),
    `${campaignId}:${summary?.pendingRequests}:${presence?.length}`,
  )
  const online = new Set((presence ?? []).map((u) => u.id))
  const roleName = (r: MemberRole) =>
    r === 'owner' ? t.online.roleOwner : r === 'editor' ? t.online.roleEditor : t.online.rolePlayer
  const canManage = (m: MemberInfo) =>
    m.role !== 'owner' && m.userId !== selfId && (role === 'owner' || m.role === 'player')
  const run = async (task: () => Promise<unknown>, done?: string) => {
    try {
      await task()
      if (done) toast.success(done)
      reload()
    } catch (error) {
      toast.error(onlineErrorMessage(t, error))
    }
  }
  return (
    <section className="space-y-2">
      <p className="text-sm font-semibold text-ink">{t.online.membersTitle}</p>
      <ul className="divide-y divide-line rounded-lg border border-line" data-testid="members">
        {(data?.members ?? []).map((m) => (
          <li key={m.userId} className="space-y-2 px-3 py-2 text-sm">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'size-2 shrink-0 rounded-full',
                  online.has(m.userId) ? 'bg-heal' : 'bg-line-strong',
                )}
                aria-hidden
              />
              {m.role === 'owner' && (
                <GameIcon name="crown" className="size-4 text-gold-text" aria-hidden />
              )}
              <span className="min-w-0 flex-1">
                <span className="text-ink">
                  {m.displayName}
                  {m.userId === selfId && ` (${t.online.you})`}
                </span>
                <span className="block text-xs text-ink-muted">
                  {roleName(m.role)}
                  {online.has(m.userId) && ` · ${t.online.connected}`}
                  {operator === m.userId && ` · ${t.online.operating}`}
                </span>
              </span>
              {canManage(m) && (
                <IconButton
                  size="sm"
                  label={t.online.removeMember(m.displayName)}
                  icon={<UserMinus />}
                  onClick={() =>
                    run(
                      () => server.removeMember(campaignId, m.userId),
                      t.online.removed(m.displayName),
                    )
                  }
                />
              )}
            </div>
            {canManage(m) && (
              <div className="grid gap-2 sm:grid-cols-2">
                {role === 'owner' && (
                  <SelectField<'player' | 'editor'>
                    label={t.online.role}
                    value={m.role === 'editor' ? 'editor' : 'player'}
                    onChange={(next) =>
                      run(() => server.updateMember(campaignId, m.userId, { role: next }))
                    }
                    options={[
                      { value: 'player', label: t.online.rolePlayer },
                      { value: 'editor', label: t.online.roleEditor },
                    ]}
                  />
                )}
                {m.role === 'player' && (
                  <SelectField<string>
                    label={t.online.characterOf(m.displayName)}
                    value={m.characterId ?? ''}
                    onChange={(id) =>
                      run(() =>
                        server.updateMember(campaignId, m.userId, { characterId: id || null }),
                      )
                    }
                    options={characters}
                  />
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
