import { audio, noiseBuffer } from './engine'

/**
 * Sound effects of the table (D-251), synthesised: wooden dice on a table,
 * brass and bells for the good moments, low drums for the bad ones.
 */

export const SOUNDS = [
  'dice',
  'success',
  'failure',
  'critSuccess',
  'critFailure',
  'damage',
  'heavyDamage',
  'heal',
  'levelUp',
  'turn',
  'round',
  'gmTurn',
  'victory',
  'defeat',
  'click',
] as const
export type SoundName = (typeof SOUNDS)[number]

interface Note {
  freq: number
  at?: number
  dur: number
  gain?: number
  type?: OscillatorType
  /** Pitch at the end (glide). */
  to?: number
  attack?: number
}

type Out = { ctx: AudioContext; out: AudioNode }

function note({ ctx, out }: Out, n: Note, start: number) {
  const t = start + (n.at ?? 0)
  const osc = ctx.createOscillator()
  const env = ctx.createGain()
  osc.type = n.type ?? 'triangle'
  osc.frequency.setValueAtTime(n.freq, t)
  if (n.to) osc.frequency.exponentialRampToValueAtTime(n.to, t + n.dur)
  const peak = n.gain ?? 0.3
  const attack = n.attack ?? 0.008
  env.gain.setValueAtTime(0.0001, t)
  env.gain.exponentialRampToValueAtTime(peak, t + attack)
  env.gain.exponentialRampToValueAtTime(0.0001, t + n.dur)
  osc.connect(env).connect(out)
  osc.start(t)
  osc.stop(t + n.dur + 0.05)
}

/** A short filtered noise burst: a die hitting wood, a drum skin, a whoosh. */
function burst(
  { ctx, out }: Out,
  start: number,
  {
    dur,
    freq,
    q = 1,
    gain = 0.3,
    type = 'bandpass',
  }: { dur: number; freq: number; q?: number; gain?: number; type?: BiquadFilterType },
) {
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(ctx)
  const filter = ctx.createBiquadFilter()
  filter.type = type
  filter.frequency.value = freq
  filter.Q.value = q
  const env = ctx.createGain()
  env.gain.setValueAtTime(gain, start)
  env.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  src.connect(filter).connect(env).connect(out)
  src.start(start, Math.random() * 0.5)
  src.stop(start + dur + 0.02)
}

/** A bell: inharmonic partials that ring and fade. */
function bell(o: Out, start: number, freq: number, gain = 0.18, dur = 1.6) {
  for (const [ratio, level] of [
    [1, 1],
    [2.76, 0.45],
    [5.4, 0.22],
    [8.93, 0.1],
  ] as const)
    note(
      o,
      {
        freq: freq * ratio,
        dur: dur / Math.sqrt(ratio),
        gain: gain * level,
        type: 'sine',
        attack: 0.004,
      },
      start,
    )
}

/** A low drum: a pitched thump plus the skin's noise. */
function drum(o: Out, start: number, freq = 90, gain = 0.5) {
  note(o, { freq: freq * 1.6, to: freq * 0.6, dur: 0.45, gain, type: 'sine', attack: 0.002 }, start)
  burst(o, start, { dur: 0.12, freq: 600, gain: gain * 0.35, type: 'lowpass' })
}

const RECIPES: Record<SoundName, (o: Out, t: number) => void> = {
  // Two or three dice rattling then settling on the table.
  dice: (o, t) => {
    let at = 0
    for (let i = 0; i < 7; i++) {
      at += 0.025 + Math.random() * 0.055 * (1 + i * 0.25)
      burst(o, t + at, {
        dur: 0.04,
        freq: 1800 + Math.random() * 1600,
        q: 2.5,
        gain: 1.4 - i * 0.12,
      })
    }
  },
  success: (o, t) => {
    note(o, { freq: 587.3, dur: 0.25, gain: 0.3 }, t)
    note(o, { freq: 880, at: 0.09, dur: 0.4, gain: 0.3 }, t)
  },
  failure: (o, t) => {
    note(o, { freq: 220, to: 196, dur: 0.45, gain: 0.55, type: 'sawtooth' }, t)
    burst(o, t, { dur: 0.2, freq: 300, gain: 0.4, type: 'lowpass' })
  },
  // Brass fanfare and a bell: the table cheers.
  critSuccess: (o, t) => {
    for (const [i, f] of [523.3, 659.3, 784, 1046.5].entries())
      note(
        o,
        { freq: f, at: i * 0.08, dur: 0.5 + i * 0.1, gain: 0.16, type: 'sawtooth', attack: 0.02 },
        t,
      )
    bell(o, t + 0.32, 1046.5, 0.14, 2)
  },
  // A falling minor line over a dull drum.
  critFailure: (o, t) => {
    drum(o, t, 70, 0.55)
    for (const [i, f] of [392, 349.2, 311.1, 233.1].entries())
      note(
        o,
        { freq: f, at: 0.05 + i * 0.12, dur: 0.4, gain: 0.14, type: 'sawtooth', attack: 0.02 },
        t,
      )
  },
  damage: (o, t) => {
    note(o, { freq: 160, to: 60, dur: 0.22, gain: 0.7, type: 'sine', attack: 0.002 }, t)
    burst(o, t, { dur: 0.09, freq: 1200, gain: 0.8 })
  },
  heavyDamage: (o, t) => {
    drum(o, t, 60, 0.7)
    burst(o, t, { dur: 0.25, freq: 900, q: 0.7, gain: 0.3 })
  },
  heal: (o, t) => {
    for (const [i, f] of [659.3, 784, 987.8].entries())
      note(o, { freq: f, at: i * 0.07, dur: 0.6, gain: 0.12, type: 'sine', attack: 0.03 }, t)
  },
  levelUp: (o, t) => {
    for (const [i, f] of [392, 523.3, 659.3, 784, 1046.5].entries())
      note(o, { freq: f, at: i * 0.09, dur: 0.6, gain: 0.15, type: 'square', attack: 0.01 }, t)
    bell(o, t + 0.45, 1568, 0.1, 2.2)
  },
  turn: (o, t) => bell(o, t, 659.3, 0.16, 1.4),
  round: (o, t) => {
    drum(o, t, 85, 0.5)
    drum(o, t + 0.22, 85, 0.6)
  },
  // The GM's turn: a low horn.
  gmTurn: (o, t) => {
    note(o, { freq: 146.8, dur: 1.1, gain: 0.22, type: 'sawtooth', attack: 0.12 }, t)
    note(o, { freq: 220, dur: 1.1, gain: 0.12, type: 'sawtooth', attack: 0.15 }, t)
  },
  victory: (o, t) => {
    for (const [i, f] of [523.3, 523.3, 523.3, 659.3, 784].entries())
      note(
        o,
        {
          freq: f,
          at: [0, 0.15, 0.3, 0.45, 0.75][i]!,
          dur: i === 4 ? 1.2 : 0.18,
          gain: 0.17,
          type: 'sawtooth',
          attack: 0.01,
        },
        t,
      )
    drum(o, t + 0.75, 90, 0.5)
    bell(o, t + 0.75, 1046.5, 0.12, 2.4)
  },
  defeat: (o, t) => {
    drum(o, t, 55, 0.6)
    for (const [i, f] of [293.7, 277.2, 261.6, 220].entries())
      note(o, { freq: f, at: i * 0.35, dur: 0.8, gain: 0.14, type: 'triangle', attack: 0.05 }, t)
  },
  // A wooden tap, for the main game buttons and tabs.
  click: (o, t) => burst(o, t, { dur: 0.035, freq: 2200, q: 1.5, gain: 1.6 }),
}

/** Plays a sound now (or `delay` seconds later). Silent without Web Audio. */
export function playSound(name: SoundName, delay = 0): void {
  const o = audio('sfx')
  if (!o) return
  RECIPES[name](o, o.ctx.currentTime + 0.01 + delay)
}
