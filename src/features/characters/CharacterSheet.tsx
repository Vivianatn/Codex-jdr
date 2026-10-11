import { ClipboardCopy } from 'lucide-react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Tab, TabList, TabPanel, Tabs } from '@/components/ui/Tabs'
import { toDiscordMarkdown } from '@/domain/discord'
import { entityHpMax, entityName } from '@/domain/entity'
import type { Entity } from '@/domain/types'
import { useT } from '@/i18n'
import { copyText } from '@/lib/clipboard'
import type { RulesConfig } from '@/rules'
import { HpBar } from './HpBar'
import { PortraitPicker } from './PortraitPicker'
import { IdentityTab, type SheetContext } from './sheet/IdentityTab'
import { ConditionsTab } from './sheet/ConditionsTab'
import { InventoryTab } from './sheet/InventoryTab'
import { JournalTab } from './sheet/ListTabs'
import { HpQuickInput } from './HpQuickInput'
import { StatusPills } from './StatusPills'
import { useCampaignStore } from '@/stores/campaignStore'
import { useGameActions } from '@/features/game/useGameActions'
import { SkipForward } from 'lucide-react'
import { SkillsTab } from './sheet/SkillsTab'
import { StatsTab } from './sheet/StatsTab'
import { useSheetEditor, type SheetChange } from './useSheetEditor'

export function CopyForDiscordButton({ entity, rules }: { entity: Entity; rules: RulesConfig }) {
  const t = useT()
  return (
    <Button
      icon={<ClipboardCopy />}
      onClick={async () => {
        try {
          await copyText(toDiscordMarkdown(entity, rules))
          toast.success(t.sheet.copied)
        } catch {
          toast.error(t.sheet.copyFailed)
        }
      }}
    >
      {t.sheet.copyForDiscord}
    </Button>
  )
}

/** Full sheet in tabs, in the order of the Discord sheet (SPEC §9.3). */
export function CharacterSheet({
  entity,
  rules,
  onChange,
  context,
  kindLabel,
  actions,
  defaultTab = 'identity',
}: {
  entity: Entity
  rules: RulesConfig
  onChange: SheetChange
  context: SheetContext
  kindLabel: string
  actions?: ReactNode
  defaultTab?: string
}) {
  const t = useT()
  const editor = useSheetEditor(entity, rules, onChange)
  const name = entityName(entity)
  // Bestiary templates are edited, not played: no quick HP or turn controls.
  const playable = useCampaignStore((s) => Boolean(s.entities[entity.id]))
  const game = useGameActions()

  return (
    <article aria-labelledby="sheet-title" className="space-y-6">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <PortraitPicker
          src={entity.identity.portrait}
          name={name}
          onChange={(portrait) => editor.identity('portrait', portrait)}
        />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="type-eyebrow">{kindLabel}</p>
            <h1 id="sheet-title" className="type-name text-ink">
              {name}
            </h1>
            <p className="text-sm text-ink-muted">
              {[entity.identity.className, `${t.sheet.level} ${entity.level}`]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-4">
            <HpBar
              size="lg"
              current={entity.hp.current}
              max={entityHpMax(entity, rules)}
              temp={entity.hp.temp}
              thresholds={rules.hp}
              entityId={entity.id}
              className="max-w-sm min-w-48 flex-1"
            />
            {playable && <HpQuickInput entityId={entity.id} name={name} compact className="w-40" />}
          </div>
          <StatusPills entity={entity} rules={rules} />
        </div>
        <div className="flex flex-wrap gap-2">
          {playable && (
            <Button
              icon={<SkipForward />}
              onClick={() => game.passTurn(entity.id)}
              title={t.turn.passHint}
            >
              {t.turn.pass}
            </Button>
          )}
          {actions}
        </div>
      </header>

      <Tabs defaultValue={defaultTab}>
        <TabList label={t.sheet.sections}>
          <Tab value="identity">{t.sheet.tabs.identity}</Tab>
          <Tab value="stats">{t.sheet.tabs.stats}</Tab>
          <Tab value="skills">{t.sheet.tabs.skills}</Tab>
          <Tab value="conditions">
            {t.sheet.tabs.conditions}
            {entity.conditions.length > 0 && <Count n={entity.conditions.length} />}
          </Tab>
          <Tab value="inventory">{t.sheet.tabs.inventory}</Tab>
          <Tab value="journal">{t.sheet.tabs.journal}</Tab>
        </TabList>
        <TabPanel value="identity">
          <IdentityTab entity={entity} editor={editor} context={context} />
        </TabPanel>
        <TabPanel value="stats">
          <StatsTab entity={entity} rules={rules} editor={editor} />
        </TabPanel>
        <TabPanel value="skills">
          <SkillsTab entity={entity} rules={rules} editor={editor} />
        </TabPanel>
        <TabPanel value="conditions">
          <ConditionsTab entity={entity} editor={editor} />
        </TabPanel>
        <TabPanel value="inventory">
          <InventoryTab entity={entity} editor={editor} />
        </TabPanel>
        <TabPanel value="journal">
          <JournalTab entity={entity} />
        </TabPanel>
      </Tabs>
    </article>
  )
}

function Count({ n }: { n: number }) {
  return (
    <span className="tabular rounded-full bg-warning/20 px-1.5 text-xs font-semibold text-ink">
      {n}
    </span>
  )
}
