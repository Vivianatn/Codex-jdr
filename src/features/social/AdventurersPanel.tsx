import { Copy, Link2, Search } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { Portrait } from '@/features/characters/Portrait'
import { onlineErrorMessage } from '@/features/online/onlineMessages'
import { useIntlLocale, useT } from '@/i18n'
import { copyText } from '@/lib/clipboard'
import { server } from '@/online/server/api'
import { useServerStore } from '@/online/server/serverStore'
import type { AdventurerSummary } from '@shared/sync'
import { RelationButton } from './RelationButton'
import { adventurerUrl, formatCode } from './socialState'

/**
 * Profil › Aventuriers (D-267): the ways to find someone (code and link,
 * search by name or code, table companions) and the lists of adventurers
 * and requests.
 */
export function AdventurersPanel() {
  const t = useT()
  const locale = useIntlLocale()
  const friends = useServerStore((s) => s.friends)
  const code = useServerStore((s) => s.profile?.code ?? null)
  const date = (at: number) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(at)
  // Those connected now come first.
  const companions = (friends?.friends ?? []).toSorted(
    (a, b) => Number(b.online) - Number(a.online),
  )
  const connected = companions.filter((f) => f.online).length

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div className="min-w-0 space-y-8">
        {friends && friends.incoming.length > 0 && (
          <Group title={t.adventurers.incomingTitle} testId="adventurers-incoming">
            {friends.incoming.map((f) => (
              <Row key={f.id} adventurer={f} detail={t.adventurers.sentOn(date(f.at))} />
            ))}
          </Group>
        )}
        <Group
          title={t.adventurers.friendsTitle}
          hint={connected > 0 ? t.adventurers.onlineCount(connected) : undefined}
          testId="adventurers-friends"
          empty={friends?.friends.length === 0 ? t.adventurers.noFriends : null}
        >
          {companions.map((f) => (
            <Row key={f.id} adventurer={f} detail={f.bio} online={f.online} />
          ))}
        </Group>
        {friends && friends.outgoing.length > 0 && (
          <Group title={t.adventurers.outgoingTitle} testId="adventurers-outgoing">
            {friends.outgoing.map((f) => (
              <Row key={f.id} adventurer={f} detail={t.adventurers.sentOn(date(f.at))} />
            ))}
          </Group>
        )}
        {friends && friends.suggestions.length > 0 && (
          <Group
            title={t.adventurers.suggestionsTitle}
            hint={t.adventurers.suggestionsHint}
            testId="adventurers-suggestions"
          >
            {friends.suggestions.map((f) => (
              <Row key={f.id} adventurer={f} detail={t.adventurers.metIn(f.campaign)} />
            ))}
          </Group>
        )}
      </div>
      <aside className="min-w-0 space-y-8">
        {code && <CodeCard code={code} />}
        <FindForm />
      </aside>
    </div>
  )
}

function Group({
  title,
  hint,
  empty,
  testId,
  children,
}: {
  title: string
  hint?: string
  empty?: string | null
  testId: string
  children: ReactNode
}) {
  return (
    <section className="space-y-2" data-testid={testId}>
      <h2 className="type-section text-ink">{title}</h2>
      {hint && <p className="text-sm text-ink-muted">{hint}</p>}
      {empty ? (
        <p className="text-sm text-ink-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {children}
        </ul>
      )}
    </section>
  )
}

/** One adventurer: picture and name lead to the profile; the relation's actions at the end. */
function Row({
  adventurer,
  detail,
  online,
}: {
  adventurer: AdventurerSummary
  detail?: string
  /** Adventurers only: connected right now. */
  online?: boolean
}) {
  const t = useT()
  return (
    <li className="flex items-center gap-3 px-3 py-2.5" data-testid="adventurer-row">
      <Link
        to={`/profil/${adventurer.id}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-md hover:text-accent-text"
        aria-label={t.adventurers.viewProfile(adventurer.displayName)}
      >
        <span className="relative shrink-0">
          <Portrait src={adventurer.avatar} name={adventurer.displayName} size="sm" />
          {online && (
            <span
              className="absolute right-0 bottom-0 size-3 rounded-full bg-heal ring-2 ring-surface"
              aria-hidden
            />
          )}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-medium text-ink">
            {adventurer.displayName}
            {online && <span className="sr-only"> · {t.adventurers.online}</span>}
          </span>
          {detail && <span className="block truncate text-xs text-ink-muted">{detail}</span>}
        </span>
      </Link>
      <RelationButton user={adventurer} compact />
    </li>
  )
}

function CodeCard({ code }: { code: string }) {
  const t = useT()
  const copy = async (text: string, done: string) => {
    try {
      await copyText(text)
      toast.success(done)
    } catch {
      toast.error(text)
    }
  }
  return (
    <section
      className="space-y-3 rounded-lg border border-line bg-surface p-4"
      data-testid="adventurer-code"
    >
      <h2 className="type-section text-ink">{t.adventurers.codeTitle}</h2>
      <p className="font-mono text-2xl font-semibold tracking-widest text-ink">
        {formatCode(code)}
      </p>
      <p className="text-sm text-ink-muted">{t.adventurers.codeHint}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          icon={<Copy />}
          onClick={() => copy(formatCode(code), t.adventurers.codeCopied)}
        >
          {t.adventurers.copyCode}
        </Button>
        <Button
          size="sm"
          icon={<Link2 />}
          onClick={() => copy(adventurerUrl(code), t.adventurers.linkCopied)}
        >
          {t.adventurers.copyLink}
        </Button>
      </div>
    </section>
  )
}

function FindForm() {
  const t = useT()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AdventurerSummary[] | null>(null)
  const [busy, setBusy] = useState(false)
  return (
    <section className="space-y-3" data-testid="adventurer-search">
      <h2 className="type-section text-ink">{t.adventurers.findTitle}</h2>
      <form
        className="space-y-2"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          try {
            setResults((await server.searchAdventurers(query)).results)
          } catch (error) {
            toast.error(onlineErrorMessage(t, error))
          } finally {
            setBusy(false)
          }
        }}
      >
        <TextField
          label={t.adventurers.searchLabel}
          value={query}
          maxLength={100}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex justify-end">
          <Button type="submit" icon={<Search />} disabled={busy || query.trim().length < 2}>
            {busy ? t.adventurers.searching : t.adventurers.search}
          </Button>
        </div>
      </form>
      {results &&
        (results.length === 0 ? (
          <p className="text-sm text-ink-muted">{t.adventurers.noResults}</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
            {results.map((r) => (
              <Row key={r.id} adventurer={r} detail={r.bio} />
            ))}
          </ul>
        ))}
    </section>
  )
}
