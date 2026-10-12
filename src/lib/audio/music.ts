import { audio } from './engine'

/**
 * Background music (D-251), generated as it plays: a low drone and plucked
 * notes picked from a modal scale, never the same twice. « Taverne » while
 * preparing (D dorian, lighter), « Donjon » at the table (D phrygian, darker).
 * Off by default; Settings › Sons et musique.
 */

export type MusicMood = 'tavern' | 'dungeon'

const SCALES: Record<MusicMood, number[]> = {
  // Semitones above D.
  tavern: [0, 2, 3, 5, 7, 9, 10, 12, 14],
  dungeon: [0, 1, 3, 5, 7, 8, 10, 12, 13],
}
const ROOT = 146.83 // D3

interface Playing {
  mood: MusicMood
  stop: () => void
}
let playing: Playing | null = null

export function startMusic(mood: MusicMood): void {
  if (playing?.mood === mood) return
  stopMusic()
  const o = audio('music')
  if (!o) return
  const { ctx, out } = o
  const master = ctx.createGain()
  master.gain.setValueAtTime(0.0001, ctx.currentTime)
  master.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 3)
  master.connect(out)

  // Drone: root and fifth, slightly detuned, breathing through a slow filter.
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = mood === 'tavern' ? 700 : 420
  const lfo = ctx.createOscillator()
  const lfoGain = ctx.createGain()
  lfo.frequency.value = 0.07
  lfoGain.gain.value = 180
  lfo.connect(lfoGain).connect(filter.frequency)
  filter.connect(master)
  const drones = [ROOT / 2, ROOT / 2, ROOT * 0.75].map((freq, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.value = freq
    osc.detune.value = [-6, 5, 0][i]!
    gain.gain.value = 0.05
    osc.connect(gain).connect(filter)
    osc.start()
    return osc
  })
  lfo.start()

  // Plucked notes, like a lute or a harp in the next room.
  const scale = SCALES[mood]
  let timer: ReturnType<typeof setTimeout> | null = null
  const pluck = () => {
    const t = ctx.currentTime + 0.05
    const step = scale[Math.floor(Math.random() * scale.length)]!
    const freq = ROOT * 2 ** (step / 12) * (Math.random() < 0.3 ? 2 : 1)
    const osc = ctx.createOscillator()
    const tone = ctx.createBiquadFilter()
    const env = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.value = freq
    tone.type = 'lowpass'
    tone.frequency.value = freq * 3
    env.gain.setValueAtTime(0.0001, t)
    env.gain.exponentialRampToValueAtTime(0.09, t + 0.01)
    env.gain.exponentialRampToValueAtTime(0.0001, t + 2.4)
    osc.connect(tone).connect(env).connect(master)
    osc.start(t)
    osc.stop(t + 2.5)
    timer = setTimeout(pluck, (mood === 'tavern' ? 900 : 1800) + Math.random() * 2600)
  }
  timer = setTimeout(pluck, 1500)

  playing = {
    mood,
    stop: () => {
      if (timer) clearTimeout(timer)
      const now = ctx.currentTime
      master.gain.cancelScheduledValues(now)
      master.gain.setValueAtTime(master.gain.value, now)
      master.gain.exponentialRampToValueAtTime(0.0001, now + 1.5)
      for (const osc of [...drones, lfo]) osc.stop(now + 1.6)
      setTimeout(() => master.disconnect(), 1800)
    },
  }
}

export function stopMusic(): void {
  playing?.stop()
  playing = null
}
