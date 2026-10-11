import { AnimatePresence, motion } from 'framer-motion'
import { Crown, Swords } from 'lucide-react'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { CheckboxField, SelectField } from '@/components/ui/fields'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { TextField } from '@/components/ui/TextField'
import type { RollMode } from '@/domain/checks'
import { allConditionTemplates } from '@/domain/conditions'
import { entityHpMax, entityName } from '@/domain/entity'
import { equippedWeapon } from '@/domain/items'
import { STAT_KEYS, type Entity, type StatKey } from '@/domain/types'
import { RollCard } from '@/features/dice/RollCard'
import { useGameActions } from '@/features/game/useGameActions'
import { useCampaign } from '@/features/shell/campaignContext'
import { validateDice } from '@/dice'
import { diceErrorMessage } from '@/features/game/diceErrors'
import { useT } from '@/i18n'
import { cn } from '@/lib/cn'
import { parseNumber } from '@/lib/numbers'
import { hpMaxAt, skillMilestonesReached } from '@/rules'
import { useCampaignStore } from '@/stores/campaignStore'
import { useRollStore } from '@/stores/rollStore'

/** Everyone in the campaign except `excludeId`, sorted by name. */
function useOthers(excludeId: string, kinds?: Entity['kind'][]) {
  return useCampaignStore(
    useShallow((s) =>
      Object.values(s.entities)
        .filter((e) => e.id !== excludeId && (!kinds || kinds.includes(e.kind)))
        .sort((a, b) => entityName(a).localeCompare(entityName(b), 'fr')),
    ),
  )
}

function ModeField({ value, onChange }: { value: RollMode; onChange: (mode: RollMode) => void }) {
  const t = useT()
  return (
    <SegmentedControl<RollMode>
      label={t.dice.mode}
      size="sm"
      value={value}
      onValueChange={onChange}
      options={[
        { value: 'normal', label: t.dice.normal },
        { value: 'advantage', label: t.dice.advantage },
        { value: 'disadvantage', label: t.dice.disadvantage },
      ]}
    />
  )
}

function Footer({
  onCancel,
  submit,
  disabled,
}: {
  onCancel: () => void
  submit: ReactNode
  disabled?: boolean
}) {
  const t = useT()
  return (
    <div className="flex justify-end gap-2 pt-2">
      <Button variant="ghost" onClick={onCancel}>
        {t.common.close}
      </Button>
      <Button type="submit" variant="primary" disabled={disabled}>
        {submit}
      </Button>
    </div>
  )
}

/** Check with a circumstance bonus / malus and a roll mode. */
export function CheckBonusDialog({
  entity,
  stat,
  onClose,
}: {
  entity: Entity
  stat: StatKey
  onClose: () => void
}) {
  const t = useT()
  const actions = useGameActions()
  const [bonus, setBonus] = useState('')
  const [mode, setMode] = useState<RollMode>('normal')
  const [secret, setSecret] = useState(false)
  const value = parseNumber(bonus) ?? 0
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t.checks.bonusTitle(t.stats.names[stat])}
    >
      <form
        className="space-y-4"
        onSubmit={(e: FormEvent) => {
          e.preventDefault()
          actions.check(entity.id, stat, { bonus: value, mode, secret })
          onClose()
        }}
      >
        <TextField
          label={t.checks.bonus}
          value={bonus}
          onChange={(e) => setBonus(e.target.value)}
          placeholder="+2, -3"
          inputMode="numeric"
          autoFocus
        />
        <ModeField value={mode} onChange={setMode} />
        <CheckboxField label={t.dice.secret} checked={secret} onChange={setSecret} />
        <Footer onCancel={onClose} submit={t.checks.run} />
      </form>
    </Dialog>
  )
}

/** Melee (Strength) or ranged (Dexterity) attack against an optional target. */
export function AttackDialog({
  entity,
  kind,
  onClose,
}: {
  entity: Entity
  kind: 'melee' | 'ranged'
  onClose: () => void
}) {
  const t = useT()
  const campaign = useCampaign()
  const actions = useGameActions()
  const targets = useOthers(entity.id)
  const [targetId, setTargetId] = useState(targets.find((e) => e.kind === 'enemy')?.id ?? '')
  const [mode, setMode] = useState<RollMode>('normal')
  const weapon = equippedWeapon(entity)
  const [damage, setDamage] = useState(weapon?.damage || campaign.rules.combat.unarmedDamage)
  const [damageError, setDamageError] = useState<string | null>(null)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={t.attack.title(entityName(entity))}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          try {
            if (damage.trim()) validateDice(damage)
          } catch (err) {
            return setDamageError(diceErrorMessage(t, err))
          }
          actions.attack(entity.id, { kind, targetId: targetId || null, mode, damage })
          onClose()
        }}
      >
        <p className="text-sm text-ink">
          <span className="font-medium">{kind === 'melee' ? t.attack.melee : t.attack.ranged}</span>
          <br />
          <span className="text-ink-muted">
            {t.attack.weapon} : {weapon ? weapon.name : t.attack.noWeapon}
          </span>
        </p>
        <TextField
          label={t.attack.damage}
          hint={t.attack.damageHint}
          value={damage}
          error={damageError}
          inputClassName="font-mono"
          onChange={(e) => {
            setDamage(e.target.value)
            setDamageError(null)
          }}
        />
        <SelectField<string>
          label={t.attack.target}
          value={targetId}
          onChange={setTargetId}
          options={[
            { value: '', label: t.attack.noTarget },
            ...targets.map((e) => ({ value: e.id, label: entityName(e) })),
          ]}
        />
        <ModeField value={mode} onChange={setMode} />
        <Footer onCancel={onClose} submit={t.attack.go} />
      </form>
    </Dialog>
  )
}

/** Opposed check: both roll side by side, then the winner is crowned (SPEC §4.3). */
export function OpposedDialog({
  entity,
  stat,
  onClose,
}: {
  entity: Entity
  stat: StatKey
  onClose: () => void
}) {
  const t = useT()
  const actions = useGameActions()
  const others = useOthers(entity.id)
  const [ownStat, setOwnStat] = useState<StatKey>(stat)
  const [opponentId, setOpponentId] = useState(others[0]?.id ?? '')
  const [opponentStat, setOpponentStat] = useState<StatKey>(stat)
  const [result, setResult] = useState<ReturnType<typeof actions.opposed>>(null)
  const rolls = useRollStore((s) => s.rolls)
  const opponent = others.find((o) => o.id === opponentId)
  const statOptions = STAT_KEYS.map((k) => ({ value: k, label: t.stats.names[k] }))
  const recordOf = (id?: string) => rolls.find((r) => r.id === id)

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t.opposed.title(entityName(entity))}
      className="max-w-xl"
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (opponentId) setResult(actions.opposed(entity.id, ownStat, opponentId, opponentStat))
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField<StatKey>
            label={t.opposed.stat}
            value={ownStat}
            onChange={setOwnStat}
            options={statOptions}
          />
          <SelectField<string>
            label={t.opposed.opponent}
            value={opponentId}
            onChange={setOpponentId}
            options={others.map((e) => ({ value: e.id, label: entityName(e) }))}
          />
          <SelectField<StatKey>
            label={t.opposed.opponentStat}
            value={opponentStat}
            onChange={setOpponentStat}
            options={statOptions}
            className="sm:col-start-2"
          />
        </div>
        <AnimatePresence>
          {result && opponent && (
            <motion.div
              key={result.first.record.id}
              className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              aria-live="polite"
            >
              {[
                {
                  side: 'first' as const,
                  record: recordOf(result.first.record.id),
                  name: entityName(entity),
                  from: -40,
                },
                {
                  side: 'second' as const,
                  record: recordOf(result.second.record.id),
                  name: entityName(opponent),
                  from: 40,
                },
              ].map((duelist, i) => (
                <motion.div
                  key={duelist.side}
                  className={cn('relative', i === 1 && 'sm:order-3')}
                  initial={{ x: duelist.from, opacity: 0 }}
                  animate={{ x: 0, opacity: 1, scale: result.winner === duelist.side ? 1.03 : 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                >
                  {result.winner === duelist.side && (
                    <Crown
                      className="absolute -top-3 left-1/2 z-10 size-5 -translate-x-1/2 text-gold"
                      aria-hidden
                    />
                  )}
                  {duelist.record && (
                    <RollCard record={duelist.record} who={duelist.name} animate />
                  )}
                </motion.div>
              ))}
              <span className="flex justify-center text-ink-muted sm:order-2" aria-hidden>
                <Swords className="size-6" />
              </span>
            </motion.div>
          )}
        </AnimatePresence>
        {result && opponent && (
          <p className="text-center font-display text-lg font-semibold text-ink">
            {result.winner === 'tie'
              ? t.opposed.tie
              : t.opposed.winner(
                  result.winner === 'first' ? entityName(entity) : entityName(opponent),
                )}
          </p>
        )}
        <Footer onCancel={onClose} submit={t.opposed.go} disabled={!opponentId} />
      </form>
    </Dialog>
  )
}

/** Persuasion / intimidation / deception on an ally — moves its disposition gauge. */
export function SocialDialog({
  entity,
  action,
  onClose,
}: {
  entity: Entity
  action: 'persuasion' | 'intimidation' | 'deception'
  onClose: () => void
}) {
  const t = useT()
  const actions = useGameActions()
  const allies = useOthers(entity.id, ['ally'])
  const [targetId, setTargetId] = useState(allies[0]?.id ?? '')
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={t.social.title(t.checks[action])}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          actions.social(entity.id, action, targetId)
          onClose()
        }}
      >
        {allies.length === 0 ? (
          <p className="text-sm text-ink-muted">{t.social.noTarget}</p>
        ) : (
          <SelectField<string>
            label={t.social.target}
            value={targetId}
            onChange={setTargetId}
            options={allies.map((a) => ({
              value: a.id,
              label: `${entityName(a)} — ${a.kind === 'ally' ? t.details.dispositions[a.details.disposition] : ''}`,
            }))}
          />
        )}
        <Footer onCancel={onClose} submit={t.social.go} disabled={!targetId} />
      </form>
    </Dialog>
  )
}

/** Intelligence check to reveal an item's hidden property (SPEC §4.6). */
export function IdentifyDialog({
  entity,
  itemId,
  onClose,
}: {
  entity: Entity
  itemId?: string
  onClose: () => void
}) {
  const t = useT()
  const actions = useGameActions()
  const candidates = entity.inventory.filter((i) => i.hidden && !i.hidden.identified)
  const [selected, setSelected] = useState(itemId ?? candidates[0]?.id ?? '')
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={t.identify.title}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          actions.identify(entity.id, selected)
          onClose()
        }}
      >
        {candidates.length === 0 ? (
          <p className="text-sm text-ink-muted">{t.identify.none}</p>
        ) : (
          <SelectField<string>
            label={t.identify.item}
            value={selected}
            onChange={setSelected}
            options={candidates.map((i) => ({ value: i.id, label: i.name }))}
          />
        )}
        <Footer onCancel={onClose} submit={t.identify.go} disabled={!selected} />
      </form>
    </Dialog>
  )
}

/** Level-up assistant (SPEC §4.1): golden halo, new HP, skill reminder at milestones. */
export function LevelUpDialog({
  entity,
  targetLevel,
  onConfirm,
  onClose,
}: {
  entity: Entity
  targetLevel: number
  onConfirm: () => void
  onClose: () => void
}) {
  const t = useT()
  const campaign = useCampaign()
  const rules = campaign.rules
  const from = entityHpMax(entity, rules)
  const to = hpMaxAt(entity.hp, targetLevel, rules)
  const milestone = skillMilestonesReached(entity.level, targetLevel, rules).length > 0
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={t.levelUp.title(entityName(entity))}>
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <div className="relative flex size-28 items-center justify-center">
          <motion.span
            className="absolute inset-0 rounded-full bg-gold/30 blur-xl"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: [0.4, 1.15, 1], opacity: [0, 1, 0.8] }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            aria-hidden
          />
          <motion.span
            className="absolute inset-2 rounded-full border-2 border-gold"
            initial={{ rotate: -90, scale: 0.8, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            transition={{ duration: 0.8 }}
            aria-hidden
          />
          <motion.span
            className="tabular relative font-display text-5xl font-semibold text-gold-text"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.3 }}
          >
            {targetLevel}
          </motion.span>
        </div>
        <p className="font-medium text-ink">{t.levelUp.levels(entity.level, targetLevel)}</p>
        <p className="text-sm text-ink-muted">{t.levelUp.hp(from, to)}</p>
        {milestone && (
          <p className="rounded-md bg-gold-soft px-3 py-2 text-sm text-ink">{t.levelUp.reminder}</p>
        )}
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onClose}>
          {t.common.cancel}
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            onConfirm()
            onClose()
          }}
        >
          {t.levelUp.confirm(targetLevel)}
        </Button>
      </div>
    </Dialog>
  )
}

/** Launch an active skill: optional check, targets, effect (SPEC §4.12). */
export function SkillLaunchDialog({
  entity,
  skillId,
  onClose,
}: {
  entity: Entity
  skillId: string
  onClose: () => void
}) {
  const t = useT()
  const campaign = useCampaign()
  const actions = useGameActions()
  const skill = entity.skills.find((s) => s.id === skillId)
  const everyone = useCampaignStore(useShallow((s) => Object.values(s.entities)))
  const sorted = useMemo(
    () => [...everyone].sort((a, b) => entityName(a).localeCompare(entityName(b), 'fr')),
    [everyone],
  )
  const needsTargets = skill?.effect.kind !== 'none'
  const [targets, setTargets] = useState<string[]>(() =>
    skill?.effect.kind === 'heal'
      ? [entity.id]
      : sorted
          .filter((e) => e.kind === 'enemy')
          .slice(0, 1)
          .map((e) => e.id),
  )
  const [withCheck, setWithCheck] = useState(Boolean(skill?.stat))
  if (!skill) return null
  const condition = skill.effect.conditionId
    ? allConditionTemplates(campaign.library.conditions).find(
        (c) => c.id === skill.effect.conditionId,
      )
    : null
  const effectText =
    skill.effect.kind === 'none'
      ? ''
      : skill.effect.kind === 'condition'
        ? `${t.skills.effectKinds.condition} : ${condition?.name ?? '—'}`
        : `${t.skills.effectKinds[skill.effect.kind]} : ${skill.effect.expression}`
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={t.skills.launchTitle(skill.name)}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          actions.launchSkill(entity.id, skill.id, targets, withCheck)
          onClose()
        }}
      >
        {skill.description && <p className="text-sm text-ink-muted">{skill.description}</p>}
        {effectText && <p className="text-sm font-medium text-ink">{effectText}</p>}
        {skill.stat && (
          <CheckboxField
            label={t.skills.withCheck(t.stats.names[skill.stat])}
            checked={withCheck}
            onChange={setWithCheck}
          />
        )}
        {needsTargets && (
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">{t.skills.targets}</legend>
            <div className="grid max-h-56 gap-1.5 overflow-y-auto sm:grid-cols-2">
              {sorted.map((e) => (
                <CheckboxField
                  key={e.id}
                  label={`${entityName(e)} (${e.hp.current}/${entityHpMax(e, campaign.rules)})`}
                  checked={targets.includes(e.id)}
                  onChange={(on) =>
                    setTargets((list) => (on ? [...list, e.id] : list.filter((id) => id !== e.id)))
                  }
                />
              ))}
            </div>
          </fieldset>
        )}
        <Footer
          onCancel={onClose}
          submit={t.skills.launch}
          disabled={needsTargets && targets.length === 0}
        />
      </form>
    </Dialog>
  )
}
