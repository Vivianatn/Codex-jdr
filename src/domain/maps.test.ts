import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  arrivalCell,
  autoRevealFog,
  blockingWall,
  calibrateGrid,
  cellAt,
  cellCenter,
  cellDistance,
  cellsInCircle,
  entityMapId,
  fillFog,
  freeCellNear,
  isRevealed,
  mapTree,
  newElement,
  newMap,
  normalizeMap,
  passageAt,
  passagesTo,
  pointInArea,
  segmentsIntersect,
  setFog,
  teleport,
  tokenCenter,
  tokensInArea,
  visibleCells,
  visibleToPlayers,
  withPassage,
  type GameMap,
  type Token,
  type Wall,
} from './maps'

const square = () => newMap('c', { name: 'Crypte', cols: 10, rows: 8, size: 50 })
const hex = () => newMap('c', { name: 'Plaine', cols: 10, rows: 8, size: 60, gridType: 'hex' })

describe('grid geometry', () => {
  it('square: centre and cell lookup are inverse', () => {
    const { grid } = square()
    expect(cellCenter(grid, { col: 2, row: 3 })).toEqual({ x: 125, y: 175 })
    expect(cellAt(grid, { x: 125, y: 175 })).toEqual({ col: 2, row: 3 })
    expect(cellAt(grid, { x: 149.9, y: 150 })).toEqual({ col: 2, row: 3 })
  })

  it('hex: the centre of every cell maps back to that cell (property)', () => {
    const { grid } = hex()
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 40 }), fc.integer({ min: 0, max: 40 }), (col, row) => {
        expect(cellAt(grid, cellCenter(grid, { col, row }))).toEqual({ col, row })
      }),
    )
  })

  it('distances follow the diagonal rule on squares, hex steps on hexes', () => {
    const { grid } = square()
    const a = { col: 0, row: 0 }
    const b = { col: 3, row: 4 }
    expect(cellDistance(grid, a, b, 'euclidean')).toBe(5)
    expect(cellDistance(grid, a, b, 'chebyshev')).toBe(4)
    expect(cellDistance(grid, a, b, 'alternate')).toBe(5) // 4 straight-ish + 3 diagonals → 4 + 1
    const h = hex().grid
    expect(cellDistance(h, { col: 0, row: 0 }, { col: 3, row: 0 }, 'euclidean')).toBe(3)
    expect(cellDistance(h, { col: 0, row: 0 }, { col: 0, row: 2 }, 'euclidean')).toBe(2)
  })

  it('large tokens are centred on their whole footprint', () => {
    const { grid } = square()
    expect(tokenCenter(grid, { col: 1, row: 1, size: 2 })).toEqual({ x: 100, y: 100 })
  })

  it('calibration takes the cell size from a box and keeps the offset inside one cell', () => {
    const grid = calibrateGrid(square().grid, { x: 230, y: 115 }, { x: 300, y: 185 })
    expect(grid.size).toBe(70)
    expect(grid.offsetX).toBe(20)
    expect(grid.offsetY).toBe(45)
  })
})

describe('fog of war', () => {
  it('everything is visible until the fog is enabled', () => {
    const map = square()
    expect(isRevealed(map, { col: 3, row: 3 })).toBe(true)
    const fogged = { ...map, fog: { ...map.fog, enabled: true } }
    expect(isRevealed(fogged, { col: 3, row: 3 })).toBe(false)
  })

  it('reveals a brush stroke and hides it again', () => {
    let map: GameMap = { ...square(), fog: { enabled: true, revealed: fillFog(square(), false) } }
    const cells = cellsInCircle(map, { x: 125, y: 125 }, 60)
    map = { ...map, fog: { ...map.fog, revealed: setFog(map, cells, true) } }
    expect(isRevealed(map, { col: 2, row: 2 })).toBe(true)
    expect(isRevealed(map, { col: 8, row: 7 })).toBe(false)
    expect(setFog(map, cells, true)).toBe(map.fog.revealed) // no change → same string
    map = { ...map, fog: { ...map.fog, revealed: setFog(map, cells, false) } }
    expect(isRevealed(map, { col: 2, row: 2 })).toBe(false)
  })

  it('keeps the fog when a map is resized by an older save', () => {
    const map = normalizeMap({
      ...square(),
      cols: 12,
      fog: { enabled: true, revealed: '1'.repeat(80) },
    })
    expect(map.fog.revealed).toHaveLength(96)
    expect(map.fog.revealed.slice(0, 12)).toBe('111111111100')
  })
})

describe('walls, doors and sight', () => {
  const wall = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    extra: Partial<Wall> = {},
  ): Wall => ({
    id: crypto.randomUUID(),
    x1,
    y1,
    x2,
    y2,
    kind: 'wall',
    ...extra,
  })

  it('segment intersection', () => {
    expect(
      segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 }),
    ).toBe(true)
    expect(
      segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }, { x: 10, y: 5 }),
    ).toBe(false)
  })

  it('walls and closed doors block movement; open doors let through', () => {
    const w = wall(100, 0, 100, 400)
    const closed = wall(200, 0, 200, 400, {
      kind: 'door',
      door: { open: false, locked: true, difficulty: 2 },
    })
    const open = wall(300, 0, 300, 400, {
      kind: 'door',
      door: { open: true, locked: false, difficulty: 0 },
    })
    expect(blockingWall([w], { x: 75, y: 75 }, { x: 125, y: 75 })).toBe(w)
    expect(blockingWall([closed], { x: 175, y: 75 }, { x: 225, y: 75 })).toBe(closed)
    expect(blockingWall([open], { x: 275, y: 75 }, { x: 325, y: 75 })).toBeUndefined()
  })

  it('sight stops at walls only when the option is on', () => {
    const map = { ...square(), walls: [wall(200, 0, 200, 400)] }
    const seen = (block: boolean) =>
      visibleCells(map, cellCenter(map.grid, { col: 1, row: 1 }), 5, block).map(
        (c) => `${c.col},${c.row}`,
      )
    expect(seen(true)).not.toContain('5,1')
    expect(seen(false)).toContain('5,1')
  })

  it('auto-reveal opens the fog around viewers', () => {
    const base = square()
    const map: GameMap = {
      ...base,
      fog: { enabled: true, revealed: fillFog(base, false) },
      vision: { autoReveal: true, radius: 2, wallsBlockSight: true },
    }
    const token = { id: 't', entityId: 'e', col: 4, row: 4, size: 1, hidden: false }
    const revealed = autoRevealFog(map, [token])
    expect(isRevealed({ ...map, fog: { ...map.fog, revealed } }, { col: 5, row: 4 })).toBe(true)
    expect(isRevealed({ ...map, fog: { ...map.fog, revealed } }, { col: 9, row: 4 })).toBe(false)
  })
})

describe('areas of effect', () => {
  it('circle, square, cone and line select the right tokens', () => {
    const map: GameMap = {
      ...square(),
      tokens: [
        { id: 'a', entityId: 'a', col: 2, row: 2, size: 1, hidden: false },
        { id: 'b', entityId: 'b', col: 6, row: 2, size: 1, hidden: false },
      ],
    }
    const ids = (area: Parameters<typeof tokensInArea>[1]) =>
      tokensInArea(map, area).map((t) => t.id)
    expect(ids({ kind: 'circle', center: { x: 125, y: 125 }, radius: 60 })).toEqual(['a'])
    expect(ids({ kind: 'square', center: { x: 325, y: 125 }, half: 30 })).toEqual(['b'])
    expect(
      ids({
        kind: 'cone',
        origin: { x: 0, y: 125 },
        direction: 0,
        length: 400,
        angle: Math.PI / 3,
      }),
    ).toEqual(['a', 'b'])
    expect(
      ids({ kind: 'line', from: { x: 100, y: 125 }, to: { x: 400, y: 125 }, width: 20 }),
    ).toEqual(['a', 'b'])
    expect(
      pointInArea(
        { x: 0, y: 300 },
        { kind: 'cone', origin: { x: 0, y: 125 }, direction: 0, length: 400, angle: Math.PI / 3 },
      ),
    ).toBe(false)
  })
})

describe('objects', () => {
  it('traps start hidden; players see them only once spotted', () => {
    const trap = newElement('trap', { col: 1, row: 1 })
    expect(visibleToPlayers(trap)).toBe(false)
    expect(visibleToPlayers({ ...trap, hidden: false })).toBe(false)
    expect(
      visibleToPlayers({ ...trap, hidden: false, trap: { ...trap.trap!, detected: true } }),
    ).toBe(true)
    expect(visibleToPlayers(newElement('note', { col: 0, row: 0 }))).toBe(false)
    expect(visibleToPlayers(newElement('tree', { col: 0, row: 0 }))).toBe(true)
  })
})

describe('passages between maps (D-256)', () => {
  const linked = () => {
    const hall = square()
    const cellar = { ...square(), id: 'cellar', name: 'Cave' }
    const stairs = newElement('link', { col: 4, row: 3 }, { link: { mapId: cellar.id } })
    const back = newElement('link', { col: 1, row: 1 }, { link: { mapId: hall.id } })
    return { hall: { ...hall, elements: [stairs] }, cellar: { ...cellar, elements: [back] } }
  }

  it('a token touches a passage when one of its cells lies under it', () => {
    const { hall } = linked()
    expect(passageAt(hall, { col: 4, row: 3 })?.link?.mapId).toBe('cellar')
    expect(passageAt(hall, { col: 5, row: 3 })).toBeUndefined()
    // A large token (2×2) touches it from the cell up-left.
    expect(passageAt(hall, { col: 3, row: 2 }, 2)).toBeDefined()
  })

  it('hidden links, links without a target and links to the same map are not passages', () => {
    const { hall } = linked()
    const [stairs] = hall.elements
    const variants = [{ hidden: true }, { link: { mapId: null } }, { link: { mapId: hall.id } }]
    for (const patch of variants)
      expect(passageAt({ ...hall, elements: [{ ...stairs!, ...patch }] }, { col: 4, row: 3 })).toBe(
        undefined,
      )
  })

  it('a rotated passage covers its rotated cells', () => {
    const map = square()
    const bridge = newElement('link', { col: 2, row: 2 }, { w: 3, h: 1, link: { mapId: 'x' } })
    expect(passageAt({ ...map, elements: [bridge] }, { col: 3, row: 3 })).toBeUndefined()
    const turned = { ...bridge, rotation: 90 }
    expect(passageAt({ ...map, elements: [turned] }, { col: 3, row: 3 })).toBeDefined()
    expect(passageAt({ ...map, elements: [turned] }, { col: 2, row: 2 })).toBeUndefined()
  })

  it('arrives beside the passage leading back, never on it, else in the middle', () => {
    const { hall, cellar } = linked()
    const cell = arrivalCell(cellar, hall.id)
    expect(passageAt(cellar, cell)).toBeUndefined()
    expect(Math.max(Math.abs(cell.col - 1), Math.abs(cell.row - 1))).toBe(1)
    expect(arrivalCell({ ...cellar, elements: [] }, hall.id)).toEqual({ col: 5, row: 4 })
  })

  it('never lands on another token', () => {
    const map = square()
    const busy = {
      ...map,
      tokens: [{ id: 't', entityId: 'e', col: 5, row: 4, size: 1, hidden: false }],
    }
    expect(freeCellNear(busy, { col: 5, row: 4 })).not.toEqual({ col: 5, row: 4 })
    expect(freeCellNear(busy, { col: 5, row: 4 }, { ignoreEntityId: 'e' })).toEqual({
      col: 5,
      row: 4,
    })
  })

  it('finds the map a character stands on, preferring the one in play', () => {
    const { hall, cellar } = linked()
    const token = { id: 't', entityId: 'ayla', col: 0, row: 0, size: 1, hidden: false }
    const maps = [
      { ...hall, tokens: [token] },
      { ...cellar, tokens: [token] },
    ]
    expect(entityMapId(maps, 'ayla')).toBe(hall.id)
    expect(entityMapId(maps, 'ayla', cellar.id)).toBe(cellar.id)
    expect(entityMapId(maps, 'nobody')).toBeNull()
  })

  it('lays maps out as a tree from the session map, each map once', () => {
    const { hall, cellar } = linked()
    const crypt = { ...square(), id: 'crypt', name: 'Crypte' }
    const lone = { ...square(), id: 'lone', name: 'Auberge' }
    const deeper = {
      ...cellar,
      elements: [
        ...cellar.elements,
        newElement('link', { col: 6, row: 6 }, { link: { mapId: crypt.id } }),
      ],
    }
    const maps = { [hall.id]: hall, [deeper.id]: deeper, [crypt.id]: crypt, [lone.id]: lone }
    const { tree, rest } = mapTree(maps, [hall.id, null, hall.id])
    expect(tree).toHaveLength(1)
    expect(tree[0]!.children.map((c) => c.map.id)).toEqual(['cellar'])
    expect(tree[0]!.children[0]!.children.map((c) => c.map.id)).toEqual(['crypt'])
    expect(rest.map((m) => m.id)).toEqual(['lone'])
  })
})

describe('doors placed from the session editor (D-258)', () => {
  it('adds a passage on the cell, or retargets the one already there', () => {
    const map = square()
    const once = withPassage(map, { col: 2, row: 3 }, 'cellar', 'Porte vers Cave')
    expect(once.elements).toHaveLength(1)
    expect(once.elements[0]).toMatchObject({ kind: 'link', x: 2, y: 3, label: 'Porte vers Cave' })
    expect(passagesTo(once, 'cellar')).toHaveLength(1)
    const again = withPassage(once, { col: 2, row: 3 }, 'crypt', 'Porte vers Crypte')
    expect(again.elements).toHaveLength(1)
    expect(passagesTo(again, 'cellar')).toHaveLength(0)
    expect(passagesTo(again, 'crypt')).toHaveLength(1)
    // And a token stepping on it travels.
    expect(passageAt(again, { col: 2, row: 3 })?.link?.mapId).toBe('crypt')
  })
})

describe('teleportation by the GM (D-276)', () => {
  const tk = (entityId: string, col: number, row: number, extra: Partial<Token> = {}): Token => ({
    id: `tk-${entityId}`,
    entityId,
    col,
    row,
    size: 1,
    hidden: false,
    ...extra,
  })
  const world = () => {
    const hall = {
      ...square(),
      id: 'hall',
      name: 'Hall',
      tokens: [tk('lyra', 1, 1), tk('gorak', 2, 1)],
    }
    const crypt = { ...square(), id: 'crypt', name: 'Crypte', tokens: [tk('ghoul', 5, 4)] }
    const cave = { ...square(), id: 'cave', name: 'Cave' }
    // A wall and fog everywhere: no condition applies to a teleport.
    crypt.walls = [{ id: 'w', x1: 0, y1: 0, x2: 500, y2: 400, kind: 'wall' } as Wall]
    crypt.fog = { ...crypt.fog, enabled: true }
    return { hall, crypt, cave } as Record<string, GameMap>
  }
  const cells = (map: GameMap) => map.tokens.map((t) => `${t.col},${t.row}`)

  it('moves several characters from any map to the same map on distinct adjacent cells', () => {
    const maps = world()
    const next = teleport(maps, [
      { entityId: 'lyra', toMapId: 'crypt' },
      { entityId: 'gorak', toMapId: 'crypt' },
    ])
    expect(next.hall!.tokens).toEqual([])
    const crypt = next.crypt!
    expect(crypt.tokens.map((t) => t.entityId)).toEqual(['ghoul', 'lyra', 'gorak'])
    expect(new Set(cells(crypt)).size).toBe(3)
    const [lyra, gorak] = crypt.tokens.slice(1)
    expect(Math.max(Math.abs(lyra!.col - gorak!.col), Math.abs(lyra!.row - gorak!.row))).toBe(1)
    // The untouched map keeps its identity.
    expect(next.cave).toBe(maps.cave)
  })

  it('sends characters to different maps at once, keeping size and hidden flag', () => {
    const maps = world()
    maps.hall = {
      ...maps.hall!,
      tokens: [tk('lyra', 1, 1, { size: 2, hidden: true }), tk('gorak', 2, 1)],
    }
    const next = teleport(maps, [
      { entityId: 'lyra', toMapId: 'cave' },
      { entityId: 'ghoul', toMapId: 'hall' },
    ])
    expect(next.cave!.tokens).toMatchObject([{ id: 'tk-lyra', size: 2, hidden: true }])
    expect(next.crypt!.tokens).toEqual([])
    expect(next.hall!.tokens.map((t) => t.entityId)).toEqual(['gorak', 'ghoul'])
  })

  it('lands at the chosen cell when free, else next to it', () => {
    const next = teleport(world(), [
      { entityId: 'lyra', toMapId: 'crypt', at: { col: 7, row: 6 } },
      { entityId: 'gorak', toMapId: 'crypt', at: { col: 5, row: 4 } },
    ])
    const crypt = next.crypt!
    expect(crypt.tokens.find((t) => t.entityId === 'lyra')).toMatchObject({ col: 7, row: 6 })
    expect(cells(crypt).filter((c) => c === '5,4')).toHaveLength(1)
  })

  it('keeps every chosen cell for its owner, whatever the order of the moves', () => {
    // Gorak goes to the default spot first; the centre is Lyra's chosen cell.
    const next = teleport(world(), [
      { entityId: 'gorak', toMapId: 'cave' },
      { entityId: 'lyra', toMapId: 'cave', at: { col: 5, row: 4 } },
    ])
    const cave = next.cave!
    expect(cave.tokens.find((t) => t.entityId === 'lyra')).toMatchObject({ col: 5, row: 4 })
    expect(cave.tokens.find((t) => t.entityId === 'gorak')).not.toMatchObject({ col: 5, row: 4 })
  })

  it('a following familiar lands beside its master’s chosen cell, never under a big master', () => {
    const maps = world()
    maps.hall = { ...maps.hall!, tokens: [tk('lyra', 1, 1, { size: 2 }), tk('owl', 3, 1)] }
    const next = teleport(maps, [
      { entityId: 'lyra', toMapId: 'cave', at: { col: 7, row: 2 } },
      { entityId: 'owl', toMapId: 'cave', beside: 'lyra' },
    ])
    const cave = next.cave!
    expect(cave.tokens.find((t) => t.entityId === 'lyra')).toMatchObject({ col: 7, row: 2 })
    const owl = cave.tokens.find((t) => t.entityId === 'owl')!
    const under = owl.col >= 7 && owl.col <= 8 && owl.row >= 2 && owl.row <= 3
    expect(under).toBe(false)
    expect(Math.max(Math.abs(owl.col - 7), Math.abs(owl.row - 2))).toBeLessThanOrEqual(2)
  })

  it('places a character with no token yet; an enemy starts hidden under fog', () => {
    const next = teleport(world(), [
      { entityId: 'newbie', toMapId: 'cave', kind: 'player' },
      { entityId: 'orc', toMapId: 'crypt', kind: 'enemy' },
    ])
    expect(next.cave!.tokens).toMatchObject([{ entityId: 'newbie', size: 1, hidden: false }])
    expect(next.crypt!.tokens.find((t) => t.entityId === 'orc')?.hidden).toBe(true)
  })

  it('teleporting to its own map moves it to the default spot; never onto a passage', () => {
    const maps = world()
    const centre = { col: 5, row: 4 }
    maps.hall = {
      ...maps.hall!,
      elements: [newElement('link', centre, { link: { mapId: 'cave' } })],
    }
    const next = teleport(maps, [{ entityId: 'lyra', toMapId: 'hall' }])
    const lyra = next.hall!.tokens.find((t) => t.entityId === 'lyra')!
    expect(lyra).not.toMatchObject({ col: 1, row: 1 })
    expect(passageAt(next.hall!, lyra)).toBeUndefined()
    expect(next.hall!.tokens).toHaveLength(2)
  })

  it('ignores moves to an unknown map', () => {
    const maps = world()
    expect(teleport(maps, [{ entityId: 'lyra', toMapId: 'nowhere' }])).toEqual(maps)
  })
})
