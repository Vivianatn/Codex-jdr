import { useEffect } from 'react'
import { setVolume } from '@/lib/audio/engine'
import { startMusic, stopMusic } from '@/lib/audio/music'
import { playSound } from '@/lib/audio/sfx'
import { useCampaignStore } from '@/stores/campaignStore'
import { useFxStore } from '@/stores/fxStore'
import { useRollStore } from '@/stores/rollStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { cueForHp, cueForTurn, cuesForRoll, someoneLeveledUp } from './soundEvents'

/** Main game buttons and tabs click like a game menu. */
const CLICKABLE = '.type-button, [role="tab"]'

/**
 * Plays the table's sounds (D-251) by listening to what already happens:
 * rolls, HP changes, turns, levels. Mounted once by the app. Silent in the
 * players' window (the GM's screen already plays them) and in background tabs.
 */
export function useGameSounds() {
  useEffect(() => {
    const on = () => {
      const s = useSettingsStore.getState()
      return s.soundEffects && s.surface !== 'players' && document.visibilityState === 'visible'
    }

    const stopFx = useFxStore.subscribe((state, previous) => {
      if (!on()) return
      if (state.rollToAnimate && state.rollToAnimate !== previous.rollToAnimate) {
        const roll = useRollStore.getState().rolls.find((r) => r.id === state.rollToAnimate)
        if (roll) for (const cue of cuesForRoll(roll)) playSound(cue.name, cue.delay)
      }
      const fresh = state.hp.filter((fx) => !previous.hp.some((p) => p.id === fx.id))
      const hp = cueForHp(fresh)
      if (hp) playSound(hp)
    })

    const stopGame = useCampaignStore.subscribe((state, previous) => {
      if (!on()) return
      if (state.status !== 'ready' || previous.status !== 'ready') return
      if (state.campaignId !== previous.campaignId) return
      if (state.play.turn !== previous.play.turn) {
        const turn = cueForTurn(previous.play.turn, state.play.turn)
        if (turn) playSound(turn)
      }
      if (
        state.entities !== previous.entities &&
        someoneLeveledUp(previous.entities, state.entities)
      )
        playSound('levelUp')
    })

    const click = (event: MouseEvent) => {
      if (on() && (event.target as Element | null)?.closest?.(CLICKABLE)) playSound('click')
    }
    document.addEventListener('click', click, { capture: true })

    return () => {
      stopFx()
      stopGame()
      document.removeEventListener('click', click, { capture: true })
    }
  }, [])

  const soundVolume = useSettingsStore((s) => s.soundVolume)
  const music = useSettingsStore((s) => s.music)
  const musicVolume = useSettingsStore((s) => s.musicVolume)
  const surface = useSettingsStore((s) => s.surface)

  useEffect(() => setVolume('sfx', soundVolume), [soundVolume])
  useEffect(() => setVolume('music', musicVolume), [musicVolume])
  useEffect(() => {
    if (music && surface !== 'players') startMusic(surface === 'play' ? 'dungeon' : 'tavern')
    else stopMusic()
  }, [music, surface])
  useEffect(() => stopMusic, [])
}
