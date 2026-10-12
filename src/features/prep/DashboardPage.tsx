import { useLiveQuery } from 'dexie-react-hooks'
import { History } from 'lucide-react'
import { GameIcon } from '@/components/GameIcon'
import { gameIcon, type IconComponent } from '@/components/iconFactory'
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { buttonClasses } from '@/components/ui/buttonStyles'
import { activityRepository } from '@/db/activity'
import { bestiaryRepository } from '@/db/bestiary'
import { itemLibrary } from '@/db/itemLibrary'
import { sessionRepository } from '@/db/sessions'
import { activityAuthors, type ActivityRecord } from '@/domain/activity'
import { entityHpMax, entityName } from '@/domain/entity'
import { HpBar } from '@/features/characters/HpBar'
import { Portrait } from '@/features/characters/Portrait'
import { rollSummary } from '@/features/dice/rollSummary'
import { useRollerName } from '@/features/dice/useRollerName'
import { PageTransition } from '@/features/shell/PageTransition'
import { useCampaign } from '@/features/shell/campaignContext'
import { formatRelativeTime, useIntlLocale, useT } from '@/i18n'
import type { Messages } from '@/i18n/locales/fr'
import { cn } from '@/lib/cn'
import { useOnlineStore } from '@/online/onlineStore'
import { selectEntitiesOfKinds, useCampaignStore } from '@/stores/campaignStore'
import { useRollStore } from '@/stores/rollStore'
import type { PrepSection } from '@/stores/uiStore'
import { SECTION_ICONS } from './sections'

const ACTIVITY_PAGE = 15
const RECENT_ROLLS = 5
const DiceIcon = gameIcon('rolling-dices')

/**
 * Overview of the campaign (DA §10.2): every figure of the campaign, the
 * party, the game in progress, the last rolls, and what each editor did
 * lately (activity log, D-247).
 */
export function DashboardPage() {
  const t = useT()
  const intl = useIntlLocale()
  const campaign = useCampaign()
  const entities = useCampaignStore((s) => s.entities)
  const skills = useCampaignStore((s) => s.skills)
  const maps = useCampaignStore((s) => s.maps)
  const play = useCampaignStore((s) => s.play)
  const rolls = useRollStore((s) => s.rolls)
  const templates = useLiveQuery(() => bestiaryRepository.list(campaign.id), [campaign.id])
  const items = useLiveQuery(() => itemLibrary.list(campaign.id), [campaign.id])
  const plans = useLiveQuery(() => sessionRepository.listPlans(campaign.id), [campaign.id])
  const runs = useLiveQuery(() => sessionRepository.listRuns(campaign.id), [campaign.id])
  const activity = useLiveQuery(() => activityRepository.list(campaign.id), [campaign.id])

  const all = Object.values(entities)
  const players = selectEntitiesOfKinds(entities, ['player'])
  const count = (kinds: readonly string[]) => all.filter((e) => kinds.includes(e.kind)).length
  const base = `/c/${campaign.id}/prep`
  const lastEdit = activity?.[0]?.at ?? campaign.updatedAt
  const isEmpty = all.length === 0 && Object.keys(maps).length === 0

  const figures: Figure[] = [
    { key: 'players', value: players.length, section: 'players' },
    { key: 'allies', value: count(['ally', 'familiar']), section: 'allies' },
    {
      key: 'enemies',
      value: count(['enemy']),
      section: 'bestiary',
      icon: gameIcon('crossed-swords'),
    },
    { key: 'templates', value: templates?.length, section: 'bestiary' },
    { key: 'skills', value: Object.keys(skills).length, section: 'skills' },
    { key: 'items', value: items?.length, section: 'items' },
    { key: 'conditions', value: campaign.library.conditions.length, section: 'conditions' },
    { key: 'maps', value: Object.keys(maps).length, section: 'maps' },
    { key: 'sessions', value: plans?.length, section: 'sessions' },
    { key: 'runs', value: runs?.length, section: 'sessions', icon: History },
    { key: 'rolls', value: rolls.length, icon: gameIcon('rolling-dices') },
  ]

  return (
    <PageTransition className="px-4 py-8 sm:px-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="type-eyebrow">{t.dashboard.eyebrow}</p>
            <h1 className="mt-1 type-screen-title break-words text-ink">{campaign.name}</h1>
            <p className="mt-2 text-ink-muted">{campaign.description || t.dashboard.subtitle}</p>
            <p className="mt-1 text-[0.8125rem] text-ink-muted">
              {t.dashboard.created(
                new Intl.DateTimeFormat(intl, { dateStyle: 'long' }).format(campaign.createdAt),
              )}
              {' · '}
              {t.dashboard.edited(formatRelativeTime(lastEdit, intl, t.time.justNow))}
            </p>
          </div>
          <Link to={`/c/${campaign.id}/play`} className={buttonClasses('primary', 'lg')}>
            <GameIcon name="crossed-swords" className="size-4" aria-hidden />
            {t.dashboard.playCta}
          </Link>
        </header>

        {isEmpty && <NextSteps t={t} />}

        <section aria-labelledby="figures" className={CARD}>
          <h2 id="figures" className="type-section text-ink">
            {t.dashboard.figuresTitle}
          </h2>
          <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {figures.map((f) => (
              <FigureTile key={f.key} figure={f} label={t.dashboard.figures[f.key]} base={base} />
            ))}
          </ul>
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          <ActivitySection records={activity} className="lg:col-span-2" />
          <div className="space-y-6">
            <section aria-labelledby="party" className={CARD}>
              <h2 id="party" className="type-section text-ink">
                {t.dashboard.partyTitle}
              </h2>
              {players.length === 0 ? (
                <p className="mt-3 text-sm text-ink-muted">{t.dashboard.partyEmpty}</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {players.map((p) => (
                    <li key={p.id}>
                      <Link
                        to={`${base}/players/e/${p.id}`}
                        className="flex items-center gap-3 rounded-md p-1 hover:bg-surface-2"
                      >
                        <Portrait src={p.identity.portrait} name={entityName(p)} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="flex items-baseline justify-between gap-2">
                            <span className="truncate font-semibold text-ink">{entityName(p)}</span>
                            <span className="tabular shrink-0 text-xs text-ink-muted">
                              {t.dashboard.partyLevel(p.level)}
                            </span>
                          </p>
                          <HpBar
                            current={p.hp.current}
                            max={entityHpMax(p, campaign.rules)}
                            temp={p.hp.temp}
                            size="sm"
                            thresholds={campaign.rules.hp}
                          />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="game" className={CARD}>
              <h2 id="game" className="type-section text-ink">
                {t.dashboard.gameTitle}
              </h2>
              <p className="mt-2 text-sm text-ink">
                {play.live ? t.dashboard.gameLive(play.live.operator.name) : t.dashboard.gameIdle}
              </p>
              <dl className="mt-3 space-y-1.5 text-sm">
                <Row term={t.dashboard.gameMap}>
                  {(play.mapId && maps[play.mapId]?.name) || t.dashboard.gameNoMap}
                </Row>
                <Row term={t.dashboard.gameGroups}>{play.groups.length}</Row>
                {play.turn.status !== 'stopped' && (
                  <Row term={t.dashboard.gameRound}>{play.turn.round}</Row>
                )}
                <Row term={t.dashboard.gameLastRun}>
                  {runs?.[0]
                    ? `${runs[0].title} · ${formatRelativeTime(runs[0].startedAt, intl, t.time.justNow)}`
                    : t.dashboard.gameNoRun}
                </Row>
              </dl>
            </section>

            <RecentRolls />
          </div>
        </div>
      </div>
    </PageTransition>
  )
}

const CARD = 'rounded-lg border border-line bg-surface p-5 shadow-soft sm:p-6'

interface Figure {
  key: keyof Messages['dashboard']['figures']
  /** undefined while loading. */
  value: number | undefined
  section?: PrepSection
  icon?: IconComponent
}

function FigureTile({ figure, label, base }: { figure: Figure; label: string; base: string }) {
  const Icon = figure.icon ?? (figure.section ? SECTION_ICONS[figure.section] : DiceIcon)
  const body = (
    <>
      <Icon className="size-6 text-gold-text" aria-hidden />
      <span className="tabular font-display text-2xl leading-none font-bold text-ink">
        {figure.value ?? '–'}
      </span>
      <span className="text-[0.8125rem] leading-tight text-ink-muted">{label}</span>
    </>
  )
  const tile = 'flex h-full flex-col gap-2 rounded-md border border-line bg-surface-2 p-3'
  return (
    <li>
      {figure.section ? (
        <Link
          to={`${base}/${figure.section}`}
          className={cn(tile, 'transition-colors duration-150 hover:border-line-strong')}
        >
          {body}
        </Link>
      ) : (
        <div className={tile}>{body}</div>
      )}
    </li>
  )
}

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-muted">{term}</dt>
      <dd className="tabular min-w-0 truncate text-right text-ink">{children}</dd>
    </div>
  )
}

function NextSteps({ t }: { t: Messages }) {
  return (
    <section aria-labelledby="next-steps" className={CARD}>
      <h2 id="next-steps" className="type-section text-ink">
        {t.dashboard.nextStepsTitle}
      </h2>
      <ol className="mt-4 space-y-3">
        {t.dashboard.nextSteps.map((step, index) => (
          <li key={step} className="flex gap-3 text-sm text-ink">
            <span className="tabular flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-text">
              {index + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

function ActivitySection({
  records,
  className,
}: {
  records: ActivityRecord[] | undefined
  className?: string
}) {
  const t = useT()
  const intl = useIntlLocale()
  const selfId = useOnlineStore((s) => s.selfId)
  const [author, setAuthor] = useState('all')
  const [shown, setShown] = useState(ACTIVITY_PAGE)
  const authors = useMemo(() => activityAuthors(records ?? []), [records])
  const filtered = (records ?? []).filter((r) => author === 'all' || r.author.id === author)
  const visible = filtered.slice(0, shown)
  const authorName = authors.find((a) => a.id === author)?.name ?? ''

  return (
    <section aria-labelledby="activity" className={cn(CARD, className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="activity" className="type-section text-ink">
            {t.dashboard.activityTitle}
          </h2>
          <p className="mt-1 text-[0.8125rem] text-ink-muted">{t.dashboard.activityHint}</p>
        </div>
        {authors.length > 1 && (
          <SegmentedControl
            size="sm"
            label={t.dashboard.activityFilter}
            value={author}
            onValueChange={(v) => {
              setAuthor(v)
              setShown(ACTIVITY_PAGE)
            }}
            options={[
              { value: 'all', label: t.dashboard.activityAll },
              ...authors.map((a) => ({ value: a.id, label: a.name })),
            ]}
            className="max-w-full shrink-0 overflow-x-auto"
          />
        )}
      </div>

      {records && filtered.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">
          {author === 'all' ? t.dashboard.activityEmpty : t.dashboard.activityNoneFor(authorName)}
        </p>
      ) : (
        <ol className="mt-4 divide-y divide-line" data-testid="activity-log">
          {visible.map((r) => (
            <li key={r.id} className="flex items-start gap-3 py-2.5 text-sm">
              <span
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-text uppercase"
                aria-hidden
              >
                {r.author.name.trim().charAt(0) || '?'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-ink">
                  <span className="font-semibold">{r.author.name}</span>
                  {r.author.id === selfId && (
                    <span className="text-ink-muted"> ({t.dashboard.you})</span>
                  )}
                </p>
                <p className="break-words text-ink-muted">
                  {r.kind === 'undo'
                    ? t.history.undone(r.label)
                    : r.kind === 'redo'
                      ? t.history.redone(r.label)
                      : r.label}
                  {r.count > 1 && (
                    <span className="tabular ml-1.5 text-xs">
                      {t.dashboard.activityTimes(r.count)}
                    </span>
                  )}
                </p>
              </div>
              <time
                dateTime={new Date(r.at).toISOString()}
                className="shrink-0 pt-0.5 text-xs text-ink-muted"
              >
                {formatRelativeTime(r.at, intl, t.time.justNow)}
              </time>
            </li>
          ))}
        </ol>
      )}
      {filtered.length > shown && (
        <Button size="sm" className="mt-3" onClick={() => setShown((n) => n + ACTIVITY_PAGE)}>
          {t.dashboard.activityMore}
        </Button>
      )}
    </section>
  )
}

function RecentRolls() {
  const t = useT()
  const intl = useIntlLocale()
  const nameOf = useRollerName()
  const rolls = useRollStore((s) => s.rolls)
  const recent = rolls.slice(-RECENT_ROLLS).reverse()
  return (
    <section aria-labelledby="recent-rolls" className={CARD}>
      <h2 id="recent-rolls" className="type-section text-ink">
        {t.dashboard.rollsTitle}
      </h2>
      {recent.length === 0 ? (
        <p className="mt-3 text-sm text-ink-muted">{t.dashboard.rollsEmpty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {recent.map((r) => (
            <li key={r.id} className="flex gap-3 text-sm">
              <GameIcon
                name="rolling-dices"
                className="mt-0.5 size-3.5 shrink-0 text-accent-text"
                aria-hidden
              />
              <span className="min-w-0 flex-1 break-words text-ink">
                <span className="font-semibold">{nameOf(r)}</span> · {rollSummary(t, r)}
              </span>
              <time
                dateTime={new Date(r.at).toISOString()}
                className="shrink-0 text-xs text-ink-muted"
              >
                {formatRelativeTime(r.at, intl, t.time.justNow)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
