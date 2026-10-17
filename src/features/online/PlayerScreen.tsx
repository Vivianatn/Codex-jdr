import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronDown, ChevronUp, UserRound } from 'lucide-react'
import { GameIcon } from '@/components/GameIcon'
import { lazy, Suspense, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router'
import { Button, IconButton } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { activeDb } from '@/db/db'
import { effectiveStats, entityHpMax, entityName, normalizeEntityShape } from '@/domain/entity'
import { controlledBy } from '@/domain/familiars'
import { playerColorOf } from '@/domain/playerColors'
import { normalizeMap } from '@/domain/maps'
import { galleryPosition, normalizePlayState, turnActors, type PlayerDisplay } from '@/domain/turns'
import { STAT_KEYS, type Entity } from '@/domain/types'
import { HpBar } from '@/features/characters/HpBar'
import { Portrait } from '@/features/characters/Portrait'
import { STAT_STYLES } from '@/features/characters/statStyles'
import { PartyStrip, type Presence } from '@/features/play/PartyStrip'
import { LiveDiceStage } from '@/features/dice/DiceStage'
import { AppHeader } from '@/features/shell/AppHeader'
import { useSurface } from '@/app/useSurface'
import { useIntlLocale, useT } from '@/i18n'
import { chooseCharacter, sendIntent } from '@/online/controller'
import { useOnlineStore } from '@/online/onlineStore'
import { withDefaultRules } from '@/rules'
import { useUiStore } from '@/stores/uiStore'
import { cn } from '@/lib/cn'
import { GuestBadge } from './JoinDialog'

// Konva loads with the board only.
const PlayerBoard = lazy(() => import('./PlayerBoard').then((m) => ({ default: m.PlayerBoard })))

/** A player in someone else's game (D-245): their character, the board, their dice. */
export function PlayerScreen() {
  const t = useT()
  useSurface('play')
  const { campaignId = '' } = useParams()
  const online = useOnlineStore()
  const campaign = useLiveQuery(() => activeDb().campaigns.get(campaignId), [campaignId])
  const entities = useLiveQuery(
    () => activeDb().entities.where('campaignId').equals(campaignId).toArray(),
    [campaignId],
  )
  const maps = useLiveQuery(
    () => activeDb().maps.where('campaignId').equals(campaignId).toArray(),
    [campaignId],
  )
  const rules = useMemo(() => withDefaultRules(campaign?.rules), [campaign?.rules])
  const play = useMemo(() => normalizePlayState(campaign?.play), [campaign?.play])
  const mine = online.peers.find((p) => p.id === online.selfId)?.characterIds ?? []
  const character = entities?.find((e) => e.id === mine[0])
  // The player rolls and moves for their character and its familiars, nothing else (D-269).
  const controlled = [...controlledBy(entities ?? [], mine)]
  const familiars = (entities ?? []).filter(
    (e) => controlled.includes(e.id) && !mine.includes(e.id),
  )
  const entityMap = useMemo(
    () => Object.fromEntries((entities ?? []).map((e) => [e.id, e])),
    [entities],
  )
  const players = useMemo(
    () => (entities ?? []).filter((e) => e.kind === 'player').map(normalizeEntityShape),
    [entities],
  )
  const sheetOpen = useUiStore((s) => s.play.playerSheet)
  const setPanels = useUiStore((s) => s.setPlayPanels)

  if (online.role !== 'guest' || online.guestRole !== 'player' || online.campaignId !== campaignId)
    return <Navigate to="/" replace />

  const raw = maps?.find((m) => m.id === play.mapId)
  const map = raw ? normalizeMap(raw) : null
  const live = play.live
  const canMove = live?.mode === 'online'
  const status = !live
    ? t.online.notStarted
    : live.mode === 'local'
      ? t.online.localMode
      : t.online.dragHint
  const turn = play.turn
  const active = turn.status === 'playing' ? turn.memberId : null
  const actors = turnActors(play, entities ?? [])
  // Who else is at the table (D-272): the players connected to this game.
  const presence = (id: string): Presence => {
    const peer = online.peers.find((p) => p.characterIds.includes(id))
    if (peer?.status === 'connected' || mine.includes(id)) return 'online'
    return live?.mode === 'online' ? 'offline' : null
  }

  return (
    <div className="flex h-full flex-col">
      <AppHeader
        start={<span className="truncate type-card-title text-ink">{campaign?.name}</span>}
        end={<GuestBadge />}
      />
      {!character ? (
        <ChooseCharacter characters={(entities ?? []).filter((e) => e.kind === 'player')} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* Board first (D-272): the map takes every pixel the sheet leaves. */}
          <main
            id="main"
            aria-label={t.play.mapRegion}
            className="@container/board relative min-h-0 flex-1 bg-bg"
          >
            <ShownPicture campaignId={campaignId} display={play.display} />
            {map ? (
              <Suspense fallback={null}>
                <PlayerBoard
                  map={map}
                  entities={entities ?? []}
                  rules={rules}
                  mine={controlled}
                  activeEntityId={active}
                  activeEntityIds={actors}
                  canMove={canMove}
                />
              </Suspense>
            ) : (
              <p className="flex h-full items-center justify-center p-8 text-ink-muted">
                {t.online.noMap}
              </p>
            )}
            <div className="pointer-events-none absolute inset-x-2 top-2 z-20 flex sm:inset-x-3 sm:top-3">
              <PartyStrip
                players={players}
                entities={entities ?? []}
                rules={rules}
                activeIds={actors}
                presence={presence}
                selfIds={mine}
                className="pointer-events-auto w-fit"
              />
            </div>
          </main>
          <aside
            aria-label={t.online.sheet}
            className={cn(
              'flex shrink-0 flex-col border-t border-line bg-surface lg:max-h-none lg:w-80 lg:border-t-0 lg:border-l',
              sheetOpen ? 'max-h-[45%]' : '',
            )}
            data-testid="player-panel"
          >
            <div className="flex shrink-0 items-center gap-2 p-2 sm:px-3">
              <p
                role="status"
                className={cn(
                  'min-w-0 flex-1 rounded-lg px-3 py-2 text-sm',
                  active === character.id
                    ? 'border border-gold-line bg-gold-soft font-semibold text-gold-text'
                    : 'bg-surface-2 text-ink-muted',
                )}
              >
                {active === character.id ? t.online.yourTurn : status}
              </p>
              <IconButton
                label={sheetOpen ? t.party.sheetHide : t.party.sheetShow}
                icon={sheetOpen ? <ChevronDown /> : <ChevronUp />}
                aria-expanded={sheetOpen}
                aria-controls="player-sheet"
                onClick={() => setPanels({ playerSheet: !sheetOpen })}
                className="lg:hidden"
              />
            </div>
            <div
              id="player-sheet"
              className={cn(
                'min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-3 pb-4',
                !sheetOpen && 'max-lg:hidden',
              )}
            >
              <Sheet character={normalizeEntityShape(character)} rules={rules} canAct={canMove} />
              {familiars.length > 0 && (
                <section aria-label={t.crew.yourFamiliars} className="space-y-4">
                  <h2 className="type-eyebrow text-ink-muted">{t.crew.yourFamiliars}</h2>
                  {familiars.map((f) => (
                    <Sheet
                      key={f.id}
                      character={normalizeEntityShape(f)}
                      rules={rules}
                      canAct={canMove}
                      heading="h3"
                    />
                  ))}
                </section>
              )}
              <Rolls campaignId={campaignId} entities={entities ?? []} />
            </div>
          </aside>
          {/* Every roll of the game, big, in the roller's colour (D-268). */}
          <LiveDiceStage campaignId={campaignId} entities={entityMap} active={Boolean(live)} />
        </div>
      )}
    </div>
  )
}

/** The picture the GM shows (D-259), over the board; the series position when there is one. */
function ShownPicture({ campaignId, display }: { campaignId: string; display: PlayerDisplay }) {
  const t = useT()
  const id = display.mode === 'image' ? display.imageAssetId : null
  const src = useLiveQuery(
    async () => (id ? ((await activeDb().assets.get(id))?.data ?? null) : null),
    [campaignId, id],
  )
  if (!src) return null
  const position = galleryPosition(display)
  return (
    <figure className="absolute inset-0 z-10 flex flex-col bg-bg" data-testid="shown-picture">
      <img src={src} alt={t.online.shownPicture} className="min-h-0 flex-1 object-contain" />
      {position && (
        <figcaption className="p-2 text-center text-sm text-ink-muted tabular-nums">
          {position.index + 1} / {position.total}
        </figcaption>
      )}
    </figure>
  )
}

function ChooseCharacter({ characters }: { characters: Entity[] }) {
  const t = useT()
  const peers = useOnlineStore((s) => s.peers)
  const takenBy = (id: string) => peers.find((p) => p.characterIds.includes(id))?.name
  return (
    <main id="main" className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="type-screen-title text-ink">{t.online.chooseTitle}</h1>
      <p className="mt-2 text-sm text-ink-muted">{t.online.chooseBody}</p>
      {characters.length === 0 ? (
        <p className="mt-8 text-ink-muted">{t.online.noCharacters}</p>
      ) : (
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {characters.map((c) => {
            const taken = takenBy(c.id)
            return (
              <li
                key={c.id}
                className="flex items-center gap-3 rounded-lg border border-line bg-surface p-4"
              >
                <Portrait src={c.identity.portrait} name={entityName(c)} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="block type-card-title text-ink">{entityName(c)}</span>
                  <span className="block text-xs text-ink-muted">
                    {c.identity.className} · {taken ? t.online.takenBy(taken) : `Nv ${c.level}`}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="primary"
                  icon={<UserRound />}
                  disabled={Boolean(taken)}
                  onClick={() => chooseCharacter(c.id)}
                >
                  {t.online.choose}
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}

function Sheet({
  character,
  rules,
  canAct,
  heading: Heading = 'h1',
}: {
  character: Entity
  rules: ReturnType<typeof withDefaultRules>
  canAct: boolean
  /** The player's character is the page title; their familiars come under it (D-269). */
  heading?: 'h1' | 'h3'
}) {
  const t = useT()
  const [expression, setExpression] = useState('')
  const stats = effectiveStats(character, rules)
  const max = entityHpMax(character, rules)
  return (
    <section className="space-y-3" data-player-color={playerColorOf(character) ?? undefined}>
      <div className="flex items-center gap-3">
        <Portrait
          src={character.identity.portrait}
          name={entityName(character)}
          size={Heading === 'h1' ? 'md' : 'sm'}
          className={Heading === 'h1' ? 'size-12 text-lg' : undefined}
        />
        <div className="min-w-0">
          <Heading className="truncate type-section text-ink">{entityName(character)}</Heading>
          <p className="text-xs text-ink-muted">
            {character.identity.className} · Nv {character.level}
          </p>
        </div>
      </div>
      <HpBar
        current={character.hp.current}
        max={max}
        temp={character.hp.temp}
        thresholds={rules.hp}
        entityId={character.id}
      />
      {/* One tap per test, four per row (D-272): the whole sheet fits a phone. */}
      <ul className="grid grid-cols-4 gap-1.5">
        {STAT_KEYS.map((stat) => (
          <li key={stat}>
            <button
              type="button"
              className={cn(
                'flex h-11 w-full flex-col items-center justify-center rounded-md leading-tight hover:brightness-95 disabled:opacity-60',
                STAT_STYLES[stat].soft,
              )}
              disabled={!canAct}
              onClick={() =>
                sendIntent({ type: 'check', entityId: character.id, stat, mode: 'normal' })
              }
              aria-label={
                Heading === 'h1'
                  ? t.online.test(t.stats.names[stat])
                  : t.crew.test(t.stats.names[stat], entityName(character))
              }
            >
              <span
                className={cn(
                  'text-[0.625rem] font-bold tracking-[0.08em]',
                  STAT_STYLES[stat].text,
                )}
              >
                {t.stats.abbr[stat]}
              </span>
              <span className="text-sm font-semibold text-ink tabular-nums">
                {stats[stat].total}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (!expression.trim()) return
          sendIntent({ type: 'roll', entityId: character.id, expression: expression.trim() })
          setExpression('')
        }}
      >
        <TextField
          className="flex-1"
          label={Heading === 'h1' ? t.online.rollLabel : t.crew.rollFor(entityName(character))}
          placeholder={t.online.rollPlaceholder}
          value={expression}
          maxLength={60}
          disabled={!canAct}
          onChange={(e) => setExpression(e.target.value)}
        />
        <Button
          type="submit"
          variant="primary"
          icon={<GameIcon name="rolling-dices" />}
          disabled={!canAct || !expression.trim()}
        >
          {t.online.roll}
        </Button>
      </form>
    </section>
  )
}

function Rolls({ campaignId, entities }: { campaignId: string; entities: Entity[] }) {
  const t = useT()
  const locale = useIntlLocale()
  const rolls = useLiveQuery(
    async () =>
      (await activeDb().rolls.where('campaignId').equals(campaignId).toArray())
        .sort((a, b) => b.at - a.at)
        .slice(0, 10),
    [campaignId],
  )
  const name = (id: string | null) => {
    const e = entities.find((x) => x.id === id)
    return e ? entityName(e) : t.turns.gmTurn
  }
  return (
    <section>
      <h2 className="type-eyebrow text-ink-muted">{t.online.rolls}</h2>
      {!rolls?.length ? (
        <p className="mt-1 text-xs text-ink-muted">{t.online.noRolls}</p>
      ) : (
        <ul className="mt-2 space-y-1.5" data-testid="player-rolls">
          {rolls.map((r) => (
            <li key={r.id} className="flex items-baseline justify-between gap-2 text-sm">
              <span className="min-w-0 truncate text-ink">
                {name(r.entityId)} · {r.label}
              </span>
              <span className="shrink-0 font-display text-base font-bold text-ink tabular-nums">
                {r.total}
              </span>
              <span className="sr-only">{new Date(r.at).toLocaleTimeString(locale)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
