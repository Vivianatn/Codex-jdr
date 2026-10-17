import { toast } from 'sonner'
import type { Campaign } from '@/db/types'
import type { Rng } from '@/dice'
import { entityName } from '@/domain/entity'
import { familiarSpot, familiarsOf, masterOf } from '@/domain/familiars'
import {
  arrivalCell,
  autoRevealFog,
  cellCenter,
  inBounds,
  isBlocking,
  passageAt,
  PERCEPTION_STAT,
  tokenCenter,
  tokensInArea,
  withToken,
  type AreaShape,
  type Cell,
  type GameMap,
  type Token,
} from '@/domain/maps'
import { groupOf, removeMember } from '@/domain/turns'
import type { StatKey } from '@/domain/types'
import type { Messages } from '@/i18n/locales/fr'
import { resolveCheck } from '@/rules'
import { campaignHistory, useCampaignStore } from '@/stores/campaignStore'
import type { GameActions } from './gameActions'

/**
 * What the GM does on a map during play (D-228): each action is ONE undoable
 * step (with its dice in the history), like the rest of the game actions.
 */
export function createMapActions(t: Messages, campaign: Campaign, game: GameActions, rng?: Rng) {
  const rules = campaign.rules
  const store = () => useCampaignStore.getState()
  const mapOf = (id: string) => store().maps[id]
  const entity = (id: string) => store().entities[id]
  void rng

  /** Player tokens open the fog around them (when the map asks for it). */
  const withAutoReveal = (map: GameMap): GameMap => {
    const viewers = map.tokens.filter((tk) => entity(tk.entityId)?.kind === 'player')
    const revealed = autoRevealFog(map, viewers)
    return revealed === map.fog.revealed ? map : { ...map, fog: { ...map.fog, revealed } }
  }

  /**
   * A token that steps on a passage goes alone to the other map (D-256): the
   * board in play stays where it is. One undoable step for both maps.
   */
  const travel = (from: GameMap, token: Token, to: GameMap, name: string) => {
    const cell = arrivalCell(to, from.id, token.entityId)
    const label = t.maps.wentThrough(name, to.name)
    campaignHistory.getState().transaction(label, () => {
      store().updateMap(
        from.id,
        (m) => withAutoReveal({ ...m, tokens: m.tokens.filter((tk) => tk.id !== token.id) }),
        label,
      )
      store().updateMap(
        to.id,
        (m) =>
          withAutoReveal({
            ...m,
            tokens: [
              ...m.tokens.filter((tk) => tk.entityId !== token.entityId),
              { ...token, ...cell },
            ],
          }),
        label,
      )
    })
    toast(label)
  }

  const actions = {
    /** Puts a character on the map (or moves its token there). */
    placeToken(mapId: string, entityId: string, at?: Cell) {
      const e = entity(entityId)
      if (!mapOf(mapId) || !e) return
      store().updateMap(
        mapId,
        (m) => withAutoReveal(withToken(m, e, at)),
        t.maps.placed(entityName(e)),
      )
    },

    moveToken(mapId: string, tokenId: string, cell: Cell) {
      const map = mapOf(mapId)
      const token = map?.tokens.find((tk) => tk.id === tokenId)
      if (!map || !token || !inBounds(map, cell)) return
      if (token.col === cell.col && token.row === cell.row) return
      const name = entityName(
        entity(token.entityId) ?? ({ identity: { pseudo: '', discordName: '' } } as never),
      )
      const passage = passageAt(map, cell, token.size)
      const target = passage?.link?.mapId ? mapOf(passage.link.mapId) : undefined
      if (target) return travel(map, token, target, name)
      store().updateMap(
        mapId,
        (m) =>
          withAutoReveal({
            ...m,
            tokens: m.tokens.map((tk) => (tk.id === tokenId ? { ...tk, ...cell } : tk)),
          }),
        t.maps.moved(name),
      )
    },

    updateToken(
      mapId: string,
      tokenId: string,
      patch: Partial<Pick<Token, 'size' | 'hidden'>>,
      label: string,
    ) {
      store().updateMap(
        mapId,
        (m) => ({
          ...m,
          tokens: m.tokens.map((tk) => (tk.id === tokenId ? { ...tk, ...patch } : tk)),
        }),
        label,
      )
    },

    removeToken(mapId: string, tokenId: string, label: string) {
      store().updateMap(
        mapId,
        (m) => ({ ...m, tokens: m.tokens.filter((tk) => tk.id !== tokenId) }),
        label,
      )
    },

    // ---------------------------------------------------------------------
    // The GM's board in play (D-269): each gesture is ONE undoable change.
    // ---------------------------------------------------------------------

    /**
     * Takes a character off every map, with the familiars attached to it, and
     * out of the turns when `fromTurns` is set. Never deletes the character.
     */
    removeFromBoard(entityId: string, options: { fromTurns?: boolean } = {}) {
      const e = entity(entityId)
      if (!e) return
      const leaving = new Set([
        entityId,
        ...familiarsOf(Object.values(store().entities), entityId).map((f) => f.id),
      ])
      const label = t.crew.removedFromBoard(entityName(e))
      campaignHistory.getState().transaction(label, () => {
        for (const map of Object.values(store().maps))
          if (map.tokens.some((tk) => leaving.has(tk.entityId)))
            store().updateMap(
              map.id,
              (m) =>
                withAutoReveal({
                  ...m,
                  tokens: m.tokens.filter((tk) => !leaving.has(tk.entityId)),
                }),
              label,
            )
        if (options.fromTurns && groupOf(store().play, entityId))
          store().updatePlay((p) => removeMember(p, entityId), label)
      })
      toast(label)
    },

    /**
     * Deletes an enemy (D-269): it leaves the campaign, the maps and the groups
     * (the store does that); its familiars' tokens leave the board with it.
     */
    deleteEnemy(entityId: string) {
      const e = entity(entityId)
      if (!e || e.kind !== 'enemy') return
      const label = t.crew.enemyDeleted(entityName(e))
      campaignHistory.getState().transaction(label, () => {
        const familiars = new Set(
          familiarsOf(Object.values(store().entities), entityId).map((f) => f.id),
        )
        if (familiars.size)
          for (const map of Object.values(store().maps))
            if (map.tokens.some((tk) => familiars.has(tk.entityId)))
              store().updateMap(
                map.id,
                (m) => ({ ...m, tokens: m.tokens.filter((tk) => !familiars.has(tk.entityId)) }),
                label,
              )
        store().removeEntity(entityId, label)
      })
      toast(label)
    },

    /**
     * Brings a familiar onto the map, next to its master's token (or at the
     * default spot when the master has none). It plays at its master's turn.
     */
    addFamiliar(mapId: string, familiarId: string) {
      const map = mapOf(mapId)
      const familiar = entity(familiarId)
      const master = masterOf(store().entities, familiar)
      if (!map || !familiar || !master) return
      const masterToken = map.tokens.find((tk) => tk.entityId === master.id)
      const cell = masterToken ? familiarSpot(map, masterToken, familiarId) : null
      const label = t.crew.familiarPlaced(entityName(familiar), entityName(master))
      campaignHistory.getState().transaction(label, () => {
        store().updateMap(
          mapId,
          (m) => {
            const placed = withToken(m, familiar, cell ?? undefined)
            // A familiar stays as discreet as its master.
            if (!masterToken) return withAutoReveal(placed)
            return withAutoReveal({
              ...placed,
              tokens: placed.tokens.map((tk) =>
                tk.entityId === familiarId ? { ...tk, hidden: masterToken.hidden } : tk,
              ),
            })
          },
          label,
        )
        if (groupOf(store().play, familiarId))
          store().updatePlay((p) => removeMember(p, familiarId), label)
      })
      toast(label)
    },

    /** Re-applies the automatic reveal (after opening a door, changing the vision…). */
    refreshFog(mapId: string) {
      store().updateMap(mapId, withAutoReveal, t.maps.fogRevealed)
    },

    toggleDoor(mapId: string, wallId: string) {
      const wall = mapOf(mapId)?.walls.find((w) => w.id === wallId)
      if (!wall?.door) return
      if (wall.door.locked && !wall.door.open) {
        toast(t.maps.doorLocked)
        return
      }
      store().updateMap(
        mapId,
        (m) =>
          withAutoReveal({
            ...m,
            walls: m.walls.map((w) =>
              w.id === wallId && w.door ? { ...w, door: { ...w.door, open: !w.door.open } } : w,
            ),
          }),
        wall.door.open ? t.maps.doorClosed : t.maps.doorOpened,
      )
    },

    setDoorLock(mapId: string, wallId: string, locked: boolean) {
      store().updateMap(
        mapId,
        (m) => ({
          ...m,
          walls: m.walls.map((w) =>
            w.id === wallId && w.door ? { ...w, door: { ...w.door, locked } } : w,
          ),
        }),
        locked ? t.maps.doorLockedLabel : t.maps.doorUnlocked,
      )
    },

    /** Lockpicking (Dexterity, SPEC §4.5): the door's difficulty is a malus. */
    pickLock(mapId: string, wallId: string, entityId: string) {
      const wall = mapOf(mapId)?.walls.find((w) => w.id === wallId)
      if (!wall?.door) return null
      let result: ReturnType<GameActions['check']> = null
      campaignHistory.getState().transaction(t.maps.pickLock, () => {
        result = game.check(entityId, 'dexterity', {
          bonus: -wall.door!.difficulty,
          label: t.checks.label(t.checks.lockpicking, t.stats.names.dexterity),
        })
        if (result?.check.outcome.success) actions.setDoorLock(mapId, wallId, false)
      })
      const r = result as ReturnType<GameActions['check']>
      toast(r?.check.outcome.success ? t.maps.lockPicked : t.maps.lockResists)
      return r
    },

    /**
     * Group perception (SPEC §4.8): every player on the map rolls Wisdom once;
     * each hidden trap is spotted if one of them succeeds despite its difficulty.
     */
    groupPerception(mapId: string) {
      const map = mapOf(mapId)
      if (!map) return []
      const players = map.tokens
        .map((tk) => entity(tk.entityId))
        .filter((e) => e?.kind === 'player')
      const traps = map.elements.filter((el) => el.trap && !el.trap.detected)
      const found = new Set<string>()
      campaignHistory.getState().transaction(t.maps.perception, () => {
        for (const p of players) {
          const r = game.check(p!.id, PERCEPTION_STAT, {
            label: t.checks.label(t.maps.perception, t.stats.names[PERCEPTION_STAT]),
          })
          if (!r) continue
          for (const trap of traps) {
            const outcome = resolveCheck(
              {
                natural: r.check.natural,
                value: r.check.value,
                bonus: r.check.bonus - trap.trap!.difficulty,
                luck: 0,
              },
              rules,
            )
            if (outcome.success) found.add(trap.id)
          }
        }
        if (found.size)
          store().updateMap(
            mapId,
            (m) => ({
              ...m,
              elements: m.elements.map((el) =>
                found.has(el.id) && el.trap
                  ? { ...el, hidden: false, trap: { ...el.trap, detected: true } }
                  : el,
              ),
            }),
            t.maps.perception,
          )
      })
      toast(found.size ? t.maps.trapsFound(found.size) : t.maps.nothingFound)
      return [...found]
    },

    /** Trap fires on the tokens standing on it (or the chosen ones). */
    triggerTrap(mapId: string, elementId: string, targetIds?: string[]) {
      const map = mapOf(mapId)
      const el = map?.elements.find((x) => x.id === elementId)
      if (!map || !el?.trap) return
      const box = { x: el.x, y: el.y, w: el.w, h: el.h }
      const victims =
        targetIds ??
        map.tokens
          .filter(
            (tk) =>
              tk.col >= box.x &&
              tk.col < box.x + box.w &&
              tk.row >= box.y &&
              tk.row < box.y + box.h,
          )
          .map((tk) => tk.entityId)
      const effect = el.trap.effect
      campaignHistory
        .getState()
        .transaction(t.maps.trapTriggered(el.label || t.maps.kinds.trap), () => {
          if (effect.kind === 'damage' && effect.expression.trim())
            for (const id of victims) {
              const r = game.freeRoll(effect.expression, {
                entityId: null,
                label: t.maps.trapDamage(el.label || t.maps.kinds.trap),
              })
              game.applyHp(id, {
                kind: 'damage',
                amount: Math.max(0, r.total),
                source: el.label || t.maps.kinds.trap,
              })
            }
          if (effect.kind === 'condition' && effect.conditionId && victims.length)
            game.addConditionFromTemplate(victims, effect.conditionId)
          store().updateMap(
            mapId,
            (m) => ({
              ...m,
              elements: m.elements.map((x) =>
                x.id === elementId && x.trap
                  ? { ...x, hidden: false, trap: { ...x.trap, triggered: true, detected: true } }
                  : x,
              ),
            }),
            t.maps.trapTriggered(el.label || t.maps.kinds.trap),
          )
        })
      toast(t.maps.trapTriggered(el.label || t.maps.kinds.trap))
    },

    /** Characters inside an area of effect (SPEC §5.2). */
    areaTargets(mapId: string, area: AreaShape): string[] {
      const map = mapOf(mapId)
      return map ? tokensInArea(map, area).map((tk) => tk.entityId) : []
    },

    /**
     * Area damage / healing: one roll for everyone; with a save, those who
     * succeed take half (rounded down) — "moitié pour ceux qui réussissent".
     */
    areaHp(
      targetIds: string[],
      input: { kind: 'damage' | 'heal'; expression: string; save: StatKey | null; label: string },
    ) {
      campaignHistory.getState().transaction(input.label, () => {
        const r = game.freeRoll(input.expression, { entityId: null, label: input.label })
        const amount = Math.max(0, r.total)
        for (const id of targetIds) {
          let value = amount
          if (input.kind === 'damage' && input.save) {
            const save = game.check(id, input.save, {
              label: t.checks.label(t.maps.areaSave, t.stats.names[input.save]),
            })
            if (save?.check.outcome.success) value = Math.floor(amount / 2)
          }
          game.applyHp(id, { kind: input.kind, amount: value, source: input.label })
        }
      })
    },

    applyCondition(targetIds: string[], templateId: string) {
      game.addConditionFromTemplate(targetIds, templateId)
    },

    areaCheck(targetIds: string[], stat: StatKey) {
      campaignHistory.getState().transaction(t.checks.plain(t.stats.names[stat]), () => {
        for (const id of targetIds) game.check(id, stat)
      })
    },

    /** Centre of an entity's token, for the camera ("follow the turn"). */
    tokenPoint(mapId: string, entityId: string) {
      const map = mapOf(mapId)
      const token = map?.tokens.find((tk) => tk.entityId === entityId)
      return map && token ? tokenCenter(map.grid, token) : null
    },

    isBlockingWall: isBlocking,
    cellCenter,
  }
  return actions
}

export type MapActions = ReturnType<typeof createMapActions>
