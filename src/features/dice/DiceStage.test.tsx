import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEntity } from '@/domain/entity'
import type { RollRecord } from '@/domain/rolls'
import type { Entity } from '@/domain/types'
import { useSettingsStore } from '@/stores/settingsStore'
import { configuredRules } from '@/test/fixtures'
import { DiceStage } from './DiceStage'

const rules = configuredRules()
const base = createEntity('player', 'c', rules, { identity: { pseudo: 'Lyra' } })
const lyra: Entity = { ...base, details: { xp: 0, color: 'emerald' } } as Entity
const entities = { [lyra.id]: lyra }

function roll(id: string, patch: Partial<RollRecord> = {}): RollRecord {
  return {
    id,
    campaignId: 'c',
    at: Date.now(),
    entityId: lyra.id,
    kind: 'free',
    label: 'Discrétion (Dextérité)',
    expression: '1d20',
    total: 17,
    breakdown: '[17]',
    groups: [{ source: '1d20', sides: 20, dice: [{ value: 17, kept: true }], total: 17 }],
    secret: false,
    check: null,
    rerollOf: null,
    note: '',
    ...patch,
  }
}

const old = roll('old', { at: Date.now() - 2000, total: 3 })

beforeEach(() => {
  useSettingsStore.setState({ diceStage: true, soundEffects: false, animations: 'off' })
})
afterEach(() => vi.useRealTimers())

describe('dice stage (D-268)', () => {
  it('shows a new roll big, in the roller colour, and announces it', () => {
    const view = render(<DiceStage rolls={[old]} entities={entities} showSecret={false} active />)
    // What was there at mount is history.
    expect(screen.queryByTestId('dice-stage')).not.toBeInTheDocument()

    view.rerender(
      <DiceStage rolls={[old, roll('new')]} entities={entities} showSecret={false} active />,
    )
    const stage = screen.getByTestId('dice-stage')
    expect(stage).toHaveAttribute('data-player-color', 'emerald')
    expect(stage).toHaveTextContent('Lyra')
    expect(stage).toHaveTextContent('Discrétion (Dextérité)')
    expect(screen.getByTestId('dice-stage-total')).toHaveTextContent('17')
    expect(screen.getByTestId('dice-stage-live')).toHaveTextContent(
      'Lyra, Discrétion (Dextérité) : 17',
    )
  })

  it('wears the GM gold for a GM roll and leaves by itself', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const view = render(<DiceStage rolls={[]} entities={entities} showSecret active />)
    view.rerender(
      <DiceStage
        rolls={[roll('gm', { entityId: null, label: 'Embuscade' })]}
        entities={entities}
        showSecret
        active
      />,
    )
    expect(screen.getByTestId('dice-stage')).toHaveAttribute('data-player-color', 'gm')
    expect(screen.getByTestId('dice-stage')).toHaveTextContent('MJ')
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(screen.getByTestId('dice-stage-live')).toBeEmptyDOMElement()
  })

  it('never shows a secret roll on a player device', () => {
    const view = render(<DiceStage rolls={[]} entities={entities} showSecret={false} active />)
    view.rerender(
      <DiceStage
        rolls={[roll('s', { secret: true, entityId: null })]}
        entities={entities}
        showSecret={false}
        active
      />,
    )
    expect(screen.queryByTestId('dice-stage')).not.toBeInTheDocument()
  })

  it('stays quiet outside a live game and when the setting is off', () => {
    const view = render(<DiceStage rolls={[]} entities={entities} showSecret active={false} />)
    view.rerender(<DiceStage rolls={[roll('a')]} entities={entities} showSecret active={false} />)
    expect(screen.queryByTestId('dice-stage')).not.toBeInTheDocument()

    act(() => useSettingsStore.setState({ diceStage: false }))
    view.rerender(
      <DiceStage rolls={[roll('a'), roll('b')]} entities={entities} showSecret active />,
    )
    expect(screen.queryByTestId('dice-stage')).not.toBeInTheDocument()
  })

  it('skips to the next roll with Escape', () => {
    const view = render(<DiceStage rolls={[]} entities={entities} showSecret active />)
    view.rerender(
      <DiceStage
        rolls={[
          roll('a', { label: 'Premier' }),
          roll('b', { label: 'Second', at: Date.now() + 1 }),
        ]}
        entities={entities}
        showSecret
        active
      />,
    )
    expect(screen.getByTestId('dice-stage-live')).toHaveTextContent('Premier')
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(screen.getByTestId('dice-stage-live')).toHaveTextContent('Second')
  })
})
