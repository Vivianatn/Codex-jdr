import { create } from 'zustand'

/** Short-lived visual effects (floating numbers, shakes) — never persisted. */
export interface HpFx {
  id: string
  entityId: string
  kind: 'damage' | 'heal' | 'temp'
  amount: number
  /** HP reached 0 or crossed into "Critique": shake and flash. */
  severe: boolean
}

interface FxState {
  hp: HpFx[]
  /** Last roll to animate in the roll feed. */
  rollToAnimate: string | null
  pushHp: (fx: Omit<HpFx, 'id'>) => void
  dropHp: (id: string) => void
  animateRoll: (rollId: string) => void
}

export const useFxStore = create<FxState>()((set) => ({
  hp: [],
  rollToAnimate: null,
  pushHp: (fx) => set((s) => ({ hp: [...s.hp, { ...fx, id: crypto.randomUUID() }].slice(-30) })),
  dropHp: (id) => set((s) => ({ hp: s.hp.filter((f) => f.id !== id) })),
  animateRoll: (rollToAnimate) => set({ rollToAnimate }),
}))
