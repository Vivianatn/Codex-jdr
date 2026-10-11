import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { SelectField } from '@/components/ui/fields'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { TextAreaField, TextField } from '@/components/ui/TextField'
import { toDiscordMarkdown } from '@/domain/discord'
import { createEntity, defaultDetails, emptyIdentity, entityName } from '@/domain/entity'
import {
  DISPOSITIONS,
  STAT_KEYS,
  type DetailsByKind,
  type Disposition,
  type EntityKind,
  type EntityOfKind,
  type Identity,
  type Skill,
  type StatKey,
  type Stats,
} from '@/domain/types'
import { useCampaign } from '@/features/shell/campaignContext'
import { PageTransition } from '@/features/shell/PageTransition'
import { ownerOptions } from '@/domain/familiars'
import { skillFromDefinition, syncSkill } from '@/domain/skills'
import { useT } from '@/i18n'
import { cn } from '@/lib/cn'
import {
  checkCreationSkills,
  hpFormulaParts,
  hpMax,
  isValidDie,
  isValidStat,
  statFromDice,
  type RulesConfig,
} from '@/rules'
import { useCampaignStore } from '@/stores/campaignStore'
import { CopyForDiscordButton } from '../CharacterSheet'
import { HpBar } from '../HpBar'
import { BodyPicker } from '../BodyPicker'
import { PortraitPicker } from '../PortraitPicker'
import { SkillList } from '../sheet/SkillsTab'
import { STAT_STYLES } from '../statStyles'
import { StatPill } from '../StatPill'
import { useCharacterActions } from '../useCharacterActions'
import { parseNumber } from '@/lib/numbers'

const STEPS = ['identity', 'stats', 'hp', 'skills', 'recap'] as const
type Step = (typeof STEPS)[number]

type InputMode = 'value' | 'dice'

interface Draft<K extends EntityKind> {
  kind: K
  identity: Identity
  stats: Record<StatKey, string>
  dice: Record<StatKey, [string, string]>
  inputMode: InputMode
  level: string
  /** HP from the pre-rolled d20, or a max given directly (character made before Codex). */
  hpMode: 'roll' | 'fixed'
  hpRoll: string
  hpMax: string
  skills: Skill[]
  details: DetailsByKind[K]
}

function emptyDraft<K extends EntityKind>(kind: K): Draft<K> {
  const each = <T,>(value: () => T) =>
    Object.fromEntries(STAT_KEYS.map((k) => [k, value()])) as Record<StatKey, T>
  return {
    kind,
    identity: emptyIdentity(),
    stats: each(() => ''),
    dice: each(() => ['', ''] as [string, string]),
    inputMode: 'value',
    level: '1',
    hpMode: 'roll',
    hpRoll: '',
    hpMax: '',
    skills: [],
    details: defaultDetails(kind),
  }
}

/** Final value of a characteristic from the draft, or null if not entered / invalid. */
function statValue(draft: Draft<EntityKind>, key: StatKey, rules: RulesConfig): number | null {
  if (draft.inputMode === 'dice') {
    const [a, b] = draft.dice[key].map(parseNumber)
    if (a == null || b == null || !isValidDie(a) || !isValidDie(b)) return null
    return statFromDice(a, b, rules)
  }
  const v = parseNumber(draft.stats[key])
  return v !== null && isValidStat(v, rules) ? v : null
}

function kindFromParams(section: string, param: string | null): EntityKind {
  if (section === 'bestiary') return 'enemy'
  if (section === 'allies') return param === 'familiar' ? 'familiar' : 'ally'
  return 'player'
}

/** First-session creation wizard; all values were rolled beforehand and are typed in. */
export function CreationWizard({ section }: { section: string }) {
  const [params] = useSearchParams()
  const kind = kindFromParams(section, params.get('kind'))
  return <Wizard key={kind} kind={kind} ownerId={params.get('owner')} />
}

function Wizard({ kind, ownerId }: { kind: EntityKind; ownerId: string | null }) {
  const t = useT()
  const campaign = useCampaign()
  const rules = campaign.rules
  const navigate = useNavigate()
  const actions = useCharacterActions()
  const [draft, setDraft] = useState<Draft<EntityKind>>(() => {
    const d = emptyDraft(kind)
    // "Créer un familier pour ce personnage" arrives with ?owner=<id>.
    return kind === 'familiar' && ownerId ? { ...d, details: { ...d.details, ownerId } } : d
  })
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const set = (patch: Partial<Draft<EntityKind>>) => setDraft((d) => ({ ...d, ...patch }))
  const current: Step = STEPS[step]!

  const stats = Object.fromEntries(STAT_KEYS.map((k) => [k, statValue(draft, k, rules)])) as Record<
    StatKey,
    number | null
  >
  const missingStats = STAT_KEYS.filter((k) => stats[k] === null).length
  const level = Math.floor(parseNumber(draft.level) ?? 0)
  const roll = parseNumber(draft.hpRoll)
  const givenMax = parseNumber(draft.hpMax)
  const fixed = draft.hpMode === 'fixed'
  const skillCheck = checkCreationSkills(draft.skills, kind, rules)

  const blocker: Record<Step, string | null> = {
    identity: draft.identity.pseudo.trim() ? null : t.wizard.needName,
    stats: missingStats ? t.wizard.statsMissing(missingStats) : null,
    hp:
      level < 1
        ? t.wizard.levelInvalid
        : fixed
          ? givenMax === null || givenMax < 1
            ? t.wizard.hpMaxInvalid
            : null
          : roll === null || !isValidDie(roll)
            ? t.wizard.hpRollInvalid
            : null,
    skills: skillCheck.ok ? null : t.wizard.skillsMissing,
    recap: null,
  }

  const entity = useMemo(() => {
    const e = createEntity(kind, campaign.id, rules, {
      identity: { ...draft.identity, pseudo: draft.identity.pseudo.trim() },
      level: Math.max(1, level),
      hpRoll: roll ?? 10,
      hpMax: fixed && givenMax !== null ? Math.max(1, Math.round(givenMax)) : null,
      stats: Object.fromEntries(STAT_KEYS.map((k) => [k, stats[k] ?? 10])) as Stats,
    })
    return {
      ...e,
      skills: draft.skills,
      details: draft.details,
    } as typeof e
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `stats` derives from draft
  }, [draft, kind, campaign.id, rules, level, roll, givenMax, fixed])

  async function finish() {
    const name = entityName(entity)
    if (entity.kind === 'enemy') await actions.saveTemplate(entity, t.wizard.created(name))
    else actions.addToCampaign(entity, t.journal.created(name), t.wizard.created(name))
  }

  const go = (delta: number) => {
    setDirection(delta)
    setStep((s) => Math.min(STEPS.length - 1, Math.max(0, s + delta)))
  }

  const blockedBy = blocker[current]
  return (
    <PageTransition className="px-4 py-8 sm:px-8">
      <div className="mx-auto w-full max-w-4xl">
        <h1 className="font-display text-2xl font-semibold text-ink">{t.wizard.titles[kind]}</h1>

        <nav aria-label={t.wizard.progress} className="mt-6">
          <div
            className="h-1.5 overflow-hidden rounded-full bg-surface-2"
            role="progressbar"
            aria-label={t.wizard.progress}
            aria-valuemin={1}
            aria-valuemax={STEPS.length}
            aria-valuenow={step + 1}
            aria-valuetext={t.wizard.stepOf(step + 1, STEPS.length)}
          >
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-accent to-gold"
              initial={false}
              animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
              transition={{ type: 'spring', stiffness: 180, damping: 26 }}
            />
          </div>
          <ol className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {STEPS.map((s, i) => (
              <li
                key={s}
                aria-current={i === step ? 'step' : undefined}
                className={cn(
                  'flex items-center gap-1.5',
                  i === step
                    ? 'font-semibold text-accent-text'
                    : i < step
                      ? 'text-ink'
                      : 'text-ink-muted',
                )}
              >
                {i < step ? (
                  <Check className="size-3.5" aria-hidden />
                ) : (
                  <span className="tabular">{i + 1}.</span>
                )}
                {t.wizard.steps[s]}
              </li>
            ))}
          </ol>
        </nav>

        <div className="relative mt-8 min-h-80">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.section
              key={current}
              aria-label={t.wizard.steps[current]}
              custom={direction}
              initial={{ opacity: 0, x: 24 * direction }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 * direction }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              {current === 'identity' && <IdentityStep draft={draft} set={set} />}
              {current === 'stats' && (
                <StatsStep draft={draft} set={set} values={stats} rules={rules} />
              )}
              {current === 'hp' && (
                <HpStep
                  draft={draft}
                  set={set}
                  rules={rules}
                  level={level}
                  roll={roll}
                  givenMax={givenMax}
                />
              )}
              {current === 'skills' && (
                <SkillsStep draft={draft} set={set} check={skillCheck} rules={rules} />
              )}
              {current === 'recap' && <RecapStep entity={entity} rules={rules} />}
            </motion.section>
          </AnimatePresence>
        </div>

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
          <Button
            variant="ghost"
            icon={<ChevronLeft />}
            onClick={() => (step === 0 ? navigate(-1) : go(-1))}
          >
            {step === 0 ? t.common.cancel : t.wizard.previous}
          </Button>
          <div className="flex items-center gap-3">
            {blockedBy && (
              <p id="wizard-blocker" role="status" className="text-sm text-ink-muted">
                {blockedBy}
              </p>
            )}
            {current === 'recap' ? (
              <Button variant="primary" icon={<Sparkles />} onClick={finish}>
                {t.wizard.create}
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={() => go(1)}
                disabled={Boolean(blockedBy)}
                aria-describedby={blockedBy ? 'wizard-blocker' : undefined}
              >
                {t.wizard.next}
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            )}
          </div>
        </footer>
      </div>
    </PageTransition>
  )
}

type StepProps = {
  draft: Draft<EntityKind>
  set: (patch: Partial<Draft<EntityKind>>) => void
}

function IdentityStep({ draft, set }: StepProps) {
  const t = useT()
  const entities = useCampaignStore((s) => s.entities)
  const owners = useMemo(() => ownerOptions(Object.values(entities)), [entities])
  const id = draft.identity
  const field = (key: keyof Identity) => ({
    value: (id[key] as string) ?? '',
    onChange: (e: { target: { value: string } }) =>
      set({ identity: { ...id, [key]: e.target.value } }),
  })
  return (
    <div className="flex flex-col gap-8 md:flex-row">
      <div className="flex flex-row items-start gap-4 md:flex-col md:items-center">
        <PortraitPicker
          src={id.portrait}
          name={id.pseudo || '?'}
          onChange={(portrait) => set({ identity: { ...id, portrait } })}
        />
        <BodyPicker
          src={id.body}
          onChange={(body) => set({ identity: { ...id, body } })}
          className="h-52 w-36"
        />
      </div>
      <div className="grid flex-1 gap-4 sm:grid-cols-2">
        <TextField
          label={t.identity.pseudo}
          hint={t.identity.pseudoHint}
          autoFocus
          {...field('pseudo')}
        />
        <TextField label={t.identity.discordName} {...field('discordName')} />
        <TextField label={t.identity.className} {...field('className')} />
        <TextField label={t.identity.weaponType} {...field('weaponType')} />
        <TextField label={t.identity.origin} className="sm:col-span-2" {...field('origin')} />
        <TextAreaField
          label={t.identity.description}
          className="sm:col-span-2"
          {...field('description')}
        />
        <TextAreaField label={t.identity.mindset} className="sm:col-span-2" {...field('mindset')} />
        {draft.kind === 'familiar' && 'ownerId' in draft.details && (
          <SelectField<string>
            label={t.details.owner}
            value={draft.details.ownerId ?? ''}
            onChange={(v) => set({ details: { ...draft.details, ownerId: v || null } })}
            options={[
              { value: '', label: t.common.none },
              ...owners.map((o) => ({ value: o.id, label: `${o.name} (${t.kinds[o.kind]})` })),
            ]}
          />
        )}
        {draft.kind === 'ally' && 'disposition' in draft.details && (
          <SelectField<Disposition>
            label={t.details.disposition}
            value={draft.details.disposition}
            onChange={(disposition) => set({ details: { ...draft.details, disposition } })}
            options={DISPOSITIONS.map((d) => ({ value: d, label: t.details.dispositions[d] }))}
          />
        )}
        {draft.kind === 'enemy' && 'xpReward' in draft.details && (
          <TextField
            label={t.details.xpReward}
            inputMode="numeric"
            value={String(draft.details.xpReward)}
            onChange={(e) =>
              set({
                details: { ...draft.details, xpReward: Math.max(0, Number(e.target.value) || 0) },
              })
            }
          />
        )}
      </div>
    </div>
  )
}

function StatsStep({
  draft,
  set,
  values,
  rules,
}: StepProps & { values: Record<StatKey, number | null>; rules: RulesConfig }) {
  const t = useT()
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-muted">{t.wizard.statsIntro(rules.stats.min, rules.stats.max)}</p>
        <SegmentedControl<InputMode>
          label={t.wizard.inputMode}
          size="sm"
          value={draft.inputMode}
          onValueChange={(inputMode) => set({ inputMode })}
          options={[
            { value: 'value', label: t.wizard.inputValue },
            { value: 'dice', label: t.wizard.inputDice },
          ]}
        />
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_KEYS.map((key) => (
          <li
            key={key}
            className={cn(
              'rounded-lg border border-t-4 border-line bg-surface p-4',
              STAT_STYLES[key].border,
            )}
          >
            <div className="flex items-baseline justify-between">
              <label htmlFor={`stat-${key}`} className="text-sm font-semibold text-ink">
                {t.stats.names[key]}
              </label>
              <Engraved value={values[key]} />
            </div>
            {draft.inputMode === 'value' ? (
              <input
                id={`stat-${key}`}
                inputMode="decimal"
                value={draft.stats[key]}
                onChange={(e) => set({ stats: { ...draft.stats, [key]: e.target.value } })}
                placeholder="—"
                className="tabular mt-2 h-10 w-full rounded-md border border-line bg-surface-2 px-3 text-center text-lg text-ink focus-visible:border-accent"
              />
            ) : (
              <div className="mt-2 flex items-center gap-1.5">
                {[0, 1].map((i) => (
                  <input
                    key={i}
                    id={i === 0 ? `stat-${key}` : undefined}
                    aria-label={`${t.stats.names[key]} — ${t.wizard.die(i + 1)}`}
                    inputMode="numeric"
                    value={draft.dice[key][i]}
                    onChange={(e) => {
                      const pair = [...draft.dice[key]] as [string, string]
                      pair[i] = e.target.value
                      set({ dice: { ...draft.dice, [key]: pair } })
                    }}
                    placeholder="d20"
                    className="tabular h-10 w-full min-w-0 rounded-md border border-line bg-surface-2 px-2 text-center text-ink focus-visible:border-accent"
                  />
                ))}
                <span className="shrink-0 text-xs text-ink-muted">÷ 2</span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** The value "engraves" itself into the card when it becomes valid. */
function Engraved({ value }: { value: number | null }) {
  return (
    <span className="tabular relative font-display text-2xl font-semibold text-ink" aria-hidden>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value ?? 'empty'}
          className="inline-block"
          initial={{ opacity: 0, scale: 1.6, filter: 'blur(4px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ type: 'spring', stiffness: 380, damping: 22 }}
        >
          {value ?? '—'}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

function HpStep({
  draft,
  set,
  rules,
  level,
  roll,
  givenMax,
}: StepProps & {
  rules: RulesConfig
  level: number
  roll: number | null
  givenMax: number | null
}) {
  const t = useT()
  const fixed = draft.hpMode === 'fixed'
  const valid = fixed
    ? givenMax !== null && givenMax >= 1 && level >= 1
    : roll !== null && isValidDie(roll) && level >= 1
  const total = !valid ? null : fixed ? Math.round(givenMax!) : hpMax(roll!, level, rules)
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-muted">{fixed ? t.wizard.hpFixedIntro : t.wizard.hpIntro}</p>
        <SegmentedControl<'roll' | 'fixed'>
          label={t.sheet.hpSource}
          value={draft.hpMode}
          onValueChange={(hpMode) => set({ hpMode })}
          options={[
            { value: 'roll', label: t.sheet.hpSourceRoll },
            { value: 'fixed', label: t.sheet.hpSourceFixed },
          ]}
        />
      </div>
      <div className="grid max-w-md grid-cols-2 gap-4">
        <TextField
          label={t.sheet.level}
          inputMode="numeric"
          value={draft.level}
          onChange={(e) => set({ level: e.target.value })}
        />
        {fixed ? (
          <TextField
            key="fixed"
            label={t.sheet.hpGiven}
            inputMode="numeric"
            value={draft.hpMax}
            onChange={(e) => set({ hpMax: e.target.value })}
            autoFocus
          />
        ) : (
          <TextField
            key="roll"
            label={t.sheet.hpRoll}
            inputMode="numeric"
            value={draft.hpRoll}
            onChange={(e) => set({ hpRoll: e.target.value })}
            autoFocus
          />
        )}
      </div>
      <div className="flex items-center gap-6 rounded-lg border border-line bg-surface p-6">
        <div className="tabular font-display text-5xl font-semibold text-hp-text">
          <Engraved value={total} />
        </div>
        <div className="text-sm text-ink-muted">
          <p className="font-medium text-ink">{t.sheet.hpMax}</p>
          <p className="tabular">
            {fixed
              ? t.wizard.hpFixedHint
              : valid
                ? t.sheet.hpFormula(hpFormulaParts(roll!, level, rules).join(' + '), total!)
                : `${rules.hp.base} + 1d20 + ${t.sheet.level}`}
          </p>
        </div>
      </div>
    </div>
  )
}

function SkillsStep({
  draft,
  set,
  check,
  rules,
}: StepProps & { check: ReturnType<typeof checkCreationSkills>; rules: RulesConfig }) {
  const t = useT()
  const saveSkill = useCampaignStore((s) => s.saveSkill)
  const badge = (label: string, count: number, required: number) => {
    const ok = !check.enforced || count === required
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm',
          ok ? 'border-heal/40 bg-heal/10 text-ink' : 'border-line bg-surface text-ink-muted',
        )}
      >
        {ok && check.enforced ? <Check className="size-3.5 text-heal-text" aria-hidden /> : null}
        {label} <span className="tabular font-semibold">{t.skills.count(count, required)}</span>
      </span>
    )
  }
  return (
    <div className="space-y-6">
      <p className="text-ink-muted">
        {check.enforced
          ? t.skills.requirement(rules.skills.initialActive, rules.skills.initialPassive)
          : t.wizard.skillsOptional}
      </p>
      <div className="flex flex-wrap gap-2" aria-live="polite">
        {badge(t.skills.groups.active, check.counts.active, check.required.active)}
        {badge(t.skills.groups.passive, check.counts.passive, check.required.passive)}
        {badge(t.skills.groups.class, check.counts.class, check.required.class)}
      </div>
      <SkillList
        skills={draft.skills}
        handlers={{
          attach: (def) => set({ skills: [...draft.skills, skillFromDefinition(def)] }),
          // New skills go straight into the campaign library.
          create: (def) => {
            saveSkill(def, t.skills.created(def.name))
            set({ skills: [...draft.skills, skillFromDefinition(def)] })
          },
          edit: (def) => {
            saveSkill(def, t.skills.edited(def.name))
            set({
              skills: draft.skills.map((s) => (s.sourceId === def.id ? syncSkill(s, def) : s)),
            })
          },
          detach: (skill) => set({ skills: draft.skills.filter((s) => s.id !== skill.id) }),
        }}
      />
    </div>
  )
}

function RecapStep({ entity, rules }: { entity: EntityOfKind<EntityKind>; rules: RulesConfig }) {
  const t = useT()
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <p className="text-ink-muted">{t.wizard.recapIntro}</p>
        <RecapCard>
          <p className="font-display text-xl font-semibold text-ink">{entityName(entity)}</p>
          <p className="text-sm text-ink-muted">
            {[entity.identity.className, `${t.sheet.level} ${entity.level}`]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <HpBar
            current={entity.hp.current}
            max={hpMax(entity.hp.roll, entity.level, rules)}
            className="mt-3"
          />
          <div className="mt-3 flex flex-wrap gap-1">
            {STAT_KEYS.map((k) => (
              <StatPill key={k} stat={k} value={entity.stats[k]} />
            ))}
          </div>
        </RecapCard>
        <CopyForDiscordButton entity={entity} rules={rules} />
      </div>
      <div>
        <h3 className="mb-2 font-sans text-sm font-semibold tracking-normal text-ink">
          {t.sheet.discordPreview}
        </h3>
        {/* Scrollable region: focusable so it can be scrolled with the keyboard. */}
        <pre
          role="region"
          tabIndex={0}
          aria-label={t.sheet.discordPreview}
          className="max-h-[28rem] overflow-auto rounded-md border border-line bg-surface-2 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-ink"
        >
          {toDiscordMarkdown(entity, rules)}
        </pre>
      </div>
    </div>
  )
}

function RecapCard({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-line bg-surface p-5 shadow-soft">{children}</div>
}
