import { DicePanel } from '@/features/dice/DicePanel'
import { RollFeed } from '@/features/dice/RollFeed'

/** Floating layers available everywhere in a campaign: dice tray and latest roll. */
export function CampaignOverlays() {
  return (
    <>
      <DicePanel />
      <RollFeed />
    </>
  )
}
