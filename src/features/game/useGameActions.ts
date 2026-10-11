import { useMemo } from 'react'
import { useCampaign } from '@/features/shell/campaignContext'
import { useT } from '@/i18n'
import { createGameActions } from './gameActions'

/** Game actions bound to the open campaign and the current language. */
export function useGameActions() {
  const t = useT()
  const campaign = useCampaign()
  return useMemo(() => createGameActions(t, campaign), [t, campaign])
}
