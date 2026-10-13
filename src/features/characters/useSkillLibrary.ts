import { useMemo } from 'react'
import { useCampaignStore } from '@/stores/campaignStore'
import { compareText } from '@/lib/text'

/** Library definitions with how many characters hold each (D-218). */
export function useSkillLibrary() {
  const skills = useCampaignStore((s) => s.skills)
  const entities = useCampaignStore((s) => s.entities)
  return useMemo(() => {
    const holders: Record<string, number> = {}
    for (const e of Object.values(entities))
      for (const s of e.skills) if (s.sourceId) holders[s.sourceId] = (holders[s.sourceId] ?? 0) + 1
    const list = Object.values(skills).sort((a, b) => compareText(a.name, b.name))
    return { list, byId: skills, holders }
  }, [skills, entities])
}
