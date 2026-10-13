import { shallow } from 'zustand/shallow'
import { createStore, type StateCreator, type StoreApi } from 'zustand/vanilla'

/**
 * Undo/redo for Zustand stores, based on snapshots of a selected slice.
 *
 * Game state is updated immutably, so a snapshot is just a set of references:
 * keeping hundreds of them is cheap. Each entry carries a label so the
 * history can be shown to the GM ("Gorak −7 PV", "Gobelin 2 déplacé"…).
 *
 * Usage:
 *   const history = createHistory<Snapshot>({ limit: 200 })
 *   const useStore = create<State>()(withHistory(history, { select, apply }, (set) => ({ … })))
 *   history.getState().transaction('Dégâts de zone', () => { …several sets… })
 *   history.getState().undo()
 */

export interface HistoryEntry<S> {
  label: string
  snapshot: S
  at: number
}

export interface HistoryState<S> {
  past: HistoryEntry<S>[]
  future: HistoryEntry<S>[]
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
  clear: () => void
  /** Groups every change made inside `fn` into a single labelled entry. */
  transaction: <R>(label: string, fn: () => R) => R
  /** Applies changes inside `fn` without recording them (e.g. loading a campaign). */
  untracked: <R>(fn: () => R) => R
}

export interface HistoryOptions {
  limit?: number
  defaultLabel?: string
  now?: () => number
}

export interface TrackOptions<T, S extends object> {
  /** Picks the part of the state that undo/redo restores. */
  select: (state: T) => S
  /** Turns a snapshot back into a state patch. Defaults to merging the snapshot. */
  apply?: (snapshot: S) => Partial<T>
}

interface Binding<S> {
  read: () => S
  write: (snapshot: S) => void
}

/** A recorded change, an undo or a redo, with the label of the change concerned. */
export interface HistoryEvent {
  kind: 'do' | 'undo' | 'redo'
  label: string
}

export type HistoryStore<S> = StoreApi<HistoryState<S>> & {
  /** Called after each recorded change, undo and redo (activity log, D-247). Returns the unsubscribe. */
  onEvent: (listener: (event: HistoryEvent) => void) => () => void
  /** @internal — connects the history to the store it tracks. */
  bind: (binding: Binding<S>) => void
  /** @internal — called by the tracked store after each set. */
  record: (before: S, after: S) => void
}

export function createHistory<S extends object>(options: HistoryOptions = {}): HistoryStore<S> {
  const limit = options.limit ?? 200
  const defaultLabel = options.defaultLabel ?? 'Modification'
  const now = options.now ?? Date.now

  let binding: Binding<S> | null = null
  let depth = 0
  let suspended = 0
  let txBefore: S | null = null
  let txLabel = defaultLabel
  const listeners = new Set<(event: HistoryEvent) => void>()
  const emit = (event: HistoryEvent) => listeners.forEach((l) => l(event))

  const store = createStore<HistoryState<S>>()((set, get) => {
    const push = (label: string, snapshot: S) => {
      set((s) => {
        const past = [...s.past, { label, snapshot, at: now() }].slice(-limit)
        return { past, future: [], canUndo: past.length > 0, canRedo: false }
      })
      emit({ kind: 'do', label })
    }

    const move = (from: 'past' | 'future') => {
      if (!binding || depth > 0) return
      const source = get()[from]
      const entry = source.at(-1)
      if (!entry) return
      const current: HistoryEntry<S> = { label: entry.label, snapshot: binding.read(), at: now() }
      suspended++
      try {
        binding.write(entry.snapshot)
      } finally {
        suspended--
      }
      set((s) => {
        const remaining = source.slice(0, -1)
        const past = from === 'past' ? remaining : [...s.past, current]
        const future = from === 'past' ? [...s.future, current] : remaining
        return { past, future, canUndo: past.length > 0, canRedo: future.length > 0 }
      })
      emit({ kind: from === 'past' ? 'undo' : 'redo', label: entry.label })
    }

    return {
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
      undo: () => move('past'),
      redo: () => move('future'),
      clear: () => set({ past: [], future: [], canUndo: false, canRedo: false }),
      transaction: (label, fn) => {
        if (depth === 0 && binding) {
          txBefore = binding.read()
          txLabel = label
        }
        depth++
        try {
          return fn()
        } finally {
          depth--
          if (depth === 0 && binding && txBefore) {
            const before = txBefore
            txBefore = null
            if (!shallow(before, binding.read())) push(txLabel, before)
          }
        }
      },
      untracked: (fn) => {
        suspended++
        try {
          return fn()
        } finally {
          suspended--
        }
      },
    }
  })

  return Object.assign(store, {
    bind: (b: Binding<S>) => {
      binding = b
    },
    onEvent: (listener: (event: HistoryEvent) => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    record: (before: S, after: S) => {
      if (suspended > 0 || depth > 0 || shallow(before, after)) return
      const s = store.getState()
      const past = [...s.past, { label: defaultLabel, snapshot: before, at: now() }].slice(-limit)
      store.setState({ past, future: [], canUndo: true, canRedo: false })
      emit({ kind: 'do', label: defaultLabel })
    },
  })
}

/** Zustand middleware: records every change to `select(state)` into `history`. */
export function withHistory<T extends object, S extends object>(
  history: HistoryStore<S>,
  options: TrackOptions<T, S>,
  initializer: StateCreator<T, [], []>,
): StateCreator<T, [], []> {
  const apply = options.apply ?? ((snapshot: S) => snapshot as unknown as Partial<T>)
  return (set, get, api) => {
    const trackedSet = ((partial: Parameters<typeof set>[0], replace?: boolean) => {
      const before = options.select(get())
      ;(set as (p: typeof partial, r?: boolean) => void)(partial, replace)
      history.record(before, options.select(get()))
    }) as typeof set

    history.bind({ read: () => options.select(get()), write: (snapshot) => set(apply(snapshot)) })
    api.setState = trackedSet
    return initializer(trackedSet, get, api)
  }
}
