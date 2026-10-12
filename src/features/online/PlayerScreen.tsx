import { useLiveQuery } from 'dexie-react-hooks'
import { UserRound } from 'lucide-react'
import { GameIcon } from '@/components/GameIcon'
import { lazy, Suspense, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { activeDb } from '@/db/db'
import { effectiveStats, entityHpMax, entityName, normalizeEntityShape } from '@/domain/entity'
import { normalizeMap } from '@/domain/maps'
import { normalizePlayState } from '@/domain/turns'
import { STAT_KEYS, type Entity } from '@/domain/types'
import { Portrait } from '@/features/characters/Portrait'
import { AppHeader } from '@/features/shell/AppHeader'
import { useSurface } from '@/app/useSurface'
import { useIntlLocale, useT } from '@/i18n'
import { chooseCharacter, sendIntent } from '@/online/controller'
import { useOnlineStore } from '@/online/onlineStore'
import { withDefaultRules } from '@/rules'
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
          <main
            id="main"
            aria-label={t.play.mapRegion}
            className="relative min-h-[50vh] flex-1 bg-bg"
          >
            {map ? (
              <Suspense fallback={null}>
                <PlayerBoard
                  map={map}
                  entities={entities ?? []}
                  rules={rules}
                  mine={mine}
                  activeEntityId={active}
                  canMove={canMove}
                />
              </Suspense>
            ) : (
              <p className="flex h-full items-center justify-center p-8 text-ink-muted">
                {t.online.noMap}
              </p>
            )}
          </main>
          <aside
            aria-label={t.online.sheet}
            className="w-full shrink-0 space-y-5 overflow-y-auto border-l border-line bg-surface p-4 lg:w-80"
            data-testid="player-panel"
          >
            <p role="status" className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink-muted">
              {active === character.id ? t.online.yourTurn : status}
            </p>
            <Sheet character={normalizeEntityShape(character)} rules={rules} canAct={canMove} />
            <Rolls campaignId={campaignId} entities={entities ?? []} />
          </aside>
        </div>
      )}
    </div>
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
}: {
  character: Entity
  rules: ReturnType<typeof withDefaultRules>
  canAct: boolean
}) {
  const t = useT()
  const [expression, setExpression] = useState('')
  const stats = effectiveStats(character, rules)
  const max = entityHpMax(character, rules)
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <Portrait src={character.identity.portrait} name={entityName(character)} size="md" />
        <div className="min-w-0">
          <h1 className="truncate type-section text-ink">{entityName(character)}</h1>
          <p className="text-xs text-ink-muted">
            {character.identity.className} · Nv {character.level}
          </p>
        </div>
      </div>
      <p className="text-sm text-ink tabular-nums">
        <strong>{character.hp.current}</strong> / {max} PV
        {character.hp.temp > 0 && <span className="text-ink-muted"> (+{character.hp.temp})</span>}
      </p>
      <ul className="grid grid-cols-2 gap-2">
        {STAT_KEYS.map((stat) => (
          <li key={stat}>
            <Button
              size="sm"
              className="w-full justify-between"
              disabled={!canAct}
              onClick={() =>
                sendIntent({ type: 'check', entityId: character.id, stat, mode: 'normal' })
              }
              aria-label={t.online.test(t.stats.names[stat])}
            >
              <span>{t.stats.abbr[stat]}</span>
              <span className="tabular-nums">{stats[stat].total}</span>
            </Button>
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
          label={t.online.rollLabel}
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
        .slice(0, 15),
    [campaignId],
  )
  const name = (id: string | null) => {
    const e = entities.find((x) => x.id === id)
    return e ? entityName(e) : t.turns.gmTurn
  }
  return (
    <section>
      <h2 className="text-sm font-semibold text-ink">{t.online.rolls}</h2>
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
