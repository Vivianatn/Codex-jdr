import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { bestiaryRepository } from '@/db/bestiary'
import { entityName, instantiateTemplate, withJournal } from '@/domain/entity'
import type { EnemyTemplate, Entity } from '@/domain/types'
import { useCampaign } from '@/features/shell/campaignContext'
import { useT } from '@/i18n'
import { campaignHistory, useCampaignStore } from '@/stores/campaignStore'
import type { PrepSection } from '@/stores/uiStore'
import { recordActivity } from '@/stores/activityLog'

/** Where each kind of character lives in Préparation. */
export function sectionFor(kind: Entity['kind']): PrepSection {
  return kind === 'player' ? 'players' : kind === 'enemy' ? 'bestiary' : 'allies'
}

export function useCharacterActions() {
  const t = useT()
  const campaign = useCampaign()
  const navigate = useNavigate()
  const store = useCampaignStore.getState
  const base = `/c/${campaign.id}/prep`

  const undoAction = {
    label: t.history.undoShort,
    onClick: () => campaignHistory.getState().undo(),
  }

  return {
    /** Adds a new character to the campaign and opens its sheet. */
    addToCampaign(entity: Entity, journalText: string, toastText: string) {
      const name = entityName(entity)
      store().addEntities([withJournal(entity, 'created', journalText)], t.history.create(name))
      toast.success(toastText)
      navigate(`${base}/${sectionFor(entity.kind)}/e/${entity.id}`)
    },

    /** Saves a bestiary template (shared library) and opens it. */
    async saveTemplate(template: EnemyTemplate, toastText: string) {
      await bestiaryRepository.save(template)
      recordActivity(template.campaignId, t.activity.templateCreated(entityName(template)))
      toast.success(toastText)
      navigate(`${base}/bestiary/t/${template.id}`)
    },

    remove(entity: Entity) {
      const name = entityName(entity)
      store().removeEntity(entity.id, t.history.remove(name))
      toast.success(t.sheet.deleted(name), { action: undoAction })
    },

    spawn(template: EnemyTemplate, quantity: number, level: number) {
      const created = instantiateTemplate(template, {
        campaignId: campaign.id,
        quantity,
        level,
        existing: Object.values(store().entities),
        rules: campaign.rules,
        journalText: t.journal.created,
      })
      const name = entityName(template)
      store().addEntities(created, t.history.spawn(created.length, name))
      toast.success(t.bestiary.spawned(created.length, name), { action: undoAction })
      return created
    },
  }
}
