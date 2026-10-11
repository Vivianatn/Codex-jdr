import { Link2, Plus, Unlink } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/Button'
import { buttonClasses } from '@/components/ui/buttonStyles'
import { SelectField } from '@/components/ui/fields'
import { entityName } from '@/domain/entity'
import { familiarsOf, freeFamiliars, withOwner } from '@/domain/familiars'
import type { Entity } from '@/domain/types'
import { useCampaign } from '@/features/shell/campaignContext'
import { useT } from '@/i18n'
import { useCampaignStore } from '@/stores/campaignStore'
import { Portrait } from '../Portrait'

/** On a master's sheet: its familiars, with attach / detach / create (SPEC §2.1). */
export function FamiliarLinks({ owner }: { owner: Entity }) {
  const t = useT()
  const campaign = useCampaign()
  const inCampaign = useCampaignStore((s) => Boolean(s.entities[owner.id]))
  const all = useCampaignStore(useShallow((s) => Object.values(s.entities)))
  const update = useCampaignStore((s) => s.updateEntity)
  const [chosen, setChosen] = useState('')
  // Bestiary templates are not in the campaign: familiars attach to the copies.
  if (!inCampaign) return null
  const mine = familiarsOf(all, owner.id)
  const free = freeFamiliars(all)
  const link = (familiarId: string, ownerId: string | null, name: string) =>
    update(
      familiarId,
      (e) => withOwner(e, ownerId),
      ownerId ? t.familiars.linked(name, entityName(owner)) : t.familiars.unlinked(name),
    )

  return (
    <section
      aria-labelledby="familiars-heading"
      className="space-y-3 rounded-lg border border-line bg-surface p-4"
    >
      <h3
        id="familiars-heading"
        className="flex items-center gap-2 font-sans text-sm font-semibold tracking-normal text-ink"
      >
        <Link2 className="size-4 text-accent-text" aria-hidden />
        {t.familiars.title}
      </h3>
      {mine.length === 0 ? (
        <p className="text-sm text-ink-muted">{t.familiars.none}</p>
      ) : (
        <ul className="space-y-2">
          {mine.map((f) => (
            <li key={f.id} className="flex items-center gap-3">
              <Portrait src={f.identity.portrait} name={entityName(f)} size="sm" />
              <Link
                to={`/c/${campaign.id}/prep/allies/e/${f.id}`}
                className="min-w-0 flex-1 truncate text-sm font-medium text-ink hover:text-accent-text hover:underline"
              >
                {entityName(f)}
              </Link>
              <Button
                size="sm"
                variant="ghost"
                icon={<Unlink />}
                onClick={() => link(f.id, null, entityName(f))}
                aria-label={`${t.familiars.detach} : ${entityName(f)}`}
              >
                {t.familiars.detach}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-2">
        {free.length > 0 && (
          <form
            className="flex flex-1 items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              const target = free.find((f) => f.id === chosen) ?? free[0]
              if (target) link(target.id, owner.id, entityName(target))
              setChosen('')
            }}
          >
            <SelectField<string>
              label={t.familiars.attach}
              value={free.some((f) => f.id === chosen) ? chosen : free[0]!.id}
              onChange={setChosen}
              options={free.map((f) => ({ value: f.id, label: entityName(f) }))}
              className="min-w-48 flex-1"
            />
            <Button type="submit" icon={<Link2 />}>
              {t.familiars.attachButton}
            </Button>
          </form>
        )}
        <Link
          to={`/c/${campaign.id}/prep/allies/new?kind=familiar&owner=${owner.id}`}
          className={buttonClasses('secondary')}
        >
          <Plus className="size-4" aria-hidden />
          {t.familiars.create}
        </Link>
      </div>
    </section>
  )
}
