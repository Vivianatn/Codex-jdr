import { toast } from 'sonner'
import { roll, withAdvantage, type Rng } from '@/dice'
import {
  opposedWinner,
  parseHpInput,
  performCheck,
  type CheckRoll,
  type RollMode,
} from '@/domain/checks'
import { allConditionTemplates, conditionFromTemplate, startOfTurn } from '@/domain/conditions'
import { entityHpMax, entityName, withJournal } from '@/domain/entity'
import {
  equip,
  equippedWeapon,
  formatPurse,
  removeUnits,
  slotsFor,
  transferItem,
  unequip,
} from '@/domain/items'
import { nextTurn, resumeTurns, startTurns, stopTurns, type TurnState } from '@/domain/turns'
import {
  levelForXp,
  longRest,
  luckPointsLeft,
  setExhaustion,
  shiftDisposition,
  shortRest,
  skillBlock,
  spendSkill,
} from '@/domain/progress'
import type { RollRecord } from '@/domain/rolls'
import type { Entity, Item, StatKey } from '@/domain/types'
import type { Campaign } from '@/db/types'
import type { Messages } from '@/i18n/locales/fr'
import { applyHpDelta, hpBand, statModifier, type RulesConfig } from '@/rules'
import { campaignHistory, useCampaignStore } from '@/stores/campaignStore'
import { useFxStore } from '@/stores/fxStore'
import { useRollStore, type NewRoll } from '@/stores/rollStore'
import { clamp } from '@/lib/numbers'

export interface CheckRequest {
  mode?: RollMode
  bonus?: number
  secret?: boolean
  /** Shown in the history, e.g. "Discrétion (Dextérité)". Defaults to "Test de X". */
  label?: string
  difficulty?: number
  note?: string
}

export type HpChange = { kind: 'damage' | 'heal' | 'temp'; amount: number; source?: string }

/**
 * Everything the GM can *do* with a sheet during play. Each action records its
 * dice in the roll history and applies its effects as ONE undoable change.
 * Built from store `getState()` calls so it can be used outside React too.
 */
export function createGameActions(t: Messages, campaign: Campaign, rng?: Rng) {
  const rules: RulesConfig = campaign.rules
  const store = () => useCampaignStore.getState()
  const get = (id: string) => store().entities[id]
  const statName = (stat: StatKey) => t.stats.names[stat]

  function record(input: NewRoll): RollRecord {
    const saved = useRollStore.getState().add(input)
    useFxStore.getState().animateRoll(saved.id)
    return saved
  }

  function checkRecord(
    entity: Entity,
    check: CheckRoll,
    request: CheckRequest,
    kind: NewRoll['kind'] = 'check',
    rerollOf: string | null = null,
  ) {
    return record({
      entityId: entity.id,
      kind,
      label: request.label ?? t.checks.plain(statName(check.stat)),
      expression: check.dice.expression,
      total: check.natural,
      breakdown: check.dice.breakdown,
      groups: check.dice.groups,
      secret: request.secret ?? false,
      check: {
        stat: check.stat,
        value: check.value,
        bonus: check.bonus,
        mode: check.mode,
        natural: check.natural,
        outcome: check.outcome,
      },
      rerollOf,
      note: request.note ?? '',
    })
  }

  function dieRecord(
    entityId: string | null,
    label: string,
    expression: string,
    kind: NewRoll['kind'],
    secret = false,
  ) {
    const r = roll(expression, { rng, rounding: rules.stats.rounding })
    return record({
      entityId,
      kind,
      label,
      expression: r.expression,
      total: r.total,
      breakdown: r.breakdown,
      groups: r.groups,
      secret,
      check: null,
      rerollOf: null,
      note: '',
    })
  }

  const actions = {
    /** Free roll from the dice tray. Throws DiceSyntaxError on bad notation. */
    freeRoll(
      expression: string,
      options: { entityId?: string | null; secret?: boolean; mode?: RollMode; label?: string } = {},
    ) {
      const expr = withAdvantage(expression, options.mode ?? 'normal')
      return dieRecord(
        options.entityId ?? null,
        options.label ?? expr,
        expr,
        'free',
        options.secret,
      )
    },

    check(entityId: string, stat: StatKey, request: CheckRequest = {}) {
      const entity = get(entityId)
      if (!entity) return null
      const check = performCheck(entity, stat, rules, {
        mode: request.mode,
        bonus: request.bonus,
        difficulty: request.difficulty,
        rng,
      })
      return { check, record: checkRecord(entity, check, request) }
    },

    /** Damage / heal / temporary HP, with the concentration prompt and visual effects. */
    applyHp(entityId: string, change: HpChange, label?: string) {
      const entity = get(entityId)
      if (!entity || change.amount < 0) return
      const name = entityName(entity)
      const max = entityHpMax(entity, rules)
      const before = hpBand(entity.hp.current, max, rules.hp)
      store().updateEntity(
        entityId,
        (e) => {
          if (change.kind === 'temp') {
            return withJournal(
              { ...e, hp: { ...e.hp, temp: e.hp.temp + change.amount } },
              'hp',
              t.hp.temp(name, change.amount),
            )
          }
          const hp = applyHpDelta(
            e.hp,
            change.kind === 'damage' ? -change.amount : change.amount,
            max,
          )
          const text =
            change.kind === 'damage'
              ? t.journal.damage(change.amount, change.source ?? '')
              : t.journal.heal(change.amount, change.source ?? '')
          return withJournal({ ...e, hp: { ...e.hp, ...hp } }, 'hp', text)
        },
        label ??
          (change.kind === 'damage'
            ? t.hp.damaged(name, change.amount)
            : change.kind === 'heal'
              ? t.hp.healed(name, change.amount)
              : t.hp.temp(name, change.amount)),
      )
      const after = get(entityId)
      if (!after) return
      const band = hpBand(after.hp.current, max, rules.hp)
      const severe =
        change.kind === 'damage' && band !== before && (band === 'critical' || band === 'down')
      useFxStore.getState().pushHp({ entityId, kind: change.kind, amount: change.amount, severe })
      if (change.kind === 'damage' && band === 'down' && before !== 'down')
        toast.error(t.hp.down(name))
      if (
        change.kind === 'damage' &&
        change.amount > 0 &&
        after.conditions.some((c) => c.concentration)
      ) {
        toast(t.hp.concentration(name), {
          duration: 15_000,
          action: {
            label: t.hp.concentrationAction,
            onClick: () => actions.concentrationCheck(entityId),
          },
        })
      }
    },

    /** "-7", "+5", "t+4", "-2d6". Returns an error message, or null when applied. */
    applyHpText(entityId: string, text: string): string | null {
      const input = parseHpInput(text)
      if (!input) return t.hp.invalid
      let amount: number
      if (/^\d+$/.test(input.expression)) amount = Number(input.expression)
      else {
        try {
          const entity = get(entityId)
          amount = Math.max(
            0,
            dieRecord(
              entityId,
              entity ? entityName(entity) : '',
              input.expression,
              input.kind === 'damage' ? 'damage' : 'heal',
            ).total,
          )
        } catch {
          return t.hp.invalid
        }
      }
      actions.applyHp(entityId, { kind: input.kind, amount })
      return null
    },

    concentrationCheck(entityId: string) {
      const entity = get(entityId)
      if (!entity) return
      const name = entityName(entity)
      const result = actions.check(entityId, 'constitution', {
        label: t.checks.label(t.checks.concentration, statName('constitution')),
      })
      if (!result) return
      if (result.check.outcome.success) toast.success(t.hp.concentrationKept(name))
      else {
        store().updateEntity(
          entityId,
          (e) => ({ ...e, conditions: e.conditions.filter((c) => !c.concentration) }),
          t.hp.concentrationLost(name),
        )
        toast.warning(t.hp.concentrationLost(name))
      }
    },

    /** Start of the character's turn (SPEC §4.10/§6); reused by the combat tracker. */
    passTurn(entityId: string) {
      const entity = get(entityId)
      if (!entity) return
      const name = entityName(entity)
      const { entity: next, events } = startOfTurn(entity, rules, entityHpMax(entity, rules), rng)
      let journaled = next
      for (const ev of events) {
        if (ev.type === 'perTurn')
          journaled = withJournal(journaled, 'hp', t.turn.perTurn(ev.condition, ev.kind, ev.amount))
        if (ev.type === 'expired')
          journaled = withJournal(journaled, 'condition', t.turn.expired(ev.condition, name))
      }
      store().updateEntity(entityId, () => journaled, t.turn.passed(name))

      const damage = events.reduce(
        (sum, ev) => sum + (ev.type === 'perTurn' && ev.kind === 'damage' ? ev.amount : 0),
        0,
      )
      if (damage > 0)
        useFxStore
          .getState()
          .pushHp({ entityId, kind: 'damage', amount: damage, severe: next.hp.current === 0 })
      for (const ev of events) {
        if (ev.type === 'perTurn') toast(t.turn.perTurn(ev.condition, ev.kind, ev.amount))
        if (ev.type === 'expired') toast.info(t.turn.expired(ev.condition, name))
        if (ev.type === 'cooldownReady') toast.info(t.turn.cooldownReady(ev.skill))
        if (ev.type === 'save') {
          const condition = next.conditions.find((c) => c.name === ev.condition)
          if (condition)
            toast(t.turn.save(ev.condition, statName(ev.stat)), {
              duration: 15_000,
              action: {
                label: t.turn.saveAction,
                onClick: () => actions.trySave(entityId, condition.id),
              },
            })
        }
      }
      return events
    },

    trySave(entityId: string, conditionId: string) {
      const entity = get(entityId)
      const condition = entity?.conditions.find((c) => c.id === conditionId)
      if (!entity || !condition?.save) return null
      const result = actions.check(entityId, condition.save, {
        label: t.checks.label(t.conditions.trySave(statName(condition.save)), condition.name),
      })
      if (!result) return null
      if (result.check.outcome.success) {
        store().updateEntity(
          entityId,
          (e) =>
            withJournal(
              { ...e, conditions: e.conditions.filter((c) => c.id !== conditionId) },
              'condition',
              t.turn.freed(condition.name),
            ),
          t.turn.freed(condition.name),
        )
        toast.success(t.turn.freed(condition.name))
      } else toast(t.turn.notFreed(condition.name))
      return result
    },

    addConditionFromTemplate(entityIds: string[], templateId: string) {
      const template = allConditionTemplates(campaign.library.conditions).find(
        (c) => c.id === templateId,
      )
      if (!template) return
      campaignHistory.getState().transaction(t.conditions.add, () => {
        for (const id of entityIds)
          store().updateEntity(
            id,
            (e) =>
              withJournal(
                { ...e, conditions: [...e.conditions, conditionFromTemplate(template)] },
                'condition',
                t.journal.conditionAdded(template.name),
              ),
            t.conditions.add,
          )
      })
    },

    /** Melee (Strength) or ranged (Dexterity) attack; damage is applied to the target on a hit. */
    attack(
      attackerId: string,
      options: {
        kind: 'melee' | 'ranged'
        targetId: string | null
        mode?: RollMode
        /** Damage dice chosen by the GM; defaults to the weapon / unarmed rule. '' = no damage roll. */
        damage?: string
      },
    ) {
      const attacker = get(attackerId)
      if (!attacker) return null
      const stat: StatKey = options.kind === 'melee' ? 'strength' : 'dexterity'
      const label =
        options.kind === 'melee'
          ? t.checks.melee.replace('…', '')
          : t.checks.ranged.replace('…', '')
      const result = actions.check(attackerId, stat, {
        mode: options.mode,
        label: t.checks.label(label, statName(stat)),
      })
      if (!result || !result.check.outcome.success) {
        toast(t.attack.miss)
        return { ...result, damage: null }
      }
      const weapon = equippedWeapon(attacker)
      let expression = (options.damage ?? (weapon?.damage || rules.combat.unarmedDamage)).trim()
      const target = options.targetId ? get(options.targetId) : null
      if (!expression) {
        // No damage rule and nothing typed: the GM resolves the hit by hand.
        toast.success(target ? t.attack.hitNoDamage(entityName(target)) : t.attack.hitPlain)
        return { ...result, damage: null }
      }
      if (options.kind === 'melee' && rules.combat.strengthDamageBonus) {
        const bonus = statModifier(result.check.value)
        if (bonus) expression = `${expression}${bonus > 0 ? '+' : ''}${bonus}`
      }
      const weaponName = weapon?.name ?? t.attack.noWeapon
      const damage = dieRecord(attackerId, t.attack.damageLabel(weaponName), expression, 'damage')
      const amount = Math.max(0, damage.total)
      if (target) {
        actions.applyHp(target.id, {
          kind: 'damage',
          amount,
          source: `${entityName(attacker)} — ${weaponName}`,
        })
        toast.success(t.attack.hit(amount, entityName(target)))
      } else toast.success(t.attack.hitNoTarget(amount))
      return { ...result, damage }
    },

    opposed(aId: string, aStat: StatKey, bId: string, bStat: StatKey) {
      const a = get(aId)
      const b = get(bId)
      if (!a || !b) return null
      const label = t.checks.opposed.replace('…', '')
      const first = actions.check(aId, aStat, { label: `${label} — ${statName(aStat)}` })!
      const second = actions.check(bId, bStat, { label: `${label} — ${statName(bStat)}` })!
      return { first, second, winner: opposedWinner(first.check.outcome, second.check.outcome) }
    },

    /** Persuasion / intimidation / deception on an ally: moves its disposition gauge. */
    social(
      entityId: string,
      action: 'persuasion' | 'intimidation' | 'deception',
      targetId: string,
    ) {
      const target = get(targetId)
      if (!target || target.kind !== 'ally') return null
      const result = actions.check(entityId, 'charisma', {
        label: t.checks.label(t.checks[action], statName('charisma')),
      })
      if (!result) return null
      const from = target.details.disposition
      const to = shiftDisposition(from, result.check.outcome, rules)
      const fromLabel = t.details.dispositions[from]
      const toLabel = t.details.dispositions[to]
      if (from !== to) {
        store().updateEntity(
          targetId,
          (e) =>
            e.kind === 'ally'
              ? withJournal(
                  { ...e, details: { ...e.details, disposition: to } },
                  'edit',
                  t.journal.disposition(fromLabel, toLabel),
                )
              : e,
          t.social.moved(entityName(target), fromLabel, toLabel),
        )
        toast(t.social.moved(entityName(target), fromLabel, toLabel))
      } else toast(t.social.unchanged(entityName(target), toLabel))
      return { ...result, from, to }
    },

    insight(entityId: string) {
      const result = actions.check(entityId, 'wisdom', {
        secret: true,
        label: t.checks.label(t.checks.insight, statName('wisdom')),
      })
      return result
    },

    identify(entityId: string, itemId: string) {
      const entity = get(entityId)
      const item = entity?.inventory.find((i) => i.id === itemId)
      if (!entity || !item?.hidden || item.hidden.identified) return null
      const result = actions.check(entityId, 'intelligence', {
        bonus: -item.hidden.difficulty,
        label: t.checks.label(t.identify.title, item.name),
      })
      if (!result) return null
      if (result.check.outcome.success) {
        store().updateEntity(
          entityId,
          (e) =>
            withJournal(
              {
                ...e,
                inventory: e.inventory.map((i) =>
                  i.id === itemId && i.hidden
                    ? { ...i, hidden: { ...i.hidden, identified: true } }
                    : i,
                ),
              },
              'item',
              t.journal.identified(item.name),
            ),
          t.identify.revealed(item.name),
        )
        toast.success(t.identify.revealed(item.name))
      } else toast(t.identify.failed(item.name))
      return result
    },

    /** "Utiliser" a consumable: rolls its effect on its owner and spends one unit. */
    useItem(entityId: string, itemId: string) {
      const entity = get(entityId)
      const item = entity?.inventory.find((i) => i.id === itemId)
      if (!entity || !item) return
      campaignHistory.getState().transaction(t.inventory.used(item.name), () => {
        store().updateEntity(
          entityId,
          (e) => withJournal(removeUnits(e, itemId, 1), 'item', t.journal.itemUsed(item.name)),
          t.inventory.used(item.name),
        )
        if (item.use?.expression) {
          const r = dieRecord(
            entityId,
            item.name,
            item.use.expression,
            item.use.kind === 'heal' ? 'heal' : 'damage',
          )
          actions.applyHp(entityId, {
            kind: item.use.kind,
            amount: Math.max(0, r.total),
            source: item.name,
          })
        }
      })
      toast.success(t.inventory.used(item.name))
    },

    giveItem(fromId: string, toId: string, itemId: string, quantity = 1) {
      const from = get(fromId)
      const to = get(toId)
      const item = from?.inventory.find((i) => i.id === itemId)
      if (!from || !to || !item || fromId === toId) return
      const moved = transferItem(from, to, itemId, quantity)
      if (!moved) return
      const [a, b] = moved
      campaignHistory.getState().transaction(t.inventory.given(item.name, entityName(to)), () => {
        store().updateEntity(
          fromId,
          () => withJournal(a, 'item', t.journal.itemGiven(item.name, entityName(to))),
          '',
        )
        store().updateEntity(
          toId,
          () => withJournal(b, 'item', t.journal.itemReceived(item.name, entityName(from))),
          '',
        )
      })
      toast.success(t.inventory.given(item.name, entityName(to)))
    },

    launchSkill(entityId: string, skillId: string, targetIds: string[], withCheck: boolean) {
      const entity = get(entityId)
      const skill = entity?.skills.find((s) => s.id === skillId)
      if (!entity || !skill || skillBlock(skill)) return null
      let success = true
      campaignHistory.getState().transaction(t.skills.launched(skill.name), () => {
        if (withCheck && skill.stat) {
          const result = actions.check(entityId, skill.stat, {
            label: t.checks.label(skill.name, statName(skill.stat)),
          })
          success = Boolean(result?.check.outcome.success)
        }
        store().updateEntity(
          entityId,
          (e) => withJournal(spendSkill(e, skillId), 'skill', t.journal.skillUsed(skill.name)),
          t.skills.launched(skill.name),
        )
        if (!success) return
        const { effect } = skill
        if ((effect.kind === 'damage' || effect.kind === 'heal') && effect.expression) {
          const r = dieRecord(
            entityId,
            skill.name,
            effect.expression,
            effect.kind === 'damage' ? 'damage' : 'heal',
          )
          for (const id of targetIds)
            actions.applyHp(id, {
              kind: effect.kind,
              amount: Math.max(0, r.total),
              source: skill.name,
            })
        }
        if (effect.kind === 'condition' && effect.conditionId)
          actions.addConditionFromTemplate(targetIds, effect.conditionId)
      })
      if (success) toast.success(t.skills.launched(skill.name))
      else toast(t.skills.failedCheck(skill.name))
      return success
    },

    /** Spends a luck point to reroll the character's last roll (SPEC §4.9). */
    luckReroll(entityId: string) {
      const entity = get(entityId)
      if (!entity) return null
      if (luckPointsLeft(entity, rules) <= 0) {
        toast.error(t.dice.noLuck)
        return null
      }
      const last = [...useRollStore.getState().rolls].reverse().find((r) => r.entityId === entityId)
      if (!last) {
        toast(t.checks.noRollToReroll)
        return null
      }
      store().updateEntity(
        entityId,
        (e) => withJournal({ ...e, luckSpent: e.luckSpent + 1 }, 'roll', t.journal.luck),
        t.dice.rerolled,
      )
      const label = `${last.label} — ${t.dice.rerolled}`
      if (last.check) {
        const check = performCheck(get(entityId)!, last.check.stat, rules, {
          mode: last.check.mode,
          bonus: last.check.bonus + entity.exhaustion * rules.fatigue.checkPenaltyPerLevel,
          rng,
        })
        return checkRecord(entity, check, { label, secret: last.secret }, 'check', last.id)
      }
      const r = roll(last.expression, { rng, rounding: rules.stats.rounding })
      return record({
        ...last,
        total: r.total,
        breakdown: r.breakdown,
        groups: r.groups,
        label,
        rerollOf: last.id,
      })
    },

    shortRest(entityId: string) {
      const entity = get(entityId)
      if (!entity) return
      const { entity: rested, healed } = shortRest(entity, rules, rng)
      store().updateEntity(
        entityId,
        () => withJournal(rested, 'rest', t.journal.shortRest(healed)),
        t.rest.short,
      )
      if (healed > 0)
        useFxStore.getState().pushHp({ entityId, kind: 'heal', amount: healed, severe: false })
      toast.success(t.rest.shortDone(entityName(entity), healed))
    },

    longRest(entityId: string) {
      const entity = get(entityId)
      if (!entity) return
      store().updateEntity(
        entityId,
        (e) => withJournal(longRest(e, rules), 'rest', t.journal.longRest),
        t.rest.long,
      )
      toast.success(t.rest.longDone(entityName(entity)))
    },

    setExhaustion(entityId: string, level: number) {
      store().updateEntity(
        entityId,
        (e) => {
          const next = setExhaustion(e, level, rules)
          return next.exhaustion === e.exhaustion
            ? e
            : withJournal(next, 'rest', t.journal.exhaustion(next.exhaustion))
        },
        t.rest.exhaustionChanged(level),
      )
    },

    addXp(entityId: string, amount: number) {
      const entity = get(entityId)
      if (!entity || entity.kind !== 'player' || amount === 0) return
      store().updateEntity(
        entityId,
        (e) =>
          e.kind === 'player'
            ? withJournal(
                { ...e, details: { ...e.details, xp: Math.max(0, e.details.xp + amount) } },
                'level',
                t.journal.xp(amount),
              )
            : e,
        t.levelUp.xpGained(entityName(entity), amount),
      )
    },

    /** Level the player can reach with their XP. */
    reachableLevel(entityId: string) {
      const entity = get(entityId)
      return entity?.kind === 'player' ? levelForXp(entity.details.xp, rules) : null
    },

    changeMoney(entityId: string, delta: number) {
      store().updateEntity(
        entityId,
        (e) => {
          const purse = Math.max(0, e.purse + delta)
          return withJournal(
            { ...e, purse },
            'money',
            t.journal.money(formatPurse(purse, rules.currency)),
          )
        },
        t.inventory.purseChanged(
          formatPurse(Math.max(0, (get(entityId)?.purse ?? 0) + delta), rules.currency),
        ),
      )
    },

    // -----------------------------------------------------------------------
    // Turns by groups (D-226). Each step is ONE undoable change: the turn
    // moves and the new character's start-of-turn effects are applied.
    // -----------------------------------------------------------------------

    /** Round 1: the first character of the first group plays. */
    startTurns() {
      const play = startTurns(store().play)
      if (play === store().play) return
      campaignHistory.getState().transaction(t.turns.started, () => {
        store().updatePlay(() => play, t.turns.started)
        beginTurn(play.turn)
      })
    },

    /** The next character plays; after the last group comes the GM's turn. */
    nextTurn() {
      const current = store().play
      const { turn } = nextTurn(current)
      if (turn === current.turn) return
      const label = turn.status === 'gm' ? t.turns.gmTurn : t.turns.next
      campaignHistory.getState().transaction(label, () => {
        store().updatePlay((p) => ({ ...p, turn }), label)
        beginTurn(turn)
      })
    },

    /** The GM gives the hand back: next round, from the first group. */
    resumeTurns() {
      const play = resumeTurns(store().play)
      if (play === store().play) return
      const label = t.turns.resumed(play.turn.status === 'playing' ? play.turn.round : 0)
      campaignHistory.getState().transaction(label, () => {
        store().updatePlay(() => play, label)
        beginTurn(play.turn)
      })
    },

    stopTurns() {
      store().updatePlay(stopTurns, t.turns.stopped)
    },

    // -----------------------------------------------------------------------
    // Quick edits during play (D-227): simple, one undo step each.
    // -----------------------------------------------------------------------

    /** Adds `delta` to a characteristic's base value (kept within the rules' range). */
    nudgeStat(entityId: string, stat: StatKey, delta: number) {
      const entity = get(entityId)
      if (!entity) return
      const from = entity.stats[stat]
      const to = clamp(from + delta, rules.stats.min, rules.stats.max)
      if (to === from) return
      store().updateEntity(
        entityId,
        (e) =>
          withJournal(
            { ...e, stats: { ...e.stats, [stat]: to } },
            'stats',
            t.journal.stat(statName(stat), from, to),
          ),
        t.journal.stat(statName(stat), from, to),
      )
    },

    /** Adds an item (a weapon goes straight into a free hand when `equip` is set). */
    quickAddItem(entityId: string, item: Item, equipIt = false) {
      const entity = get(entityId)
      if (!entity) return
      const name = entityName(entity)
      store().updateEntity(
        entityId,
        (e) => {
          let next = withJournal(
            { ...e, inventory: [...e.inventory, item] },
            'item',
            t.journal.itemAdded(item.name, item.quantity),
          )
          if (equipIt) {
            const slot = slotsFor(item.type).find((s) => !next.inventory.some((i) => i.slot === s))
            if (slot) next = equip(next, item.id, slot)
          }
          return next
        },
        t.inventory.addedTo(item.name, name),
      )
    },

    quickRemoveItem(entityId: string, itemId: string) {
      const entity = get(entityId)
      const item = entity?.inventory.find((i) => i.id === itemId)
      if (!entity || !item) return
      store().updateEntity(
        entityId,
        (e) =>
          withJournal(
            { ...e, inventory: e.inventory.filter((i) => i.id !== itemId) },
            'item',
            t.journal.itemRemoved(item.name),
          ),
        t.journal.itemRemoved(item.name),
      )
    },

    /** Equips in the first compatible slot, or unequips. */
    toggleEquip(entityId: string, itemId: string) {
      const entity = get(entityId)
      const item = entity?.inventory.find((i) => i.id === itemId)
      if (!entity || !item) return
      store().updateEntity(
        entityId,
        (e) => {
          if (item.slot) return unequip(e, itemId)
          const slots = slotsFor(item.type)
          const slot = slots.find((s) => !e.inventory.some((i) => i.slot === s)) ?? slots[0]
          return slot ? equip(e, itemId, slot) : e
        },
        item.slot ? t.inventory.unequip : t.inventory.equipped,
      )
    },
  }

  /** Start-of-turn effects for whoever now plays, and an announcement. */
  function beginTurn(turn: TurnState) {
    if (turn.status === 'playing') {
      const entity = get(turn.memberId)
      if (!entity) return
      actions.passTurn(turn.memberId)
      toast(t.turns.yourTurn(entityName(entity)), { duration: 4000 })
    } else if (turn.status === 'gm') {
      toast(t.turns.gmTurnToast, { duration: 6000 })
    }
  }
  return actions
}

export type GameActions = ReturnType<typeof createGameActions>
