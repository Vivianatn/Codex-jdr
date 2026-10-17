import { beforeEach, describe, expect, it, vi } from 'vitest'
import { newMap, type GameMap, type Token } from '@/domain/maps'
import { getMessages } from '@/i18n'
import { useCampaignStore } from '@/stores/campaignStore'
import { useMapViewStore, type TeleportPick } from '@/stores/mapViewStore'
import { advancePick, cellName, pickProblem, tokenSize } from './teleport'
import { createTeleportPicker } from './useTeleportPick'

const tk = (entityId: string, col: number, row: number, size = 1): Token => ({
  id: `tk-${entityId}`,
  entityId,
  col,
  row,
  size,
  hidden: false,
})
const world = (): Record<string, GameMap> => ({
  hall: {
    ...newMap('c', { name: 'Hall', cols: 8, rows: 8 }),
    id: 'hall',
    tokens: [tk('lyra', 1, 1, 2)],
  },
  crypt: {
    ...newMap('c', { name: 'Crypte', cols: 6, rows: 5 }),
    id: 'crypt',
    tokens: [tk('ghoul', 3, 3)],
  },
})
const pickOf = (patch: Partial<TeleportPick> = {}): TeleportPick => ({
  queue: [
    { entityId: 'lyra', mapId: 'crypt' },
    { entityId: 'gorak', mapId: 'crypt' },
  ],
  total: 2,
  chosen: {},
  then: 'panel',
  ...patch,
})

describe('choosing the exact landing cell (D-277)', () => {
  it('names cells like a chess board', () => {
    expect(cellName({ col: 2, row: 3 })).toBe('C4')
    expect(cellName({ col: 0, row: 0 })).toBe('A1')
    expect(cellName({ col: 26, row: 9 })).toBe('AA10')
  })

  it('refuses a cell outside the map (size-aware) or under another token', () => {
    const maps = world()
    expect(tokenSize(maps, 'lyra')).toBe(2)
    expect(tokenSize(maps, 'nobody')).toBe(1)
    // Lyra is 2×2: her footprint must fit and miss the ghoul.
    expect(pickProblem(maps, pickOf(), { col: 5, row: 0 })).toBe('outside')
    expect(pickProblem(maps, pickOf(), { col: 2, row: 2 })).toBe('occupied')
    expect(pickProblem(maps, pickOf(), { col: 0, row: 0 })).toBeNull()
  })

  it('two characters going to the same map cannot pick the same cell', () => {
    const maps = world()
    const after = advancePick(pickOf(), { col: 0, row: 0 })
    expect(after.queue).toEqual([{ entityId: 'gorak', mapId: 'crypt' }])
    expect(after.chosen).toEqual({ lyra: { mapId: 'crypt', cell: { col: 0, row: 0 } } })
    // Lyra covers A1–B2.
    expect(pickProblem(maps, after, { col: 1, row: 1 })).toBe('occupied')
    expect(pickProblem(maps, after, { col: 2, row: 0 })).toBeNull()
  })
})

describe('the pick queue on the stores (D-277)', () => {
  const t = getMessages()
  beforeEach(() => {
    useCampaignStore.setState({ maps: world() })
    useMapViewStore.setState({ teleportPick: null, teleportDraft: null, teleportOpen: false })
  })

  it('panel path: cells go back to the draft, one character after the other', () => {
    const actions = { teleportCharacters: vi.fn() }
    const picker = createTeleportPicker(t, actions)
    useMapViewStore.getState().setTeleportDraft({
      checked: ['lyra', 'gorak'],
      dest: {},
      at: {},
      familiarsFollow: true,
    })
    picker.start(pickOf().queue, 'panel')
    expect(useMapViewStore.getState().teleportOpen).toBe(false)
    expect(picker.choose({ col: 0, row: 0 })).toBe(true)
    expect(useMapViewStore.getState().teleportPick?.queue[0]?.entityId).toBe('gorak')
    // Gorak cannot land on Lyra's footprint.
    expect(picker.choose({ col: 1, row: 0 })).toBe(false)
    expect(picker.choose({ col: 4, row: 0 })).toBe(true)
    const view = useMapViewStore.getState()
    expect(view.teleportPick).toBeNull()
    expect(view.teleportOpen).toBe(true)
    expect(view.teleportDraft?.at).toEqual({
      lyra: { mapId: 'crypt', cell: { col: 0, row: 0 } },
      gorak: { mapId: 'crypt', cell: { col: 4, row: 0 } },
    })
    expect(actions.teleportCharacters).not.toHaveBeenCalled()
  })

  it('menu path: teleports at once; cancel gives the view back without moving anyone', () => {
    const actions = { teleportCharacters: vi.fn() }
    const picker = createTeleportPicker(t, actions)
    picker.start([{ entityId: 'lyra', mapId: 'crypt' }], 'teleport')
    picker.cancel()
    expect(useMapViewStore.getState().teleportPick).toBeNull()
    expect(useMapViewStore.getState().teleportOpen).toBe(false)
    picker.start([{ entityId: 'lyra', mapId: 'crypt' }], 'teleport')
    picker.choose({ col: 0, row: 2 })
    expect(actions.teleportCharacters).toHaveBeenCalledWith([
      { entityId: 'lyra', toMapId: 'crypt', at: { col: 0, row: 2 } },
    ])
    expect(useMapViewStore.getState().teleportPick).toBeNull()
  })
})
