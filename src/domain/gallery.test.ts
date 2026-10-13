import { describe, expect, it } from 'vitest'
import {
  newElement,
  newMap,
  passageAt,
  passagesTo,
  withPassage,
  withReturnPassage,
  withToken,
} from './maps'
import {
  emptyPlayState,
  galleryPosition,
  normalizePlayState,
  showGallery,
  stepGallery,
} from './turns'

describe('picture zones and series (D-259)', () => {
  it('a picture zone is a GM tool: never drawn for the players, starts empty', () => {
    const zone = newElement('image', { col: 1, row: 1 })
    expect(zone.layer).toBe('gm')
    expect(zone.gallery).toEqual({ assetIds: [] })
    expect(zone).toMatchObject({ w: 2, h: 2 })
  })

  it('shows a series one picture at a time and stays put at both ends', () => {
    const first = showGallery(['a', 'b', 'c'])
    expect(first).toEqual({ mode: 'image', imageAssetId: 'a', gallery: ['a', 'b', 'c'] })
    expect(galleryPosition(first)).toEqual({ index: 0, total: 3 })
    expect(stepGallery(first, -1)).toEqual(first)
    const last = stepGallery(stepGallery(first, 1), 1)
    expect(last.imageAssetId).toBe('c')
    expect(stepGallery(last, 1)).toEqual(last)
    expect(showGallery(['a', 'b'], 9).imageAssetId).toBe('b')
  })

  it('a single mood picture is not a series', () => {
    expect(galleryPosition(showGallery(['a']))).toBeNull()
    expect(galleryPosition({ ...showGallery(['a', 'b']), mode: 'map' })).toBeNull()
  })

  it('old play states get an empty series; junk is dropped', () => {
    const old = { ...emptyPlayState(), display: { mode: 'image', imageAssetId: 'x' } }
    expect(normalizePlayState(old).display.gallery).toEqual([])
    const junk = {
      ...emptyPlayState(),
      display: { mode: 'map', imageAssetId: null, gallery: [1, 'a'] },
    }
    expect(normalizePlayState(junk).display.gallery).toEqual(['a'])
  })
})

describe('a door has two sides (D-259)', () => {
  const hall = () => ({ ...newMap('c', { name: 'Hall', cols: 10, rows: 8 }), id: 'hall' })
  const cellar = () => ({ ...newMap('c', { name: 'Cave', cols: 6, rows: 6 }), id: 'cellar' })

  it('the target gets a way back, where the door stands (kept inside the target)', () => {
    const back = withReturnPassage(cellar(), hall(), { x: 8, y: 2 }, 'Porte vers Hall')
    const [door] = passagesTo(back, 'hall')
    expect(door).toMatchObject({ kind: 'link', x: 5, y: 2, label: 'Porte vers Hall' })
  })

  it('never a second one, never on another passage, never towards itself', () => {
    const once = withReturnPassage(cellar(), hall(), { x: 1, y: 1 }, 'retour')
    expect(withReturnPassage(once, hall(), { x: 3, y: 3 }, 'retour')).toBe(once)
    const busy = withPassage(cellar(), { col: 1, row: 1 }, 'crypt', 'vers Crypte')
    const both = withReturnPassage(busy, hall(), { x: 1, y: 1 }, 'retour')
    const [door] = passagesTo(both, 'hall')
    expect(door).toBeDefined()
    expect(passageAt(busy, { col: door!.x, row: door!.y })).toBeUndefined()
    const self = hall()
    expect(withReturnPassage(self, self, { x: 0, y: 0 }, 'x')).toBe(self)
  })
})

describe('characters placed in the editor (D-259)', () => {
  it('any kind goes on the map; placing again moves the same token', () => {
    const map = newMap('c', { name: 'Hall', cols: 10, rows: 8 })
    const ally = { id: 'brann', kind: 'ally' }
    const once = withToken(map, ally, { col: 2, row: 2 })
    expect(once.tokens).toEqual([expect.objectContaining({ entityId: 'brann', col: 2, row: 2 })])
    const moved = withToken(once, ally, { col: 4, row: 4 })
    expect(moved.tokens).toHaveLength(1)
    expect(moved.tokens[0]).toMatchObject({ col: 4, row: 4, id: once.tokens[0]!.id })
  })

  it('enemies start hidden under the fog, the others never', () => {
    const map = { ...newMap('c', { name: 'Hall' }), fog: { enabled: true, revealed: '' } }
    expect(withToken(map, { id: 'g', kind: 'enemy' }).tokens[0]!.hidden).toBe(true)
    expect(withToken(map, { id: 'p', kind: 'familiar' }).tokens[0]!.hidden).toBe(false)
  })
})
