import { LogOut, Search, Send } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { TextAreaField, TextField } from '@/components/ui/TextField'
import { useT } from '@/i18n'
import { leaveGuest, refreshOnline } from '@/online/controller'
import { useOnlineStore } from '@/online/onlineStore'
import { server } from '@/online/server/api'
import type { InvitePreview } from '@shared/sync'
import { onlineErrorMessage, inviteCodeOf } from './onlineMessages'

/** « Rejoindre une campagne »: an invitation link, or a search by name (D-257). */
export function JoinDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const t = useT()
  const [link, setLink] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<InvitePreview[] | null>(null)
  const [found, setFound] = useState<{ preview: InvitePreview; code: string | null } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const close = (o: boolean) => {
    if (!o) {
      setLink('')
      setQuery('')
      setResults(null)
      setFound(null)
      setError(null)
    }
    onOpenChange(o)
  }

  const run = async (task: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await task()
    } catch (e) {
      setError(onlineErrorMessage(t, e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={close} title={t.online.join} description={t.online.joinIntro}>
      {found ? (
        <RequestForm
          preview={found.preview}
          code={found.code}
          onBack={() => setFound(null)}
          onSent={() => close(false)}
        />
      ) : (
        <div className="space-y-5">
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault()
              const code = inviteCodeOf(link)
              setBusy(true)
              setError(null)
              server
                .invite(code)
                .then(
                  (preview) => setFound({ preview, code }),
                  () => setError(t.online.invalidInvite),
                )
                .finally(() => setBusy(false))
            }}
          >
            <TextField
              label={t.online.inviteLabel}
              value={link}
              onChange={(e) => setLink(e.target.value)}
              spellCheck={false}
            />
            <div className="flex justify-end">
              <Button type="submit" variant="primary" disabled={busy || !link.trim()}>
                {t.online.lookUp}
              </Button>
            </div>
          </form>
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault()
              void run(async () => setResults((await server.search(query)).results))
            }}
          >
            <TextField
              label={t.online.searchLabel}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="flex justify-end">
              <Button type="submit" icon={<Search />} disabled={busy || query.trim().length < 2}>
                {busy ? t.online.searching : t.online.search}
              </Button>
            </div>
            {results &&
              (results.length === 0 ? (
                <p className="text-sm text-ink-muted">{t.online.noResults}</p>
              ) : (
                <ul className="divide-y divide-line rounded-lg border border-line">
                  {results.map((r) => (
                    <li key={r.campaignId}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm text-ink hover:bg-surface-2"
                        onClick={() => setFound({ preview: r, code: null })}
                      >
                        {t.online.campaignBy(r.campaignName, r.ownerName)}
                      </button>
                    </li>
                  ))}
                </ul>
              ))}
          </form>
          {error && (
            <p role="alert" className="text-sm font-medium text-hp-text">
              {error}
            </p>
          )}
        </div>
      )}
    </Dialog>
  )
}

/** A campaign found: say a word to its GM and ask to join. */
export function RequestForm({
  preview,
  code,
  onBack,
  onSent,
}: {
  preview: InvitePreview
  /** Invitation code, or null for a listed campaign found by name. */
  code: string | null
  onBack?: () => void
  onSent: () => void
}) {
  const t = useT()
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <form
      className="space-y-3"
      data-testid="join-request-form"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setError(null)
        try {
          if (code) await server.requestByInvite(code, message)
          else await server.requestListed(preview.campaignId, message)
          toast.success(t.online.requestSent)
          refreshOnline()
          onSent()
        } catch (err) {
          setError(onlineErrorMessage(t, err))
        } finally {
          setBusy(false)
        }
      }}
    >
      <p className="text-sm text-ink">
        {t.online.campaignBy(preview.campaignName, preview.ownerName)}
      </p>
      {preview.status === 'none' ? (
        <>
          <TextAreaField
            label={t.online.messageLabel}
            placeholder={t.online.messagePlaceholder}
            value={message}
            maxLength={500}
            onChange={(e) => setMessage(e.target.value)}
          />
          {error && (
            <p role="alert" className="text-sm font-medium text-hp-text">
              {error}
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-ink-muted">
          {preview.status === 'member' ? t.online.alreadyMember : t.online.alreadyRequested}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        {onBack && (
          <Button variant="ghost" onClick={onBack}>
            {t.common.back}
          </Button>
        )}
        {preview.status === 'none' && (
          <Button type="submit" variant="primary" icon={<Send />} disabled={busy}>
            {t.online.request}
          </Button>
        )}
      </div>
    </form>
  )
}

/** Header of a player in a game: whose game this is, and the way out. */
export function GuestBadge() {
  const t = useT()
  const navigate = useNavigate()
  const hostName = useOnlineStore((s) => s.hostName)
  const guestRole = useOnlineStore((s) => s.guestRole)
  if (!hostName || !guestRole) return null
  return (
    <span className="flex items-center gap-2" data-testid="guest-badge">
      <span className="hidden rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-text sm:inline">
        {t.online.guestBar(hostName)}
      </span>
      <Button
        size="sm"
        variant="ghost"
        icon={<LogOut />}
        onClick={async () => {
          await leaveGuest()
          toast(t.online.leftSession)
          navigate('/')
        }}
      >
        {t.online.leave}
      </Button>
    </span>
  )
}
