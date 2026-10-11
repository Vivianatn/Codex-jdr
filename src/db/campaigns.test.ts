import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CampaignImportError, createCampaignRepository, parseExport } from './campaigns'
import { createEntity } from '@/domain/entity'
import { defaultRules } from '@/rules'
import { CodexDB } from './db'

let db: CodexDB
let clock: number
let repo: ReturnType<typeof createCampaignRepository>

beforeEach(async () => {
  db = new CodexDB(`codex-test-${crypto.randomUUID()}`)
  await db.open()
  clock = 1_000
  repo = createCampaignRepository(db, () => clock++)
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

describe('schema', () => {
  it('opens at the current version with the expected tables', async () => {
    expect(db.verno).toBe(4)
    expect(db.tables.map((t) => t.name).sort()).toEqual([
      'bestiary',
      'campaigns',
      'entities',
      'itemLibrary',
      'rolls',
    ])
  })
})

describe('campaign content', () => {
  const rules = defaultRules()

  it('creates campaigns with the default house rules', async () => {
    const c = await repo.create({ name: 'Règles' })
    expect(c.rules).toEqual(rules)
    const changed = { ...rules, grid: { cellMeters: 1.5 } }
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
