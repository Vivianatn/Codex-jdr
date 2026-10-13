import { clamp } from '../numbers'
/**
 * Audio engine (D-251): one AudioContext for the whole app, two buses
 * (sound effects, music) with their own volume. Everything is synthesised
 * on the fly: no audio file, nothing to download or license.
 *
 * Browsers only allow sound after a user gesture: the context is created
 * lazily and resumed on the next click or key press if it was suspended.
 * Without Web Audio (tests, old browsers) every call does nothing.
 */

type Bus = 'sfx' | 'music'

interface Engine {
  ctx: AudioContext
  buses: Record<Bus, GainNode>
}

let engine: Engine | null = null
let unavailable = false
const volumes: Record<Bus, number> = { sfx: 0.7, music: 0.35 }

function create(): Engine | null {
  if (unavailable) return null
  const Ctor =
    typeof window === 'undefined'
      ? undefined
      : (window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
  if (!Ctor) {
    unavailable = true
    return null
  }
  const ctx = new Ctor()
  // A gentle limiter keeps stacked sounds (dice + critical + damage) from clipping.
  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = -10
  limiter.ratio.value = 8
  limiter.connect(ctx.destination)
  const bus = (name: Bus) => {
    const gain = ctx.createGain()
    gain.gain.value = volumes[name]
    gain.connect(limiter)
    return gain
  }
  const created = { ctx, buses: { sfx: bus('sfx'), music: bus('music') } }
  const resume = () => {
    if (ctx.state === 'suspended') void ctx.resume()
  }
  window.addEventListener('pointerdown', resume, { capture: true })
  window.addEventListener('keydown', resume, { capture: true })
  return created
}

/** The context and the bus to plug a sound into, or null when sound is impossible. */
export function audio(bus: Bus): { ctx: AudioContext; out: GainNode } | null {
  engine ??= create()
  if (!engine) return null
  if (engine.ctx.state === 'suspended') void engine.ctx.resume()
  return { ctx: engine.ctx, out: engine.buses[bus] }
}

/** 0–1. Applied smoothly to sounds already playing. */
export function setVolume(bus: Bus, value: number): void {
  volumes[bus] = clamp(value, 0, 1)
  if (!engine) return
  engine.buses[bus].gain.setTargetAtTime(volumes[bus], engine.ctx.currentTime, 0.05)
}

/** White noise, made once and reused by every percussive sound. */
let noise: AudioBuffer | null = null
export function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noise && noise.sampleRate === ctx.sampleRate) return noise
  const length = ctx.sampleRate
  noise = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
  return noise
}
