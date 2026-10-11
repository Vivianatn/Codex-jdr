import { Copy, Pencil, Plus, Trash } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Ornament } from '@/components/Brand'
import { Button, IconButton } from '@/components/ui/Button'
import { campaignRepository } from '@/db/campaigns'
import { emptyConditionTemplate } from '@/domain/conditions'
import type { ConditionTemplate } from '@/domain/types'
import { ConditionDialog } from '@/features/characters/ConditionDialog'
import {
  CONDITION_COLOR_CLASSES,
  CONDITION_ICON_COMPONENTS,
} from '@/features/characters/conditionStyles'
import { useCampaign } from '@/features/shell/campaignContext'
import { PageTransition } from '@/features/shell/PageTransition'
import { useT } from '@/i18n'
import { cn } from '@/lib/cn'

/** The campaign condition list (SPEC §4.10): every entry, starters included, is the GM's to edit. */
export function ConditionsPage() {
  const t = useT()
  const campaign = useCampaign()
  const custom = campaign.library.conditions
  const [editing, setEditing] = useState<ConditionTemplate | null>(null)
  const save = (conditions: ConditionTemplate[]) =>
    campaignRepository.updateLibrary(campaign.id, { ...campaign.library, conditions })

  return (
    <PageTransition className="px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">{t.conditions.pageTitle}</h1>
          <p className="mt-1 text-sm text-ink-muted">{t.conditions.pageSubtitle}</p>
        </div>
        <Button
          variant="primary"
          icon={<Plus />}
          onClick={() => setEditing(emptyConditionTemplate())}
        >
          {t.conditions.new}
        </Button>
      </div>
      <Ornament className="my-6 max-w-sm" />

      {custom.length === 0 ? (
        <p className="mb-6 text-sm text-ink-muted">{t.sections.conditions.emptyBody}</p>
      ) : (
        <ConditionGrid
          title={t.conditions.pageTitle}
          conditions={custom}
          actions={(c) => (
            <>
              <IconButton
                size="sm"
                label={t.common.edit + ' : ' + c.name}
                icon={<Pencil />}
                onClick={() => setEditing(c)}
              />
              <IconButton
                size="sm"
                label={t.conditions.duplicate(c.name)}
                icon={<Copy />}
                onClick={() =>
                  setEditing({
                    ...structuredClone(c),
                    id: crypto.randomUUID(),
                    name: t.conditions.copyName(c.name),
                  })
                }
              />
              <IconButton
                size="sm"
                label={t.common.delete + ' : ' + c.name}
                icon={<Trash />}
                onClick={async () => {
                  await save(custom.filter((x) => x.id !== c.id))
                  toast.success(t.conditions.deleted(c.name))
                }}
              />
            </>
          )}
        />
      )}

      <ConditionDialog
        template={editing}
        onClose={() => setEditing(null)}
        onSave={async (template) => {
          const exists = custom.some((c) => c.id === template.id)
          await save(
            exists
              ? custom.map((c) => (c.id === template.id ? template : c))
              : [...custom, template],
          )
          setEditing(null)
          toast.success(t.conditions.saved)
        }}
      />
    </PageTransition>
  )
}

function ConditionGrid({
  title,
  conditions,
  actions,
}: {
  title: string
  conditions: ConditionTemplate[]
  actions: (c: ConditionTemplate) => React.ReactNode
}) {
  const t = useT()
  return (
    <section className="mb-8" aria-label={title}>
      <h2 className="mb-3 text-lg font-semibold text-ink">{title}</h2>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {conditions.map((c) => {
          const Icon = CONDITION_ICON_COMPONENTS[c.icon]
          const colors = CONDITION_COLOR_CLASSES[c.color]
          const effects = [
            ...c.modifiers.map(
              (m) => `${t.stats.abbr[m.stat]} ${m.value >= 0 ? '+' : ''}${m.value}`,
            ),
            c.perTurn
              ? t.conditions.perTurnSummary(
                  t.conditions.perTurnKinds[c.perTurn.kind],
                  c.perTurn.expression,
                )
              : '',
            c.save ? t.conditions.trySave(t.stats.names[c.save]) : '',
            c.duration ? t.conditions.remaining(c.duration) : t.conditions.untilRemoved,
          ].filter(Boolean)
          return (
            <li
              key={c.id}
              className={cn(
                'flex gap-3 rounded-md border border-l-4 border-line bg-surface p-3',
                colors.edge,
              )}
            >
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface"
                aria-hidden
              >
                <Icon className={cn('size-4', colors.icon)} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">{c.name}</p>
                {c.description && <p className="text-sm text-ink-muted">{c.description}</p>}
                <p className="mt-1 text-xs text-ink-muted">{effects.join(' · ')}</p>
              </div>
              <div className="flex shrink-0 items-start gap-1">{actions(c)}</div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
