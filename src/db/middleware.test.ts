import Dexie from 'dexie'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEntity } from '@/domain/entity'
import { defaultRules } from '@/rules'
import { randomBytes } from '@/security/crypto'
import { createCampaignRepository } from './campaigns'
import { CodexDB } from './db'
import { InvalidRecordError } from './middleware'

const names: string[] = []
afterEach(async () => {
  for (const name of names.splice(0)) await Dexie.delete(name)
})

async function encrypted(key = randomBytes(32), onCorrupt = vi.fn()) {
  const name = `codex-enc-${crypto.randomUUID()}`
  names.push(name)
  const db = new CodexDB(name, { key, onCorrupt })
  await db.open()
  return { db, name, key, onCorrupt }
}

/** What an attacker copying the IndexedDB files would see. */
async function raw(name: string, table: string): Promise<Record<string, unknown>[]> {
  const plain = new Dexie(name)
  await plain.open()
  try {
    return await plain.table(table).toArray()
  } finally {
    plain.close()
  }
}

describe('encryption at rest (D-241)', () => {
  it('stores only ids and index fields in clear', async () => {
    const { db, name } = await encrypted()
    const repo = createCampaignRepository(() => db)
    const campaign = await repo.create({ name: 'La Crypte d’Ombreval', description: 'Secrète' })
    const gorak = createEntity('player', campaign.id, defaultRules(), {
      identity: { pseudo: 'Gorak' },
    })
    await db.entities.add(gorak)

    const [storedCampaign] = await raw(name, 'campaigns')
    const [storedEntity] = await raw(name, 'entities')
    expect(Object.keys(storedCampaign!).sort()).toEqual(['$e', '$v', 'id'])
    expect(Object.keys(storedEntity!).sort()).toEqual(['$e', '$v', 'campaignId', 'id'])
    const dump = JSON.stringify(await raw(name, 'campaigns')) + JSON.stringify(storedEntity)
    expect(dump).not.toMatch(/Ombreval|Secrète|Gorak/)

    expect(await repo.get(campaign.id)).toEqual(campaign)
    expect((await db.entities.get(gorak.id))?.identity.pseudo).toBe('Gorak')
    db.close()
  })

  it('keeps every query working: indexes, compound ranges, modify, delete', async () => {
    const { db } = await encrypted()
    const repo = createCampaignRepository(() => db)
    const c = await repo.create({ name: 'A' })
    const other = await repo.create({ name: 'B' })
    await db.entities.bulkAdd([
      createEntity('player', c.id, defaultRules(), { identity: { pseudo: 'Lyra' } }),
      createEntity('enemy', other.id, defaultRules(), { identity: { pseudo: 'Goule' } }),
    ])
    await db.rolls.bulkAdd([3, 1, 2].map((at) => ({ id: `r${at}`, campaignId: c.id, at }) as never))

    expect(
      (await db.entities.where('campaignId').equals(c.id).toArray()).map((e) => e.identity.pseudo),
    ).toEqual(['Lyra'])
    const rolls = await db.rolls
      .where('[campaignId+at]')
      .between([c.id, 0], [c.id, Infinity])
      .toArray()
    expect(rolls.map((r) => r.at)).toEqual([1, 2, 3])

    await repo.update(c.id, { name: 'Renommée' })
    expect((await repo.get(c.id))?.name).toBe('Renommée')
    await db.entities
      .where('campaignId')
      .equals(c.id)
      .modify((e) => {
        e.identity.pseudo = 'Lyra la Grise'
      })
    expect((await db.entities.where('campaignId').equals(c.id).first())?.identity.pseudo).toBe(
      'Lyra la Grise',
    )
    await repo.remove(other.id)
    expect(await db.entities.count()).toBe(1)

    // Exports go through the same layer: they are readable.
    const exported = await repo.exportCampaign(c.id)
    expect(exported.campaign.name).toBe('Renommée')
    db.close()
  })

  it('reads nothing with another key', async () => {
    const { db, name, onCorrupt } = await encrypted()
    const a = await createCampaignRepository(() => db).create({ name: 'A' })
    db.close()

    const reopened = new CodexDB(name, { key: randomBytes(32), onCorrupt })
    await reopened.open()
    expect(await reopened.campaigns.toArray()).toEqual([])
    expect(onCorrupt).toHaveBeenCalledWith('campaigns', a.id)
    reopened.close()
  })

  it('reads a tampered index as missing with the right key', async () => {
    // An attacker moves Lyra to campaign B by editing the clear index field.
    const key = randomBytes(32)
    const { db, name, onCorrupt } = await encrypted(key)
    const repo = createCampaignRepository(() => db)
    const a = await repo.create({ name: 'A' })
    const b = await repo.create({ name: 'B' })
    const lyra = createEntity('player', a.id, defaultRules())
    await db.entities.add(lyra)
    db.close()

    const plain = new Dexie(name)
    await plain.open()
    await plain.table('entities').update(lyra.id, { campaignId: b.id })
    plain.close()

    const reopened = new CodexDB(name, { key, onCorrupt })
    await reopened.open()
    expect(await reopened.entities.where('campaignId').equals(b.id).toArray()).toEqual([])
    expect(await reopened.entities.get(lyra.id)).toBeUndefined()
    expect(onCorrupt).toHaveBeenCalledWith('entities', lyra.id)
    expect(await reopened.campaigns.count()).toBe(2)
    reopened.close()
  })
})

describe('integrity guard (D-242)', () => {
  it('refuses records without id, or without campaign where one is required', async () => {
    const { db } = await encrypted()
    await expect(db.campaigns.add({ name: 'x' } as never)).rejects.toThrow(InvalidRecordError)
    await expect(db.entities.add({ id: 'e1' } as never)).rejects.toThrow(InvalidRecordError)
    await expect(db.maps.put({ id: 'm1', campaignId: 'c1' } as never)).resolves.toBe('m1')
    db.close()
  })
})
