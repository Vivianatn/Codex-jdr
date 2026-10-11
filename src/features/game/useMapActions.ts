import { useMemo } from 'react'
import { useCampaign } from '@/features/shell/campaignContext'
import { useT } from '@/i18n'
import { createMapActions } from './mapActions'
import { useGameActions } from './useGameActions'

/** Map actions bound to the open campaign. */
export function useMapActions() {
  const t = useT()
  const campaign = useCampaign()
  const game = useGameActions()
  return useMemo(() => createMapActions(t, campaign, game), [t, campaign, game])
}
