import { useReducedMotion } from 'framer-motion'
import { useSettingsStore } from '@/stores/settingsStore'

/** Dice animate only when every animation setting allows it. */
export function useDiceAnimation(): boolean {
  const reduced = useReducedMotion()
  const level = useSettingsStore((s) => s.animations)
  const dice = useSettingsStore((s) => s.diceAnimation)
  return dice && level === 'full' && !reduced
}
