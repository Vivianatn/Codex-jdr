import { useCallback, useEffect, useId, useState, type FormEvent, type ReactNode } from 'react'
import {
  ADMIN_REASON_MIN,
  type AdminAuditRow,
  type AdminCampaignRow,
  type AdminProfile,
  type AdminReport,
  type AdminStats,
  type AdminUserDetail,
  type AdminUserRow,
} from '@shared/admin'
import { Button } from '@/components/ui/Button'
import { TextAreaField, TextField } from '@/components/ui/TextField'
import { fr } from '@/i18n/locales/fr'
import { cn } from '@/lib/cn'
import { AdminApiError, adminApi } from './api'

const t = fr.admin
const CARD = 'rounded-lg border border-line bg-surface p-4 shadow-soft sm:p-5'

interface SectionProps {
  onExpired: () => void
  openUser: (id: string) => void
}

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
const date = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { dateStyle: 'medium' })

/** Loads `path`, reloads on demand; a 401 sends back to the sign-in form. */
function useAdminData<T>(path: string | null, onExpired: () => void) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState(false)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!path) return
    let live = true
    adminApi<T>('GET', path).then(
      (d) => {
        if (!live) return
        setData(d)
        setError(false)
      },
      (e: unknown) => {
        if (!live) return
        if (e instanceof AdminApiError && e.status === 401) onExpired()
        else setError(true)
      },
    )
    return () => {
      live = false
    }
  }, [path, tick, onExpired])
  return { data, error, reload: useCallback(() => setTick((n) => n + 1), []) }
}

function Loading({ error }: { error: boolean }) {
  return error ? (
    <p role="alert" className="text-hp-text">
      {t.error}
    </p>
  ) : (
    <p role="status" className="text-ink-muted">
      {t.loading}
    </p>
  )
}

function Pill({
  tone,
  children,
}: {
  tone: 'hp' | 'warning' | 'heal' | 'info' | 'gold'
  children: ReactNode
}) {
  const tones = {
    hp: 'bg-hp-soft text-hp-text',
    warning: 'bg-warning-soft text-warning-text',
    heal: 'bg-heal-soft text-heal-text',
    info: 'bg-info-soft text-info-text',
    gold: 'bg-gold-soft text-gold-text',
  }
  return (
    <span
      className={cn(
        'inline-flex rounded-sm px-2 py-0.5 text-[0.8125rem] font-semibold',
        tones[tone],
      )}
    >
      {children}
    </span>
  )
}

// ---- overview ---------------------------------------------------------------------

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className={CARD}>
      <p className="text-[0.8125rem] font-semibold text-ink-muted">{label}</p>
      <p className="mt-1 type-name tabular-nums">{value}</p>
      {sub && <p className="text-[0.8125rem] text-ink-muted">{sub}</p>}
    </div>
  )
}

function SignupsChart({ days }: { days: AdminStats['signups'] }) {
  const max = Math.max(1, ...days.map((d) => d.count))
  return (
    <figure className={cn(CARD, 'mt-4')}>
      <figcaption className="type-card-title">{t.overview.signups}</figcaption>
      <div className="mt-4 flex h-36 items-end gap-[2px]" aria-hidden>
        {days.map((d) => (
          <div
            key={d.day}
            title={`${date(d.day)} : ${d.count}`}
            className="min-w-0 flex-1 rounded-t-sm bg-accent"
            style={{
              height: `${Math.max(d.count ? 4 : 1, (d.count / max) * 100)}%`,
              opacity: d.count ? 1 : 0.35,
            }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[0.8125rem] text-ink-muted" aria-hidden>
        <span>{date(days[0]!.day)}</span>
        <span>
          {t.overview.count} : max {max}
        </span>
        <span>{date(days.at(-1)!.day)}</span>
      </div>
      <table className="sr-only">
        <caption>{t.overview.signupsTable}</caption>
        <thead>
          <tr>
            <th scope="col">{t.overview.day}</th>
            <th scope="col">{t.overview.count}</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.day}>
              <td>{date(d.day)}</td>
              <td>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

export function OverviewSection({ onExpired }: SectionProps) {
  const { data, error } = useAdminData<AdminStats>('/stats', onExpired)
  if (!data) return <Loading error={error} />
  const o = t.overview
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <Stat label={o.accounts} value={data.users.total} />
        <Stat label={o.new7} value={data.users.new7} />
        <Stat label={o.new30} value={data.users.new30} />
        <Stat
          label={o.suspended}
          value={data.users.suspended}
          sub={`${o.hidden} : ${data.users.hidden}`}
        />
        <Stat
          label={o.campaigns}
          value={data.campaigns.total}
          sub={`${o.listed} : ${data.campaigns.listed}`}
        />
        <Stat
          label={o.live}
          value={data.campaigns.live}
          sub={`${o.liveOnline} : ${data.campaigns.liveOnline}`}
        />
        <Stat label={o.members} value={data.members} />
        <Stat label={o.openReports} value={data.openReports} />
      </div>
      <SignupsChart days={data.signups} />
    </>
  )
}

// ---- moderation forms -------------------------------------------------------------

type ActionKind = 'hideProfile' | 'suspend' | 'dismiss' | 'deleteAccount'

const ENDPOINTS: Record<ActionKind, (id: string) => ['POST' | 'DELETE', string]> = {
  hideProfile: (id) => ['POST', `/users/${id}/hide-profile`],
  suspend: (id) => ['POST', `/users/${id}/suspend`],
  dismiss: (id) => ['POST', `/reports/${id}/dismiss`],
  deleteAccount: (id) => ['DELETE', `/users/${id}`],
}

/** Reason (sent to the person), illegal or not, and the typed name for a deletion. */
function ActionForm({
  kind,
  targetId,
  reportId,
  confirmName,
  onDone,
  onCancel,
  onExpired,
}: {
  kind: ActionKind
  targetId: string
  reportId?: string
  confirmName?: string
  onDone: (message: string) => void
  onCancel: () => void
  onExpired: () => void
}) {
  const [reason, setReason] = useState('')
  const [illegal, setIllegal] = useState(false)
  const [rename, setRename] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const illegalId = useId()
  const a = t.actions

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (reason.trim().length < ADMIN_REASON_MIN) return setError(a.reasonShort(ADMIN_REASON_MIN))
    if (kind === 'deleteAccount' && confirm !== confirmName) return setError(a.confirmMismatch)
    setBusy(true)
    setError(null)
    const [method, path] = ENDPOINTS[kind](targetId)
    try {
      await adminApi(method, path, {
        reason: reason.trim(),
        ...(kind === 'dismiss' ? {} : { illegal }),
        ...(reportId && kind !== 'dismiss' ? { reportId } : {}),
        ...(kind === 'hideProfile' && rename.trim() ? { rename: rename.trim() } : {}),
        ...(kind === 'deleteAccount' ? { confirm } : {}),
      })
      onDone(a.done[kind])
    } catch (e) {
      if (e instanceof AdminApiError && e.status === 401) onExpired()
      else setError(t.error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className={cn(
        'mt-3 space-y-3 rounded-md border p-3',
        kind === 'deleteAccount' ? 'border-hp bg-hp-soft' : 'border-line-strong bg-surface-2',
      )}
    >
      {kind === 'deleteAccount' && <p className="font-medium text-hp-text">{a.deleteWarning}</p>}
      <TextAreaField
        label={kind === 'dismiss' ? a.dismissReason : a.reason}
        hint={a.reasonHint(ADMIN_REASON_MIN)}
        value={reason}
        maxLength={2000}
        onChange={(e) => setReason(e.target.value)}
        required
      />
      {kind !== 'dismiss' && (
        <div className="flex items-start gap-2">
          <input
            id={illegalId}
            type="checkbox"
            className="mt-1 size-4 accent-[var(--codex-accent)]"
            checked={illegal}
            onChange={(e) => setIllegal(e.target.checked)}
          />
          <label htmlFor={illegalId} className="text-[0.9375rem]">
            {a.illegal}
          </label>
        </div>
      )}
      {kind === 'hideProfile' && (
        <TextField
          label={a.rename}
          value={rename}
          maxLength={40}
          onChange={(e) => setRename(e.target.value)}
        />
      )}
      {kind === 'deleteAccount' && confirmName && (
        <TextField
          label={a.confirmName(confirmName)}
          value={confirm}
          autoComplete="off"
          onChange={(e) => setConfirm(e.target.value)}
        />
      )}
      {kind !== 'dismiss' && <p className="text-[0.8125rem] text-ink-muted">{a.statementNote}</p>}
      {error && (
        <p role="alert" className="text-[0.875rem] font-medium text-hp-text">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant={kind === 'dismiss' ? 'primary' : 'danger'} disabled={busy}>
          {a[kind]}
        </Button>
        <Button onClick={onCancel}>{a.cancel}</Button>
      </div>
    </form>
  )
}

/** The moderation buttons of an account (and of the report it comes from, if any). */
function ModerationActions({
  user,
  reportId,
  onChanged,
  onExpired,
}: {
  user: { id: string; displayName: string; suspended: boolean; profileHidden: boolean }
  reportId?: string
  onChanged: (message: string) => void
  onExpired: () => void
}) {
  const [open, setOpen] = useState<ActionKind | null>(null)
  const [busy, setBusy] = useState(false)
  const a = t.actions

  async function simple(path: string, message: string) {
    setBusy(true)
    try {
      await adminApi('POST', path)
      onChanged(message)
    } catch (e) {
      if (e instanceof AdminApiError && e.status === 401) onExpired()
      else onChanged(t.error)
    } finally {
      setBusy(false)
    }
  }

  const done = (message: string) => {
    setOpen(null)
    onChanged(message)
  }
  const toggle = (kind: ActionKind) => setOpen((k) => (k === kind ? null : kind))

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {user.profileHidden ? (
          <Button
            size="sm"
            disabled={busy}
            onClick={() => simple(`/users/${user.id}/restore-profile`, a.done.restoreProfile)}
          >
            {a.restoreProfile}
          </Button>
        ) : (
          <Button
            size="sm"
            aria-expanded={open === 'hideProfile'}
            onClick={() => toggle('hideProfile')}
          >
            {a.hideProfile}
          </Button>
        )}
        {user.suspended ? (
          <Button
            size="sm"
            disabled={busy}
            onClick={() => simple(`/users/${user.id}/unsuspend`, a.done.unsuspend)}
          >
            {a.unsuspend}
          </Button>
        ) : (
          <Button size="sm" aria-expanded={open === 'suspend'} onClick={() => toggle('suspend')}>
            {a.suspend}
          </Button>
        )}
        {reportId && (
          <Button size="sm" aria-expanded={open === 'dismiss'} onClick={() => toggle('dismiss')}>
            {a.dismiss}
          </Button>
        )}
        {!reportId && (
          <Button
            size="sm"
            variant="ghost"
            className="text-hp-text"
            aria-expanded={open === 'deleteAccount'}
            onClick={() => toggle('deleteAccount')}
          >
            {a.deleteAccount}
          </Button>
        )}
      </div>
      {open && (
        <ActionForm
          key={open}
          kind={open}
          targetId={open === 'dismiss' ? reportId! : user.id}
          reportId={reportId}
          confirmName={user.displayName}
          onDone={done}
          onCancel={() => setOpen(null)}
          onExpired={onExpired}
        />
      )}
    </div>
  )
}

function Notice({ message }: { message: string | null }) {
  return (
    <p
      role="status"
      aria-live="polite"
      className={cn('mb-3 font-medium text-heal-text', !message && 'sr-only')}
    >
      {message ?? ''}
    </p>
  )
}

const isPicture = (src: string | null): src is string => !!src && src.startsWith('data:image/')

function ProfileView({ profile }: { profile: AdminProfile }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      {isPicture(profile.avatar) ? (
        <img
          src={profile.avatar}
          alt=""
          width={48}
          height={48}
          className="size-12 shrink-0 rounded-md object-cover"
        />
      ) : (
        <span className="size-12 shrink-0 rounded-md bg-surface-2" aria-hidden />
      )}
      <div className="min-w-0">
        <p className="type-card-title break-words">{profile.displayName || '—'}</p>
        <p className="text-[0.875rem] break-words text-ink-muted">{profile.bio || t.users.noBio}</p>
        {isPicture(profile.banner) && (
          <img
            src={profile.banner}
            alt=""
            width={240}
            height={60}
            className="mt-2 h-14 w-full max-w-60 rounded-sm object-cover"
          />
        )}
      </div>
    </div>
  )
}

// ---- reports ----------------------------------------------------------------------

const STATUS_TONE = { open: 'warning', actioned: 'hp', dismissed: 'info' } as const

export function ReportsSection({ onExpired, openUser }: SectionProps) {
  const [all, setAll] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const { data, error, reload } = useAdminData<{ reports: AdminReport[] }>(
    all ? '/reports?status=all' : '/reports',
    onExpired,
  )
  const r = t.reports
  return (
    <>
      <div role="group" aria-label={r.filter} className="mb-4 flex flex-wrap gap-2">
        {[false, true].map((value) => (
          <Button
            key={String(value)}
            size="sm"
            aria-pressed={all === value}
            variant={all === value ? 'primary' : 'secondary'}
            onClick={() => setAll(value)}
          >
            {value ? r.all : r.open}
          </Button>
        ))}
      </div>
      <Notice message={message} />
      {!data ? (
        <Loading error={error} />
      ) : !data.reports.length ? (
        <p className="text-ink-muted">{all ? r.emptyAll : r.empty}</p>
      ) : (
        <ul className="space-y-3">
          {data.reports.map((report) => (
            <li key={report.id} className={CARD}>
              <article aria-label={r.reference(report.reference)}>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="type-card-title">{r.reference(report.reference)}</h3>
                  <Pill tone={STATUS_TONE[report.status]}>{r.status[report.status]}</Pill>
                  <span className="text-[0.875rem] text-ink-muted">
                    {r.received(dateTime(report.createdAt))}
                  </span>
                </div>
                <p className="mt-1 font-semibold">
                  {(fr.legal.categories as Record<string, string>)[report.category] ??
                    report.category}
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="mb-1 type-eyebrow">{r.profileAsReported}</p>
                    <ProfileView profile={report.snapshot} />
                    <p className="mt-2 text-[0.875rem]">
                      {report.target.displayName === null ? (
                        <span className="text-ink-muted">{r.deletedAccount}</span>
                      ) : (
                        <button
                          type="button"
                          className="font-semibold text-accent-text underline"
                          onClick={() => openUser(report.target.id)}
                        >
                          {r.openAccount} ({report.target.displayName})
                        </button>
                      )}{' '}
                      {report.target.suspended && <Pill tone="hp">{t.users.suspended}</Pill>}{' '}
                      {report.target.profileHidden && <Pill tone="warning">{t.users.hidden}</Pill>}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="mb-1 type-eyebrow">{r.explanation}</p>
                    <p className="break-words whitespace-pre-wrap">{report.explanation}</p>
                    <p className="mt-2 text-[0.875rem] text-ink-muted">
                      {r.reporter} : {report.reporter?.displayName ?? r.anonymous}
                    </p>
                    {report.decision && (
                      <p className="mt-2 text-[0.875rem]">
                        <strong>{r.decision}</strong> : {report.decision}
                        {report.decidedAt && ` (${r.decided(dateTime(report.decidedAt))})`}
                      </p>
                    )}
                  </div>
                </div>
                {report.status === 'open' && (
                  <div className="mt-3">
                    {report.target.displayName !== null ? (
                      <ModerationActions
                        user={{ ...report.target, displayName: report.target.displayName }}
                        reportId={report.id}
                        onChanged={(m) => {
                          setMessage(m)
                          reload()
                        }}
                        onExpired={onExpired}
                      />
                    ) : (
                      <DismissOnly
                        reportId={report.id}
                        onExpired={onExpired}
                        onDone={(m) => {
                          setMessage(m)
                          reload()
                        }}
                      />
                    )}
                  </div>
                )}
              </article>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function DismissOnly({
  reportId,
  onDone,
  onExpired,
}: {
  reportId: string
  onDone: (m: string) => void
  onExpired: () => void
}) {
  const [open, setOpen] = useState(false)
  return open ? (
    <ActionForm
      kind="dismiss"
      targetId={reportId}
      onDone={onDone}
      onCancel={() => setOpen(false)}
      onExpired={onExpired}
    />
  ) : (
    <Button size="sm" onClick={() => setOpen(true)}>
      {t.actions.dismiss}
    </Button>
  )
}

// ---- accounts ---------------------------------------------------------------------

function SearchForm({
  label,
  hint,
  onSearch,
}: {
  label: string
  hint: string
  onSearch: (q: string) => void
}) {
  const [q, setQ] = useState('')
  return (
    <form
      role="search"
      className="mb-4 flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        onSearch(q.trim())
      }}
    >
      <TextField
        label={label}
        hint={hint}
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="min-w-0 flex-1 basis-56"
      />
      <Button type="submit">{t.users.searchButton}</Button>
    </form>
  )
}

export function UsersSection({ onExpired, focus }: SectionProps & { focus: string | null }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(focus)
  const [message, setMessage] = useState<string | null>(null)
  const list = useAdminData<{ users: AdminUserRow[] }>(
    `/users?q=${encodeURIComponent(query)}`,
    onExpired,
  )
  const detail = useAdminData<{ user: AdminUserDetail }>(
    selected ? `/users/${selected}` : null,
    onExpired,
  )
  const u = t.users

  const changed = (m: string) => {
    setMessage(m)
    if (m === t.actions.done.deleteAccount) setSelected(null)
    else detail.reload()
    list.reload()
  }

  const user = selected ? detail.data?.user : undefined
  return (
    <>
      <SearchForm label={u.search} hint={u.searchHint} onSearch={setQuery} />
      <Notice message={message} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="min-w-0">
          {!list.data ? (
            <Loading error={list.error} />
          ) : !list.data.users.length ? (
            <p className="text-ink-muted">{u.empty}</p>
          ) : (
            <ul className="space-y-1">
              {list.data.users.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    aria-current={selected === row.id ? 'true' : undefined}
                    onClick={() => setSelected(row.id)}
                    className={cn(
                      'w-full rounded-md border px-3 py-2 text-left transition-colors',
                      selected === row.id
                        ? 'border-accent bg-accent-soft'
                        : 'border-line bg-surface hover:bg-surface-2',
                    )}
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold break-all">{row.displayName}</span>
                      {row.suspended && <Pill tone="hp">{u.suspended}</Pill>}
                      {row.profileHidden && <Pill tone="warning">{u.hidden}</Pill>}
                    </span>
                    <span className="block text-[0.8125rem] break-all text-ink-muted">
                      {row.email} · {date(row.createdAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <section aria-label={u.detail} className="min-w-0">
          {!selected ? (
            <p className="text-ink-muted">{u.pick}</p>
          ) : !user || user.id !== selected ? (
            <Loading error={detail.error} />
          ) : (
            <div className={CARD}>
              <ProfileView profile={user.profile} />
              <dl className="mt-4 grid grid-cols-1 gap-x-4 gap-y-2 text-[0.9375rem] sm:grid-cols-2">
                {(
                  [
                    [
                      u.status,
                      user.suspended ? u.suspended : user.profileHidden ? u.hidden : u.active,
                    ],
                    [u.email, user.email],
                    [u.code, user.friendCode ?? '—'],
                    [u.created, dateTime(user.createdAt)],
                    [u.lastLogin, user.lastLoginAt ? dateTime(user.lastLoginAt) : u.never],
                    [
                      u.terms,
                      user.termsAcceptedAt
                        ? `${user.termsVersion} · ${date(user.termsAcceptedAt)}`
                        : u.termsNone,
                    ],
                    [u.campaignsOwned, String(user.campaignsOwned)],
                    [u.memberships, String(user.memberships)],
                    [
                      u.reportsAgainst,
                      `${user.reportsAgainst} (${t.reports.open.toLowerCase()} : ${user.openReportsAgainst})`,
                    ],
                    [u.reportsFiled, String(user.reportsFiled)],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <dt className="text-[0.8125rem] font-semibold text-ink-muted">{label}</dt>
                    <dd className="break-words">{value}</dd>
                  </div>
                ))}
              </dl>
              {user.online && (
                <p className="mt-2">
                  <Pill tone="heal">{u.online}</Pill>
                </p>
              )}
              <div className="mt-4 border-t border-line pt-4">
                <ModerationActions
                  key={user.id}
                  user={user}
                  onChanged={changed}
                  onExpired={onExpired}
                />
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  )
}

// ---- campaigns --------------------------------------------------------------------

export function CampaignsSection({ onExpired, openUser }: SectionProps) {
  const [query, setQuery] = useState('')
  const { data, error } = useAdminData<{ campaigns: AdminCampaignRow[] }>(
    `/campaigns?q=${encodeURIComponent(query)}`,
    onExpired,
  )
  const c = t.campaigns
  return (
    <>
      <p className="mb-3 text-ink-muted">{c.privacy}</p>
      <SearchForm label={c.search} hint={c.searchHint} onSearch={setQuery} />
      {!data ? (
        <Loading error={error} />
      ) : !data.campaigns.length ? (
        <p className="text-ink-muted">{c.empty}</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {data.campaigns.map((campaign) => (
            <li key={campaign.id} className={CARD}>
              <h3 className="type-card-title break-words">{campaign.name}</h3>
              <p className="text-[0.875rem]">
                {c.gm} :{' '}
                <button
                  type="button"
                  className="font-semibold text-accent-text underline"
                  onClick={() => openUser(campaign.owner.id)}
                >
                  {campaign.owner.displayName}
                </button>
              </p>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-[0.875rem] text-ink-muted">
                <span>{c.members(campaign.members)}</span>
                <span>{c.created(date(campaign.createdAt))}</span>
                {campaign.live && (
                  <Pill tone="heal">{campaign.live === 'online' ? c.liveOnline : c.liveLocal}</Pill>
                )}
                {campaign.listed && <Pill tone="gold">{c.listed}</Pill>}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

// ---- audit ------------------------------------------------------------------------

export function AuditSection({ onExpired }: SectionProps) {
  const [pages, setPages] = useState<AdminAuditRow[] | null>(null)
  const [more, setMore] = useState(false)
  const [error, setError] = useState(false)
  const load = useCallback(
    (before?: string) =>
      adminApi<{ entries: AdminAuditRow[] }>(
        'GET',
        before ? `/audit?before=${before}` : '/audit',
      ).then(
        (d) => {
          setPages((p) => [...(before ? (p ?? []) : []), ...d.entries])
          setMore(d.entries.length === 100)
        },
        (e: unknown) => {
          if (e instanceof AdminApiError && e.status === 401) onExpired()
          else setError(true)
        },
      ),
    [onExpired],
  )
  useEffect(() => {
    void load()
  }, [load])
  const a = t.audit
  if (!pages) return <Loading error={error} />
  if (!pages.length) return <p className="text-ink-muted">{a.empty}</p>
  return (
    <>
      <ol className="divide-y divide-line rounded-lg border border-line bg-surface">
        {pages.map((entry) => {
          const reason = typeof entry.detail?.reason === 'string' ? entry.detail.reason : null
          return (
            <li key={entry.id} className="px-4 py-3">
              <p className="flex flex-wrap items-center gap-x-2">
                <span className="font-semibold">{a.actions[entry.action] ?? entry.action}</span>
                {entry.targetLabel && <span className="break-all">· {entry.targetLabel}</span>}
                <span className="text-[0.8125rem] text-ink-muted">
                  {dateTime(entry.at)} {a.by(entry.actor)}
                </span>
              </p>
              {reason && (
                <p className="mt-1 text-[0.875rem] break-words text-ink-muted">{reason}</p>
              )}
            </li>
          )
        })}
      </ol>
      {more && (
        <Button className="mt-3" onClick={() => void load(pages.at(-1)!.id)}>
          {a.more}
        </Button>
      )}
    </>
  )
}
