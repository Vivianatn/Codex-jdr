import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { create } from 'zustand'
import { createHistory, shallowEqual, withHistory } from './history'

interface Snapshot {
  hp: Record<string, number>
  round: number
}

interface TestState extends Snapshot {
  label: string
  damage: (id: string, amount: number) => void
  nextRound: () => void
  setLabel: (label: string) => void
}

function setup(limit?: number) {
  const history = createHistory<Snapshot>({ limit, now: () => 0 })
  const useStore = create<TestState>()(
    withHistory(history, { select: ({ hp, round }) => ({ hp, round }) }, (set) => ({
      hp: { gorak: 20, gobelin: 7 },
      round: 1,
      label: '',
      damage: (id, amount) =>
        set((s) => ({ hp: { ...s.hp, [id]: Math.max(0, (s.hp[id] ?? 0) - amount) } })),
      nextRound: () => set((s) => ({ round: s.round + 1 })),
      setLabel: (label) => set({ label }),
    })),
  )
  return { history, useStore, h: () => history.getState(), s: () => useStore.getState() }
}

describe('history middleware', () => {
  it('undoes and redoes a change', () => {
    const { h, s } = setup()
    s().damage('gorak', 7)
    expect(s().hp.gorak).toBe(13)
    expect(h().canUndo).toBe(true)

    h().undo()
    expect(s().hp.gorak).toBe(20)
    expect(h().canRedo).toBe(true)

    h().redo()
    expect(s().hp.gorak).toBe(13)
    expect(h().canRedo).toBe(false)
  })

  it('tells listeners about changes, undos and redos, not about untracked or empty ones', () => {
    const { history, h, s } = setup()
    const events: unknown[] = []
    const stop = history.onEvent((e) => events.push(e))
    h().transaction('Gorak −7 PV', () => s().damage('gorak', 7))
    h().transaction('Rien', () => s().setLabel('x'))
    h().untracked(() => s().nextRound())
    h().undo()
    h().redo()
    stop()
    s().nextRound()
    expect(events).toEqual([
      { kind: 'do', label: 'Gorak −7 PV' },
      { kind: 'undo', label: 'Gorak −7 PV' },
      { kind: 'redo', label: 'Gorak −7 PV' },
    ])
  })

  it('ignores changes outside the tracked slice', () => {
    const { h, s } = setup()
    s().setLabel('UI only')
    expect(h().past).toHaveLength(0)
  })

  it('ignores no-op sets', () => {
    const { h, useStore } = setup()
    useStore.setState((st) => ({ hp: st.hp }))
    expect(h().past).toHaveLength(0)
  })

  it('records changes made through api.setState', () => {
    const { h, s, useStore } = setup()
    useStore.setState({ round: 5 })
    h().undo()
    expect(s().round).toBe(1)
  })

  it('groups a transaction into one labelled entry', () => {
    const { h, s } = setup()
    h().transaction('Boule de feu', () => {
      s().damage('gorak', 4)
      s().damage('gobelin', 4)
    })
    expect(h().past).toHaveLength(1)
    expect(h().past[0]?.label).toBe('Boule de feu')

    h().undo()
    expect(s().hp).toEqual({ gorak: 20, gobelin: 7 })
  })

  it('supports nested transactions as a single entry', () => {
    const { h, s } = setup()
    h().transaction('outer', () => {
      s().damage('gorak', 1)
      h().transaction('inner', () => s().nextRound())
    })
    expect(h().past.map((e) => e.label)).toEqual(['outer'])
  })

  it('does not record untracked changes', () => {
    const { h, s } = setup()
    h().untracked(() => s().nextRound())
    expect(s().round).toBe(2)
    expect(h().past).toHaveLength(0)
  })

  it('clears the redo stack when a new change happens', () => {
    const { h, s } = setup()
    s().nextRound()
    h().undo()
    s().damage('gorak', 1)
    expect(h().canRedo).toBe(false)
  })

  it('caps the history at the configured limit', () => {
    const { h, s } = setup(3)
    for (let i = 0; i < 10; i++) s().nextRound()
    expect(h().past).toHaveLength(3)
    h().undo()
    h().undo()
    h().undo()
    h().undo() // nothing left: no-op
    expect(s().round).toBe(8)
  })

  it('undoing N times then redoing N times returns to the same state (property)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.oneof(fc.constant('round' as const), fc.integer({ min: 1, max: 30 })), {
          maxLength: 25,
        }),
        (actions) => {
          const { h, s } = setup(1000)
          const initial = { hp: s().hp, round: s().round }
          for (const action of actions) {
            if (action === 'round') s().nextRound()
            else s().damage('gorak', action)
          }
          const final = { hp: s().hp, round: s().round }
          const steps = h().past.length

          for (let i = 0; i < steps; i++) h().undo()
          expect({ hp: s().hp, round: s().round }).toEqual(initial)

          for (let i = 0; i < steps; i++) h().redo()
          expect({ hp: s().hp, round: s().round }).toEqual(final)
        },
      ),
    )
  })
})

describe('shallowEqual', () => {
  it('compares own keys by reference', () => {
    const inner = { a: 1 }
    expect(shallowEqual({ x: inner }, { x: inner })).toBe(true)
    expect(shallowEqual({ x: inner }, { x: { a: 1 } })).toBe(false)
    expect(shallowEqual({ x: 1 }, { x: 1, y: 2 })).toBe(false)
  })
})
