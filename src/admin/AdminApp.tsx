import { LogOut } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { fr } from '@/i18n/locales/fr'
import { cn } from '@/lib/cn'
import { AdminApiError, adminApi } from './api'
import {
  AuditSection,
  CampaignsSection,
  OverviewSection,
  ReportsSection,
  UsersSection,
} from './sections'

const t = fr.admin

const SECTIONS = ['overview', 'reports', 'users', 'campaigns', 'audit'] as const
export type Section = (typeof SECTIONS)[number]

const sectionFromHash = (): Section => {
  const hash = location.hash.replace(/^#\/?/, '').split('/')[0]
  return (SECTIONS as readonly string[]).includes(hash ?? '') ? (hash as Section) : 'overview'
}

type Auth =
  | { state: 'loading' }
  | { state: 'out'; configured: boolean; expired?: boolean }
  | { state: 'in'; username: string }

export function AdminApp() {
  const [auth, setAuth] = useState<Auth>({ state: 'loading' })

  useEffect(() => {
    adminApi<{ username: string }>('GET', '/me').then(
      (me) => setAuth({ state: 'in', username: me.username }),
      (error: unknown) =>
        setAuth({
          state: 'out',
          configured: !(error instanceof AdminApiError) || error.body.configured !== false,
        }),
    )
  }, [])

  /** Any 401 later on: back to the sign-in form. */
  const onExpired = useCallback(
    () => setAuth({ state: 'out', configured: true, expired: true }),
    [],
  )

  if (auth.state === 'loading')
    return (
      <p className="p-6 text-ink-muted" role="status">
        {t.loading}
      </p>
    )
  if (auth.state === 'out')
    return (
      <LoginScreen
        configured={auth.configured}
        expired={!!auth.expired}
        onSignedIn={(username) => setAuth({ state: 'in', username })}
        onUnconfigured={() => setAuth({ state: 'out', configured: false })}
      />
    )
  return (
    <Dashboard
      username={auth.username}
      onExpired={onExpired}
      onSignedOut={() => setAuth({ state: 'out', configured: true })}
    />
  )
}

function LoginScreen({
  configured,
  expired,
  onSignedIn,
  onUnconfigured,
}: {
  configured: boolean
  expired: boolean
  onSignedIn: (username: string) => void
  onUnconfigured: () => void
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(expired ? t.sessionExpired : null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const me = await adminApi<{ username: string }>('POST', '/login', { username, password })
      onSignedIn(me.username)
    } catch (e) {
      setPassword('')
      if (e instanceof AdminApiError && e.body.configured === false) onUnconfigured()
      else if (e instanceof AdminApiError && e.status === 429 && typeof e.body.retryAt === 'number')
        setError(
          t.throttled(new Date(e.body.retryAt).toLocaleTimeString('fr-FR', { timeStyle: 'short' })),
        )
      else if (e instanceof AdminApiError && e.status === 401) setError(t.wrongCredentials)
      else setError(t.error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-full items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-lg border border-line bg-surface p-6 shadow-soft">
        <p className="type-eyebrow">{t.eyebrow}</p>
        <h1 className="mt-1 type-screen-title">{t.title}</h1>
        <p className="mt-2 text-ink-muted">{t.signInIntro}</p>
        {!configured ? (
          <p role="alert" className="mt-5 rounded-md bg-warning-soft p-3 text-warning-text">
            {t.unconfigured}
          </p>
        ) : (
          <form className="mt-5 space-y-4" onSubmit={submit} noValidate>
            <TextField
              label={t.username}
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <TextField
              label={t.password}
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && (
              <p role="alert" className="text-[0.875rem] font-medium text-hp-text">
                {error}
              </p>
            )}
            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={busy || !username || !password}
            >
              {busy ? t.signingIn : t.signIn}
            </Button>
          </form>
        )}
      </div>
    </main>
  )
}

function Dashboard({
  username,
  onExpired,
  onSignedOut,
}: {
  username: string
  onExpired: () => void
  onSignedOut: () => void
}) {
  const [section, setSection] = useState<Section>(sectionFromHash)
  const [focusUser, setFocusUser] = useState<string | null>(null)

  useEffect(() => {
    const onHash = () => setSection(sectionFromHash())
    addEventListener('hashchange', onHash)
    return () => removeEventListener('hashchange', onHash)
  }, [])

  const go = (next: Section) => {
    setSection(next)
    history.replaceState(null, '', `#${next}`)
  }

  async function signOut() {
    await adminApi('POST', '/logout').catch(() => {})
    onSignedOut()
  }

  const props = {
    onExpired,
    openUser: (id: string) => {
      setFocusUser(id)
      go('users')
    },
  }

  return (
    <div className="min-h-full">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="type-eyebrow">{t.eyebrow}</p>
            <h1 className="type-section">{t.title}</h1>
          </div>
          <span className="text-[0.875rem] text-ink-muted">{t.signedInAs(username)}</span>
          <Button size="sm" icon={<LogOut aria-hidden />} onClick={signOut}>
            {t.signOut}
          </Button>
        </div>
        <nav aria-label={t.nav.label} className="mx-auto max-w-6xl px-4">
          <ul className="flex flex-wrap gap-1 pb-2">
            {SECTIONS.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  aria-current={section === s ? 'page' : undefined}
                  onClick={() => go(s)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-[0.9375rem] font-medium transition-colors',
                    section === s
                      ? 'bg-accent-soft font-semibold text-accent-text'
                      : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
                  )}
                >
                  {t.nav[s]}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <h2 className="mb-4 type-section">{t.nav[section]}</h2>
        {section === 'overview' && <OverviewSection {...props} />}
        {section === 'reports' && <ReportsSection {...props} />}
        {section === 'users' && <UsersSection key={focusUser ?? ''} {...props} focus={focusUser} />}
        {section === 'campaigns' && <CampaignsSection {...props} />}
        {section === 'audit' && <AuditSection {...props} />}
      </main>
    </div>
  )
}
