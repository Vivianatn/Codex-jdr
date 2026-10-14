import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { LogoMark, Ornament, Wordmark } from '@/components/Brand'
import { buttonClasses } from '@/components/ui/buttonStyles'
import { AppHeader } from '@/features/shell/AppHeader'
import { useT } from '@/i18n'
import { cn } from '@/lib/cn'
import { server } from '@/online/server/api'
import { useServerStore } from '@/online/server/serverStore'
import { useUiStore } from '@/stores/uiStore'
import type { InvitePreview } from '@shared/sync'
import { RequestForm } from './JoinDialog'

/** An invitation link opened (…/app/#/rejoindre/CODE): ask to join the campaign (D-257). */
export function InvitePage() {
  const t = useT()
  const navigate = useNavigate()
  const { code = '' } = useParams()
  const linked = useServerStore((s) => s.user !== null)
  const status = useServerStore((s) => s.status)
  const [preview, setPreview] = useState<InvitePreview | null | undefined>(undefined)

  useEffect(() => {
    if (!linked || status !== 'online') return
    let alive = true
    server.invite(code).then(
      (p) => alive && setPreview(p),
      () => alive && setPreview(null),
    )
    return () => {
      alive = false
    }
  }, [code, linked, status])

  const toGames = () => {
    useUiStore.getState().setHomeMode('player')
    navigate('/')
  }

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
      <main id="main" className="mx-auto w-full max-w-lg flex-1 px-4 py-14">
        <h1 className="type-screen-title text-ink">{t.online.invitePageTitle}</h1>
        <Ornament className="mt-4 mb-8" />
        <div className="space-y-4 rounded-xl border border-line bg-surface-raised p-6 shadow-overlay">
          {status !== 'online' ? (
            <p className="text-sm text-ink-muted" role="status">
              {t.online.status[status]}
            </p>
          ) : preview === undefined ? (
            <p className="text-sm text-ink-muted">…</p>
          ) : preview === null ? (
            <p className="text-sm text-ink-muted">{t.online.invalidInvite}</p>
          ) : (
            <RequestForm preview={preview} code={code} onSent={toGames} />
          )}
        </div>
        <Link to="/" className={cn(buttonClasses('ghost'), 'mt-6 gap-2')} onClick={toGames}>
          <ArrowLeft className="size-4" aria-hidden />
          {t.online.goToCampaigns}
        </Link>
      </main>
    </div>
  )
}
