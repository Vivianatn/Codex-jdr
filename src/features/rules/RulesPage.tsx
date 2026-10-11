import { RotateCcw } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Ornament } from '@/components/Brand'
import { Button } from '@/components/ui/Button'
import { CheckboxField, CommitInput, NumberInput, SelectField } from '@/components/ui/fields'
import { campaignRepository } from '@/db/campaigns'
import { ENTITY_KINDS } from '@/domain/types'
import { useCampaign } from '@/features/shell/campaignContext'
import { PageTransition } from '@/features/shell/PageTransition'
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
            <h1 className="font-display text-2xl font-semibold text-ink">{t.rulesPage.title}</h1>
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
          </Section>
        </div>
      </div>
    </PageTransition>
  )
}
