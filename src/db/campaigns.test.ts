import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  CampaignImportError,
  createCampaignRepository,
  parseExport,
  splitImportFile,
} from './campaigns'
import { createEntity } from '@/domain/entity'
import { newItem } from '@/domain/items'
import { newElement, newMap } from '@/domain/maps'
import { newSessionPlan } from '@/domain/sessions'
import { defaultRules } from '@/rules'
import exampleCampaign from '../../exemples/campagne-test-ombreval.json?raw'
import { CodexDB } from './db'

let db: CodexDB
let clock: number
let repo: ReturnType<typeof createCampaignRepository>

beforeEach(async () => {
  db = new CodexDB(`codex-test-${crypto.randomUUID()}`)
  await db.open()
  clock = 1_000
  repo = createCampaignRepository(
    () => db,
    () => clock++,
  )
})

afterEach(async () => {
  await db.delete()
})

describe('campaign repository', () => {
  it('creates a campaign with trimmed fields', async () => {
    const c = await repo.create({ name: '  La Crypte  ', description: ' Une crypte. ' })
    expect(c.name).toBe('La Crypte')
    expect(c.description).toBe('Une crypte.')
    expect(c.lastOpenedAt).toBeNull()
    expect(await repo.get(c.id)).toEqual(c)
  })

  it('refuses an empty name', async () => {
    await expect(repo.create({ name: '   ' })).rejects.toThrow()
  })

  it('lists recently opened campaigns first', async () => {
    const a = await repo.create({ name: 'A' })
    await repo.create({ name: 'B' })
    await repo.create({ name: 'C' })
    await repo.markOpened(a.id)
    const names = (await repo.list()).map((x) => x.name)
    expect(names).toEqual(['A', 'C', 'B'])
  })

  it('renames and bumps updatedAt', async () => {
    const c = await repo.create({ name: 'Old' })
    await repo.update(c.id, { name: 'New' })
    const updated = await repo.get(c.id)
    expect(updated?.name).toBe('New')
    expect(updated!.updatedAt).toBeGreaterThan(c.updatedAt)
  })

  it('deletes a campaign', async () => {
    const c = await repo.create({ name: 'Doomed' })
    await repo.remove(c.id)
    expect(await repo.get(c.id)).toBeUndefined()
  })
})

describe('export / import', () => {
  it('round-trips a campaign: export, delete, import gives the identical campaign', async () => {
    const original = await repo.create({ name: 'Aller-retour', description: 'test' })
    await repo.markOpened(original.id)
    const stored = await repo.get(original.id)

    const file = JSON.stringify(await repo.exportCampaign(original.id))
    await repo.remove(original.id)
    const { campaign, renamed } = await repo.importCampaign(file)

    expect(renamed).toBe(false)
    expect(campaign).toEqual(stored)
    expect(await repo.get(original.id)).toEqual(stored)
  })

  it('imports as a copy when the id already exists', async () => {
    const original = await repo.create({ name: 'Doublon' })
    const exported = await repo.exportCampaign(original.id)
    const { campaign, renamed } = await repo.importCampaign(exported, '(copie)')
    expect(renamed).toBe(true)
    expect(campaign.id).not.toBe(original.id)
    expect(campaign.name).toBe('Doublon (copie)')
    expect(await repo.list()).toHaveLength(2)
  })

  it.each([
    ['not json', 'invalidJson'],
    ['{"hello":1}', 'wrongFormat'],
    ['[]', 'wrongFormat'],
    ['{"format":"codex-campaign","version":99,"campaign":{}}', 'unsupportedVersion'],
    ['{"format":"codex-campaign","version":1,"campaign":{"id":"x"}}', 'invalidCampaign'],
  ])('rejects %s with %s', (input, code) => {
    try {
      parseExport(input)
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(CampaignImportError)
      expect((e as CampaignImportError).code).toBe(code)
    }
  })
})

describe('personal data (GDPR, D-240)', () => {
  it('archives every campaign with its content, and the archive imports back', async () => {
    const a = await repo.create({ name: 'Première' })
    const b = await repo.create({ name: 'Seconde' })
    await db.entities.add(createEntity('player', b.id, defaultRules()))

    const archive = await repo.exportAll()
    expect(archive.format).toBe('codex-archive')
    expect(archive.campaigns.map((c) => c.campaign.name)).toEqual(['Première', 'Seconde'])
    expect(archive.campaigns[1]!.entities).toHaveLength(1)

    await repo.eraseAll()
    const parts = splitImportFile(JSON.stringify(archive))
    for (const part of parts) await repo.importCampaign(part)
    expect((await repo.list()).map((c) => c.id).sort()).toEqual([a.id, b.id].sort())
    expect(await db.entities.count()).toBe(1)
  })

  it('a single campaign file splits into itself', () => {
    expect(splitImportFile('{"format":"codex-campaign"}')).toEqual([{ format: 'codex-campaign' }])
  })

  it.each([
    ['{"format":"codex-archive","version":9,"campaigns":[]}', 'unsupportedVersion'],
    ['{"format":"codex-archive","version":1}', 'wrongFormat'],
    ['nope', 'invalidJson'],
  ])('rejects archive %s with %s', (input, code) => {
    expect(() => splitImportFile(input)).toThrow(
      expect.objectContaining({ code }) as unknown as Error,
    )
  })

  it('erases everything, in every table', async () => {
    const c = await repo.create({ name: 'Effacée' })
    await db.entities.add(createEntity('player', c.id, defaultRules()))
    await repo.eraseAll()
    for (const table of db.tables) expect(await table.count()).toBe(0)
  })
})

describe('schema', () => {
  it('opens at the current version with the expected tables', async () => {
    expect(db.verno).toBe(11)
    expect(db.tables.map((t) => t.name).sort()).toEqual([
      'activity',
      'assets',
      'backups',
      'bestiary',
      'campaigns',
      'entities',
      'itemLibrary',
      'maps',
      'outbox',
      'rolls',
      'sessionRuns',
      'sessions',
      'skills',
      'syncState',
    ])
  })
})

describe('campaign content', () => {
  const rules = defaultRules()

  it('creates campaigns with the default house rules', async () => {
    const c = await repo.create({ name: 'Règles' })
    expect(c.rules).toEqual(rules)
    const changed = { ...rules, grid: { ...rules.grid, cellMeters: 1.5 } }
    await repo.updateRules(c.id, changed)
    expect((await repo.get(c.id))?.rules.grid.cellMeters).toBe(1.5)
  })

  it('deleting a campaign deletes its characters, not the others', async () => {
    const a = await repo.create({ name: 'A' })
    const b = await repo.create({ name: 'B' })
    await db.entities.bulkAdd([
      createEntity('player', a.id, rules),
      createEntity('player', b.id, rules),
    ])
    await repo.remove(a.id)
    expect(await db.entities.where('campaignId').equals(a.id).count()).toBe(0)
    expect(await db.entities.where('campaignId').equals(b.id).count()).toBe(1)
  })

  it('round-trips characters: export, delete, import gives identical data', async () => {
    const c = await repo.create({ name: 'Avec persos' })
    const owner = createEntity('player', c.id, rules, { identity: { pseudo: 'Lyra' }, now: 1 })
    const pet = createEntity('familiar', c.id, rules, { identity: { pseudo: 'Plume' }, now: 2 })
    pet.details.ownerId = owner.id
    await db.entities.bulkAdd([owner, pet])
    const before = await db.entities.where('campaignId').equals(c.id).toArray()

    const file = JSON.stringify(await repo.exportCampaign(c.id))
    await repo.remove(c.id)
    await repo.importCampaign(file)

    const after = await db.entities.where('campaignId').equals(c.id).toArray()
    expect(after.sort((x, y) => x.createdAt - y.createdAt)).toEqual(
      before.sort((x, y) => x.createdAt - y.createdAt),
    )
  })

  it('a copy gets fresh character ids and keeps familiar owners linked', async () => {
    const c = await repo.create({ name: 'Copie' })
    const owner = createEntity('player', c.id, rules, { now: 1 })
    const pet = createEntity('familiar', c.id, rules, { now: 2 })
    pet.details.ownerId = owner.id
    await db.entities.bulkAdd([owner, pet])

    const { campaign } = await repo.importCampaign(await repo.exportCampaign(c.id))
    const copies = await db.entities.where('campaignId').equals(campaign.id).toArray()
    const newOwner = copies.find((e) => e.kind === 'player')!
    const newPet = copies.find((e) => e.kind === 'familiar')!
    expect(newOwner.id).not.toBe(owner.id)
    expect(newPet.kind === 'familiar' && newPet.details.ownerId).toBe(newOwner.id)
    expect(await db.entities.count()).toBe(4)
  })

  it('imports phase-0 (v1) files: default rules, no characters', async () => {
    const v1 = {
      format: 'codex-campaign',
      version: 1,
      exportedAt: '2026-10-11T00:00:00.000Z',
      campaign: {
        id: 'old',
        name: 'Ancienne',
        description: '',
        createdAt: 1,
        updatedAt: 1,
        lastOpenedAt: null,
      },
    }
    const { campaign } = await repo.importCampaign(JSON.stringify(v1))
    expect(campaign.rules).toEqual(rules)
  })

  it('fills missing fields of imported characters', () => {
    const file = {
      format: 'codex-campaign',
      version: 2,
      campaign: {
        id: 'x',
        name: 'X',
        description: '',
        createdAt: 1,
        updatedAt: 1,
        lastOpenedAt: null,
      },
      entities: [{ id: 'e1', kind: 'ally', identity: { pseudo: 'Bran' } }],
    }
    const [entity] = parseExport(file).entities
    expect(entity).toMatchObject({
      id: 'e1',
      campaignId: 'x',
      kind: 'ally',
      identity: { pseudo: 'Bran', className: '' },
    })
    expect(entity?.details).toEqual({ disposition: 'neutral', controlledBy: '' })
  })

  it('rejects entities that are not characters', () => {
    const file = {
      format: 'codex-campaign',
      version: 2,
      campaign: {
        id: 'x',
        name: 'X',
        description: '',
        createdAt: 1,
        updatedAt: 1,
        lastOpenedAt: null,
      },
      entities: [{ id: 'e1', kind: 'dragon' }],
    }
    expect(() => parseExport(file)).toThrow(CampaignImportError)
  })
})

describe('everything belongs to its campaign (D-224)', () => {
  it('export carries the bestiary and item library; a copy gets its own', async () => {
    const rules = defaultRules()
    const c = await repo.create({ name: 'Avec bestiaire' })
    const goblin = createEntity('enemy', c.id, rules, { identity: { pseudo: 'Gobelin' } })
    await db.bestiary.add(goblin)
    await db.itemLibrary.add({ ...newItem({ name: 'Potion' }), campaignId: c.id })
    const enemy = createEntity('enemy', c.id, rules)
    enemy.details.templateId = goblin.id
    await db.entities.add(enemy)

    const file = await repo.exportCampaign(c.id)
    expect(file.bestiary.map((t) => t.identity.pseudo)).toEqual(['Gobelin'])
    expect(file.items.map((i) => i.name)).toEqual(['Potion'])

    const { campaign } = await repo.importCampaign(file)
    const copies = await db.bestiary.where('campaignId').equals(campaign.id).toArray()
    expect(copies).toHaveLength(1)
    expect(copies[0]!.id).not.toBe(goblin.id)
    const [copiedEnemy] = await db.entities.where('campaignId').equals(campaign.id).toArray()
    expect(copiedEnemy?.kind === 'enemy' && copiedEnemy.details.templateId).toBe(copies[0]!.id)

    await repo.remove(c.id)
    expect(await db.bestiary.where('campaignId').equals(c.id).count()).toBe(0)
    expect(await db.itemLibrary.where('campaignId').equals(c.id).count()).toBe(0)
    expect(await db.bestiary.where('campaignId').equals(campaign.id).count()).toBe(1)
  })

  it('export carries maps and their images; a copy relinks tokens, links and the map in play', async () => {
    const rules = defaultRules()
    const c = await repo.create({ name: 'Avec cartes' })
    const hero = createEntity('player', c.id, rules, { identity: { pseudo: 'Lyra' } })
    await db.entities.add(hero)
    await db.assets.add({
      id: 'img',
      campaignId: c.id,
      data: 'data:image/png;base64,AA==',
      name: 'fond.png',
    })
    const cellar = newMap(c.id, { name: 'Cave' })
    const hall = newMap(c.id, { name: 'Salle' })
    hall.background.assetId = 'img'
    hall.tokens.push({ id: 'tk', entityId: hero.id, col: 1, row: 1, size: 1, hidden: false })
    hall.elements.push(newElement('link', { col: 2, row: 2 }, { link: { mapId: cellar.id } }))
    await db.maps.bulkAdd([cellar, hall])
    await db.campaigns.update(c.id, {
      play: {
        groups: [],
        turn: { status: 'stopped' },
        mapId: hall.id,
        display: { mode: 'map', imageAssetId: null, gallery: [] },
        live: null,
      },
    })

    const file = await repo.exportCampaign(c.id)
    expect(file.maps.map((m) => m.name).sort()).toEqual(['Cave', 'Salle'])
    expect(file.assets.map((a) => a.id)).toEqual(['img'])

    const { campaign } = await repo.importCampaign(file)
    const maps = await db.maps.where('campaignId').equals(campaign.id).toArray()
    const [hero2] = await db.entities.where('campaignId').equals(campaign.id).toArray()
    const [asset2] = await db.assets.where('campaignId').equals(campaign.id).toArray()
    const hall2 = maps.find((m) => m.name === 'Salle')!
    const cellar2 = maps.find((m) => m.name === 'Cave')!
    expect(hall2.id).not.toBe(hall.id)
    expect(hall2.tokens[0]!.entityId).toBe(hero2!.id)
    expect(hall2.background.assetId).toBe(asset2!.id)
    expect(asset2!.id).not.toBe('img')
    expect(hall2.elements[0]!.link!.mapId).toBe(cellar2.id)
    expect(campaign.play?.mapId).toBe(hall2.id)

    await repo.remove(c.id)
    expect(await db.maps.where('campaignId').equals(c.id).count()).toBe(0)
    expect(await db.assets.where('campaignId').equals(c.id).count()).toBe(0)
    expect(await db.maps.where('campaignId').equals(campaign.id).count()).toBe(2)
  })
})

describe('sessions travel with their campaign (D-244)', () => {
  it('a copy keeps plans pointing at its own map and templates, runs at their plan, no live game', async () => {
    const c = await repo.create({ name: 'Avec sessions' })
    const template = createEntity('enemy', c.id, defaultRules())
    await db.bestiary.add(template)
    const map = newMap(c.id, { name: 'Crypte' })
    await db.maps.add(map)
    const plan = {
      ...newSessionPlan(c.id, 'La crypte'),
      mapIds: [map.id],
      encounters: [{ id: 'e1', templateId: template.id, count: 2 }],
    }
    await db.sessions.add(plan)
    await db.sessionRuns.add({
      id: 'run1',
      campaignId: c.id,
      planId: plan.id,
      title: 'La crypte',
      mode: 'local',
      startedAt: 1,
      endedAt: 2,
      operators: ['MJ'],
      participants: ['MJ'],
      objectivesDone: [],
      notes: '',
    })
    await db.campaigns.update(c.id, {
      play: {
        groups: [],
        turn: { status: 'stopped' },
        mapId: null,
        display: { mode: 'map', imageAssetId: null, gallery: [] },
        live: {
          runId: 'run1',
          planId: plan.id,
          mode: 'local',
          startedAt: 1,
          operator: { id: 'host', name: 'MJ' },
          title: 'Test',
          listed: false,
        },
      },
    })

    const { campaign: copy } = await repo.importCampaign(await repo.exportCampaign(c.id))
    const [copiedPlan] = await db.sessions.where('campaignId').equals(copy.id).toArray()
    const [copiedMap] = await db.maps.where('campaignId').equals(copy.id).toArray()
    const [copiedTemplate] = await db.bestiary.where('campaignId').equals(copy.id).toArray()
    const [copiedRun] = await db.sessionRuns.where('campaignId').equals(copy.id).toArray()
    expect(copiedPlan!.id).not.toBe(plan.id)
    expect(copiedPlan!.mapIds).toEqual([copiedMap!.id])
    expect(copiedPlan!.encounters[0]!.templateId).toBe(copiedTemplate!.id)
    expect(copiedRun!.planId).toBe(copiedPlan!.id)
    expect((await db.campaigns.get(copy.id))?.play?.live).toBeNull()

    await repo.remove(c.id)
    expect(await db.sessions.where('campaignId').equals(c.id).count()).toBe(0)
    expect(await db.sessionRuns.where('campaignId').equals(c.id).count()).toBe(0)
  })
})

describe('the example campaign (D-258, D-259)', () => {
  it('imports two maps linked both ways, the fresco pictures and the session route', async () => {
    const { campaign } = await repo.importCampaign(exampleCampaign)
    const maps = await db.maps.where('campaignId').equals(campaign.id).toArray()
    const crypt = maps.find((m) => m.name === 'Crypte d’Ombreval')!
    const ossuary = maps.find((m) => m.name === 'Ossuaire d’Ombreval')!
    expect(crypt.elements.filter((e) => e.link?.mapId === ossuary.id)).toHaveLength(1)
    expect(ossuary.elements.filter((e) => e.link?.mapId === crypt.id)).toHaveLength(1)

    const fresco = crypt.elements.find((e) => e.kind === 'image')!
    expect(fresco.layer).toBe('gm')
    const assets = await db.assets.where('campaignId').equals(campaign.id).toArray()
    expect(fresco.gallery!.assetIds).toHaveLength(2)
    for (const id of fresco.gallery!.assetIds) expect(assets.map((a) => a.id)).toContain(id)

    const [plan] = await db.sessions.where('campaignId').equals(campaign.id).toArray()
    expect(plan!.mapIds).toEqual([crypt.id, ossuary.id])
  })
})
