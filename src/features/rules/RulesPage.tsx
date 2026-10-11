import { Plus, RotateCcw, Trash } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Ornament } from '@/components/Brand'
import { Button, IconButton } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { CheckboxField, CommitInput, NumberInput, SelectField } from '@/components/ui/fields'
import { campaignRepository } from '@/db/campaigns'
import { ENTITY_KINDS } from '@/domain/types'
import { useCampaign } from '@/features/shell/campaignContext'
import { PageTransition } from '@/features/shell/PageTransition'
import { validateDice } from '@/dice'
import { diceErrorMessage } from '@/features/game/diceErrors'
import { useT } from '@/i18n'
import {
  defaultRules,
  type CriticalFaces,
  type Resolution,
  type RulesConfig,
  type StatRounding,
} from '@/rules'

function parseFaces(text: string): number[] {
  return [
    ...new Set(
      text
        .split(/[,;\s]+/)
        .map(Number)
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 20),
    ),
  ].sort((a, b) => a - b)
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-surface p-5">
      <h2 className="mb-4 text-lg font-semibold text-ink">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

/** Campaign house rules (SPEC §13), applied live by every calculation. */
export function RulesPage() {
  const t = useT()
  const campaign = useCampaign()
  const rules = campaign.rules
  const [facesError, setFacesError] = useState<string | null>(null)

  const save = (next: RulesConfig) => void campaignRepository.updateRules(campaign.id, next)
  const patch = <K extends keyof RulesConfig>(key: K, value: Partial<RulesConfig[K]>) =>
    save({ ...rules, [key]: { ...(rules[key] as object), ...value } })

  function setFaces(
    group: 'criticalSuccess' | 'criticalFailure',
    tier: keyof CriticalFaces,
    text: string,
  ) {
    const faces = parseFaces(text)
    const next = { ...rules.checks, [group]: { ...rules.checks[group], [tier]: faces } }
    const success = [...next.criticalSuccess.major, ...next.criticalSuccess.minor]
    const failure = [...next.criticalFailure.major, ...next.criticalFailure.minor]
    if (success.some((f) => failure.includes(f))) return setFacesError(t.rulesPage.facesOverlap)
    setFacesError(null)
    patch('checks', next)
  }

  const facesField = (group: 'criticalSuccess' | 'criticalFailure', tier: keyof CriticalFaces) => (
    <CommitInput
      label={t.rulesPage[tier]}
      value={rules.checks[group][tier].join(', ')}
      onCommit={(v) => setFaces(group, tier, v)}
      inputMode="numeric"
    />
  )

  return (
    <PageTransition className="px-4 py-8 sm:px-8">
      <div className="max-w-3xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="type-screen-title text-ink">{t.rulesPage.title}</h1>
            <p className="mt-2 text-ink-muted">{t.rulesPage.subtitle}</p>
          </div>
          <Button
            icon={<RotateCcw />}
            onClick={() => {
              save(defaultRules())
              setFacesError(null)
              toast.success(t.rulesPage.resetDone)
            }}
          >
            {t.rulesPage.reset}
          </Button>
        </div>
        <Ornament className="my-6 max-w-sm" />

        <div className="space-y-6">
          <Section title={t.rulesPage.stats}>
            <SelectField<StatRounding>
              label={t.rulesPage.rounding}
              value={rules.stats.rounding}
              onChange={(rounding) => patch('stats', { rounding })}
              options={[
                { value: 'ceil', label: t.rulesPage.roundingCeil },
                { value: 'floor', label: t.rulesPage.roundingFloor },
                { value: 'half', label: t.rulesPage.roundingHalf },
              ]}
              className="max-w-xs"
            />
          </Section>

          <Section title={t.rulesPage.hp}>
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberInput
                label={t.rulesPage.hpBase}
                hint={t.rulesPage.hpBaseHint(rules.hp.base)}
                value={rules.hp.base}
                min={0}
                max={999}
                onCommit={(base) => patch('hp', { base })}
              />
              <NumberInput
                label={t.rulesPage.hpPerLevel}
                value={rules.hp.perLevel}
                min={0}
                max={999}
                onCommit={(perLevel) => patch('hp', { perLevel })}
              />
            </div>
          </Section>

          <Section title={t.rulesPage.checks}>
            <SelectField<Resolution>
              label={t.rulesPage.resolution}
              value={rules.checks.resolution}
              onChange={(resolution) => patch('checks', { resolution })}
              options={[
                { value: 'rollUnder', label: t.rulesPage.rollUnder },
                { value: 'rollOver', label: t.rulesPage.rollOver },
              ]}
            />
            <p className="text-xs text-ink-muted">{t.rulesPage.facesHint}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <fieldset className="space-y-3">
                <legend className="mb-2 text-sm font-semibold text-heal-text">
                  {t.rulesPage.critSuccess}
                </legend>
                {facesField('criticalSuccess', 'major')}
                {facesField('criticalSuccess', 'minor')}
              </fieldset>
              <fieldset className="space-y-3">
                <legend className="mb-2 text-sm font-semibold text-hp-text">
                  {t.rulesPage.critFailure}
                </legend>
                {facesField('criticalFailure', 'major')}
                {facesField('criticalFailure', 'minor')}
              </fieldset>
            </div>
            {facesError && (
              <p role="alert" className="text-sm text-hp-text">
                {facesError}
              </p>
            )}
            <CheckboxField
              label={t.rulesPage.luckWidening}
              hint={t.rulesPage.luckWideningHint}
              checked={rules.checks.luckWidening.enabled}
              onChange={(enabled) =>
                patch('checks', { luckWidening: { ...rules.checks.luckWidening, enabled } })
              }
            />
            {rules.checks.luckWidening.enabled && (
              <NumberInput
                label={t.rulesPage.luckThreshold}
                value={rules.checks.luckWidening.threshold}
                min={1}
                max={40}
                className="max-w-48"
                onCommit={(threshold) =>
                  patch('checks', { luckWidening: { ...rules.checks.luckWidening, threshold } })
                }
              />
            )}
          </Section>

          <Section title={t.rulesPage.skills}>
            <div className="grid gap-4 sm:grid-cols-3">
              <NumberInput
                label={t.rulesPage.initialActive}
                value={rules.skills.initialActive}
                min={0}
                max={20}
                onCommit={(initialActive) => patch('skills', { initialActive })}
              />
              <NumberInput
                label={t.rulesPage.initialPassive}
                value={rules.skills.initialPassive}
                min={0}
                max={20}
                onCommit={(initialPassive) => patch('skills', { initialPassive })}
              />
              <NumberInput
                label={t.rulesPage.extraEvery}
                hint={t.rulesPage.extraEveryHint}
                value={rules.skills.extraSkillEveryLevels}
                min={0}
                max={100}
                onCommit={(extraSkillEveryLevels) => patch('skills', { extraSkillEveryLevels })}
              />
            </div>
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-ink">{t.rulesPage.enforce}</legend>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {ENTITY_KINDS.map((kind) => (
                  <CheckboxField
                    key={kind}
                    label={t.kinds[kind]}
                    checked={rules.skills.enforceOnCreation.includes(kind)}
                    onChange={(on) =>
                      patch('skills', {
                        enforceOnCreation: on
                          ? [...rules.skills.enforceOnCreation, kind]
                          : rules.skills.enforceOnCreation.filter((k) => k !== kind),
                      })
                    }
                  />
                ))}
              </div>
            </fieldset>
          </Section>

          <Section title={t.rulesPage.grid}>
            <NumberInput
              label={t.rulesPage.cellMeters}
              value={rules.grid.cellMeters}
              min={0.1}
              max={100}
              integer={false}
              className="max-w-48"
              onCommit={(cellMeters) => patch('grid', { cellMeters })}
            />
            <SelectField<RulesConfig['grid']['diagonal']>
              label={t.rulesPage.diagonal}
              value={rules.grid.diagonal}
              onChange={(diagonal) => patch('grid', { diagonal })}
              options={(['euclidean', 'chebyshev', 'alternate'] as const).map((v) => ({
                value: v,
                label: t.rulesPage.diagonals[v],
              }))}
              className="max-w-md"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberInput
                label={t.rulesPage.movementBase}
                hint={t.rulesPage.movementHint}
                value={rules.movement.baseCells}
                min={0}
                max={100}
                onCommit={(baseCells) => patch('movement', { baseCells })}
              />
              <NumberInput
                label={t.rulesPage.movementPerDex}
                hint={t.rulesPage.movementHint}
                value={rules.movement.perDexterity}
                min={0}
                max={10}
                integer={false}
                onCommit={(perDexterity) => patch('movement', { perDexterity })}
              />
            </div>
          </Section>

          <Section title={t.rulesPage.hpThresholds}>
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberInput
                label={t.rulesPage.woundedBelow}
                hint="%"
                value={Math.round(rules.hp.woundedBelow * 100)}
                min={1}
                max={100}
                onCommit={(v) => patch('hp', { woundedBelow: v / 100 })}
              />
              <NumberInput
                label={t.rulesPage.criticalBelow}
                hint="%"
                value={Math.round(rules.hp.criticalBelow * 100)}
                min={1}
                max={100}
                onCommit={(v) => patch('hp', { criticalBelow: v / 100 })}
              />
            </div>
          </Section>

          <p className="rounded-md border border-line bg-surface-2 px-4 py-3 text-sm text-ink">
            {t.rulesPage.optionalIntro}
          </p>

          <Section title={t.rulesPage.combat}>
            <CheckboxField
              label={t.rulesPage.strengthDamageBonus}
              hint={t.rulesPage.strengthDamageBonusHint}
              checked={rules.combat.strengthDamageBonus}
              onChange={(strengthDamageBonus) => patch('combat', { strengthDamageBonus })}
            />
            <DiceRuleField
              label={t.rulesPage.unarmedDamage}
              hint={t.rulesPage.emptyOff}
              value={rules.combat.unarmedDamage}
              onCommit={(unarmedDamage) => patch('combat', { unarmedDamage })}
            />
          </Section>

          <Section title={t.rulesPage.defense}>
            <CheckboxField
              label={t.rulesPage.defenseFromDexterity}
              checked={rules.defense.fromDexterity}
              onChange={(fromDexterity) => patch('defense', { fromDexterity })}
            />
            <CheckboxField
              label={t.rulesPage.defenseFromEquipment}
              checked={rules.defense.fromEquipment}
              onChange={(fromEquipment) => patch('defense', { fromEquipment })}
            />
          </Section>

          <Section title={t.rulesPage.carry}>
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberInput
                label={t.rulesPage.kgPerStrength}
                hint={t.rulesPage.zeroOff}
                value={rules.carry.kgPerStrength}
                min={0}
                max={1000}
                integer={false}
                onCommit={(kgPerStrength) => patch('carry', { kgPerStrength })}
              />
              <NumberInput
                label={t.rulesPage.overloadedDexPenalty}
                hint={t.rulesPage.zeroOff}
                value={rules.carry.overloadedDexPenalty}
                min={0}
                max={20}
                onCommit={(overloadedDexPenalty) => patch('carry', { overloadedDexPenalty })}
              />
            </div>
          </Section>

          <Section title={t.rulesPage.fatigue}>
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberInput
                label={t.rulesPage.maxExhaustion}
                hint={t.rulesPage.zeroOff}
                value={rules.fatigue.maxExhaustion}
                min={0}
                max={20}
                onCommit={(maxExhaustion) => patch('fatigue', { maxExhaustion })}
              />
              <NumberInput
                label={t.rulesPage.checkPenaltyPerLevel}
                hint={t.rulesPage.zeroOff}
                value={rules.fatigue.checkPenaltyPerLevel}
                min={0}
                max={20}
                onCommit={(checkPenaltyPerLevel) => patch('fatigue', { checkPenaltyPerLevel })}
              />
            </div>
          </Section>

          <Section title={t.rulesPage.rests}>
            <DiceRuleField
              label={t.rulesPage.shortRestHeal}
              hint={t.rulesPage.emptyOff}
              value={rules.rests.shortRestHeal}
              onCommit={(shortRestHeal) => patch('rests', { shortRestHeal })}
            />
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium text-ink">{t.rulesPage.longRest}</legend>
              {LONG_REST_KEYS.map((key) => (
                <CheckboxField
                  key={key}
                  label={t.rulesPage.longRestEffects[key]}
                  checked={rules.rests.longRest[key]}
                  onChange={(checked) =>
                    patch('rests', { longRest: { ...rules.rests.longRest, [key]: checked } })
                  }
                />
              ))}
            </fieldset>
          </Section>

          <Section title={t.rulesPage.luck}>
            <NumberInput
              label={t.rulesPage.pointsPerLuck}
              hint={t.rulesPage.zeroOff}
              value={rules.luck.pointsPerLuck}
              min={0}
              max={40}
              className="max-w-sm"
              onCommit={(pointsPerLuck) => patch('luck', { pointsPerLuck })}
            />
          </Section>

          <Section title={t.rulesPage.xp}>
            <SelectField<RulesConfig['xp']['mode']>
              label={t.rulesPage.xpMode}
              value={rules.xp.mode}
              onChange={(mode) => patch('xp', { mode })}
              options={(['none', 'linear', 'table'] as const).map((m) => ({
                value: m,
                label: t.rulesPage.xpModes[m],
              }))}
            />
            {rules.xp.mode === 'linear' && (
              <NumberInput
                label={t.rulesPage.xpPerLevel}
                value={rules.xp.perLevel}
                min={0}
                max={1_000_000}
                className="max-w-sm"
                onCommit={(perLevel) => patch('xp', { perLevel })}
              />
            )}
            {rules.xp.mode === 'table' && (
              <XpTableField value={rules.xp.table} onCommit={(table) => patch('xp', { table })} />
            )}
          </Section>

          <Section title={t.rulesPage.disposition}>
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberInput
                label={t.rulesPage.dispositionStep}
                hint={t.rulesPage.dispositionManual}
                value={rules.disposition.step}
                min={0}
                max={4}
                onCommit={(step) => patch('disposition', { step })}
              />
              <NumberInput
                label={t.rulesPage.dispositionCriticalStep}
                hint={t.rulesPage.dispositionManual}
                value={rules.disposition.criticalStep}
                min={0}
                max={4}
                onCommit={(criticalStep) => patch('disposition', { criticalStep })}
              />
            </div>
          </Section>

          <Section title={t.rulesPage.currency}>
            <CurrencyEditor
              currency={rules.currency}
              onChange={(currency) => save({ ...rules, currency })}
            />
          </Section>
        </div>
      </div>
    </PageTransition>
  )
}

/** Dice expression rule field: refuses invalid notation instead of saving it. */
function DiceRuleField({
  label,
  hint,
  value,
  onCommit,
}: {
  label: string
  hint?: string
  value: string
  onCommit: (value: string) => void
}) {
  const t = useT()
  const [error, setError] = useState<string | null>(null)
  return (
    <CommitInput
      label={label}
      hint={hint}
      value={value}
      error={error}
      onCommit={(next) => {
        try {
          // Empty = rule disabled.
          if (next.trim()) validateDice(next, { requireDice: true })
          setError(null)
          onCommit(next)
        } catch (e) {
          setError(diceErrorMessage(t, e))
        }
      }}
    />
  )
}

const LONG_REST_KEYS = [
  'fullHp',
  'clearTempHp',
  'reduceExhaustion',
  'restoreLuck',
  'restoreSkills',
] as const satisfies readonly (keyof RulesConfig['rests']['longRest'])[]

/** Total XP for level 2, 3, 4…, typed as a list ("100, 300, 600"). */
function XpTableField({
  value,
  onCommit,
}: {
  value: number[]
  onCommit: (table: number[]) => void
}) {
  const t = useT()
  const [error, setError] = useState<string | null>(null)
  return (
    <CommitInput
      label={t.rulesPage.xpTable}
      hint={t.rulesPage.xpTableHint}
      value={value.join(', ')}
      error={error}
      onCommit={(text) => {
        const table = text
          .split(/[,;\s]+/)
          .filter(Boolean)
          .map(Number)
        const ok = table.every(
          (n, i) => Number.isFinite(n) && n > 0 && (i === 0 || n > table[i - 1]!),
        )
        if (!ok) return setError(t.rulesPage.xpTableInvalid)
        setError(null)
        onCommit(table)
      }}
    />
  )
}

/** Coins defined by the GM; none = the purse is a plain number. */
function CurrencyEditor({
  currency,
  onChange,
}: {
  currency: RulesConfig['currency']
  onChange: (currency: RulesConfig['currency']) => void
}) {
  const t = useT()
  const [name, setName] = useState('')
  const [short, setShort] = useState('')
  const [value, setValue] = useState('')
  const set = (index: number, patch: Partial<RulesConfig['currency'][number]>) =>
    onChange(currency.map((c, i) => (i === index ? { ...c, ...patch } : c)))
  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-muted">{t.rulesPage.currencyHint}</p>
      {currency.length === 0 && (
        <p className="text-sm text-ink-muted">{t.rulesPage.currencyNone}</p>
      )}
      <ul className="space-y-2">
        {currency.map((coin, index) => (
          <li key={coin.id} className="flex flex-wrap items-end gap-2">
            <CommitInput
              label={t.rulesPage.coinName}
              value={coin.name}
              onCommit={(v) => v && set(index, { name: v })}
              className="min-w-32 flex-1"
            />
            <CommitInput
              label={t.rulesPage.coinShort}
              value={coin.short}
              onCommit={(v) => v && set(index, { short: v })}
              className="w-24"
            />
            <NumberInput
              label={t.rulesPage.coinValue}
              value={coin.value}
              min={1}
              max={1_000_000}
              className="w-40"
              onCommit={(v) => set(index, { value: v })}
            />
            <IconButton
              label={`${t.common.remove} : ${coin.name}`}
              icon={<Trash />}
              onClick={() => onChange(currency.filter((_, i) => i !== index))}
            />
          </li>
        ))}
      </ul>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const v = Number(value)
          if (!name.trim() || !short.trim() || !(v >= 1)) return
          onChange([
            ...currency,
            {
              id: crypto.randomUUID(),
              name: name.trim(),
              short: short.trim(),
              value: Math.round(v),
            },
          ])
          setName('')
          setShort('')
          setValue('')
        }}
      >
        <TextField
          label={t.rulesPage.coinName}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-w-32 flex-1"
        />
        <TextField
          label={t.rulesPage.coinShort}
          value={short}
          onChange={(e) => setShort(e.target.value)}
          className="w-24"
        />
        <TextField
          label={t.rulesPage.coinValue}
          value={value}
          inputMode="numeric"
          onChange={(e) => setValue(e.target.value)}
          className="w-40"
        />
        <Button type="submit" icon={<Plus />}>
          {t.rulesPage.addCoin}
        </Button>
      </form>
    </div>
  )
}
