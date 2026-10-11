import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CampaignImportError, createCampaignRepository, parseExport } from './campaigns'
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
    expect(db.verno).toBe(1)
    expect(db.tables.map((t) => t.name).sort()).toEqual(['campaigns'])
  })
})
