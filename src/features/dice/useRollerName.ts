import { entityName } from '@/domain/entity'
import type { RollRecord } from '@/domain/rolls'
import { useT } from '@/i18n'
import { useCampaignStore } from '@/stores/campaignStore'

/** Display name of whoever made a roll. */
export function useRollerName(): (record: RollRecord) => string {
  const t = useT()
  const entities = useCampaignStore((s) => s.entities)
  return (record) => {
    const entity = record.entityId ? entities[record.entityId] : null
    return entity ? entityName(entity) : t.dice.gm
  }
}
