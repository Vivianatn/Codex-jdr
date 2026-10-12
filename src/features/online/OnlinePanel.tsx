import * as Popover from '@radix-ui/react-popover'
import { Copy, Crown, Link2, UserPlus, UserRoundPen, Wifi, WifiOff, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button, IconButton } from '@/components/ui/Button'
import { TextAreaField } from '@/components/ui/TextField'
import { useCampaign } from '@/features/shell/campaignContext'
import { useT } from '@/i18n'
import { copyText } from '@/lib/clipboard'
import { cn } from '@/lib/cn'
import { hostSession, startHosting, stopHosting } from '@/online/controller'
import { useOnlineStore, type GuestRole, type PeerInfo } from '@/online/onlineStore'
import { InvalidCodeError } from '@/online/signaling'
import { useCampaignStore } from '@/stores/campaignStore'

/** Header button + non-blocking panel to share the campaign online (D-245). */
export function OnlinePanel() {
  const t = useT()
  const campaign = useCampaign()
  const hosting = useOnlineStore((s) => s.role === 'host' && s.campaignId === campaign.id)
  const peers = useOnlineStore((s) => s.peers)
  const connected = peers.filter((p) => p.status === 'connected').length

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button
          variant={hosting ? 'secondary' : 'ghost'}
          size="sm"
          icon={hosting ? <Wifi /> : <WifiOff />}
          data-testid="online-button"
        >
          <span className="sr-only sm:not-sr-only">{t.online.button}</span>
          {hosting && connected > 0 && <span className="tabular-nums">· {connected}</span>}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          collisionPadding={16}
          className="z-50 max-h-[calc(100dvh-5rem)] w-[400px] max-w-[calc(100vw-2rem)] space-y-4 overflow-y-auto rounded-xl border border-line bg-surface-raised p-4 shadow-lifted"
          data-testid="online-panel"
        >
          <div>
            <p className="type-eyebrow">{t.online.title}</p>
            <p className="mt-2 text-sm text-ink-muted">{t.online.hostIntro}</p>
          </div>
          {!hosting ? (
            <Button
              variant="primary"
              className="w-full"
              icon={<Wifi />}
              onClick={() => startHosting(campaign)}
            >
              {t.online.start}
            </Button>
          ) : (
            <Hosting peers={peers} />
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function Hosting({ peers }: { peers: PeerInfo[] }) {
  const t = useT()
  const [inviting, setInviting] = useState<GuestRole | null>(null)
  return (
    <div className="space-y-4">
      <Participants peers={peers} />
      {inviting ? (
        <Invite role={inviting} onDone={() => setInviting(null)} />
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon={<UserPlus />} onClick={() => setInviting('player')}>
            {t.online.invitePlayer}
          </Button>
          <Button size="sm" icon={<UserRoundPen />} onClick={() => setInviting('editor')}>
            {t.online.inviteEditor}
          </Button>
        </div>
      )}
      <p className="text-xs text-ink-muted">{t.online.stayHint}</p>
      <Button
        variant="ghost"
        size="sm"
        icon={<WifiOff />}
        onClick={() => {
          stopHosting()
          toast(t.online.stopped)
        }}
      >
        {t.online.stop}
      </Button>
    </div>
  )
}

function Participants({ peers }: { peers: PeerInfo[] }) {
  const t = useT()
  const entities = useCampaignStore((s) => s.entities)
  const operator = useCampaignStore((s) => s.play.live?.operator.id)
  const visible = peers.filter((p) => p.status !== 'closed' || p.name)
  return (
    <div>
      <p className="text-sm font-semibold text-ink">{t.online.participants}</p>
      <ul
        className="mt-1 divide-y divide-line rounded-lg border border-line"
        data-testid="participants"
      >
        <li className="flex items-center gap-2 px-3 py-2 text-sm text-ink">
          <Crown className="size-4 text-gold-text" aria-hidden />
          {t.online.you}
          {operator === 'host' && (
            <span className="text-xs text-ink-muted">· {t.online.operating}</span>
          )}
        </li>
        {visible.map((p) => (
          <li key={p.id} className="flex items-center gap-2 px-3 py-2 text-sm">
            <span
              className={cn(
                'size-2 shrink-0 rounded-full',
                p.status === 'connected' ? 'bg-heal' : 'bg-line-strong',
              )}
              aria-hidden
            />
            <span className="min-w-0 flex-1">
              <span className="text-ink">{p.name || '…'}</span>
              <span className="block text-xs text-ink-muted">
                {p.role === 'editor' ? t.online.roleEditor : t.online.rolePlayer} ·{' '}
                {t.online.status[p.status]}
                {p.characterIds.map(
                  (id) => entities[id] && ` · ${t.online.playsAs(entities[id].identity.pseudo)}`,
                )}
                {operator === p.id && ` · ${t.online.operating}`}
              </span>
            </span>
            <IconButton
              size="sm"
              label={t.online.removePeer(p.name)}
              icon={<X />}
              onClick={() => hostSession()?.remove(p.id)}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

/** One invitation: code to send, reply to paste. */
function Invite({ role, onDone }: { role: GuestRole; onDone: () => void }) {
  const t = useT()
  const [state, setState] = useState<{ peerId: string; code: string } | null>(null)
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // One invitation per panel, even when React runs the effect twice in development.
  const requested = useRef(false)
  useEffect(() => {
    if (requested.current) return
    requested.current = true
    hostSession()
      ?.invite(role)
      .then(setState, () => setError(t.online.failed))
  }, [role, t])

  return (
    <div className="space-y-3 rounded-lg border border-line bg-surface p-3" data-testid="invite">
      <p className="text-sm font-semibold text-ink">
        {t.online.inviteFor(role === 'editor' ? t.online.roleEditor : t.online.rolePlayer)}
      </p>
      {!state ? (
        <p className="text-sm text-ink-muted">{error ?? t.online.preparing}</p>
      ) : (
        <>
          <p className="text-xs text-ink-muted">{t.online.inviteStep}</p>
          <p
            className="max-h-24 overflow-y-auto rounded-md bg-surface-2 p-2 font-mono text-[0.6875rem] break-all text-ink select-all"
            data-testid="invite-code"
          >
            {state.code}
          </p>
          <Button
            size="sm"
            icon={<Copy />}
            onClick={() => copyText(state.code).then(() => toast.success(t.online.copied))}
          >
            {t.online.copy}
          </Button>
          <form
            className="space-y-2"
            onSubmit={async (e) => {
              e.preventDefault()
              setBusy(true)
              setError(null)
              try {
                await hostSession()?.accept(reply)
                onDone()
              } catch (err) {
                setError(err instanceof InvalidCodeError ? t.online.invalidCode : t.online.failed)
              } finally {
                setBusy(false)
              }
            }}
          >
            <TextAreaField
              label={t.online.replyLabel}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              spellCheck={false}
              error={error}
              className="font-mono text-xs"
            />
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  hostSession()?.remove(state.peerId)
                  onDone()
                }}
              >
                {t.online.cancelInvite}
              </Button>
              <Button
                size="sm"
                type="submit"
                variant="primary"
                icon={<Link2 />}
                disabled={busy || !reply.trim()}
              >
                {busy ? t.online.connecting : t.online.connect}
              </Button>
            </div>
          </form>
        </>
      )}
    </div>
  )
}
