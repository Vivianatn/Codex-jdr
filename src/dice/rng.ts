/** A random source returning a float in [0, 1). Injectable so tests are reproducible. */
export type Rng = () => number

/** Cryptographically strong default (fair dice, no modulo bias at these sizes). */
export const cryptoRng: Rng = () => {
  const buffer = new Uint32Array(1)
  crypto.getRandomValues(buffer)
  return buffer[0]! / 0x1_0000_0000
}

/** Small seeded generator (mulberry32) for tests and simulations. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Uniform integer in [1, sides]. */
export function rollDie(sides: number, rng: Rng): number {
  return Math.floor(rng() * sides) + 1
}
