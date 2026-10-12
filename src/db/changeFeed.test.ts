import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { randomBytes } from '@/security/crypto'
import { CodexDB } from './db'
import { markRemote, type DbChange } from './middleware'

const names: string[] = []
afterEach(async () => {
  for (const name of names.splice(0)) await Dexie.delete(name)
})

async function open() {
  const name = `codex-feed-${crypto.randomUUID()}`
  names.push(name)
  const db = new CodexDB(name, { key: randomBytes(32) })
  await db.open()
  const seen: DbChange[] = []
  db.onChanges((changes) => seen.push(...changes))
  return { db, seen }
}

const campaign = (id: string, name = 'C') => ({
  id,
  name,
  description: '',
  createdAt: 1,
  updatedAt: 1,
  lastOpenedAt: null,
  rules: {} as never,
  library: { conditions: [], macros: [] },
})

describe('change feed (D-245)', () => {
  it('reports committed local writes in clear, once per transaction', async () => {
    const { db, seen } = await open()
    await db.campaigns.put(campaign('c1', 'Ombreval'))
    await db.campaigns.delete('c1')
    expect(seen).toEqual([
      {
        table: 'campaigns',
        put: [expect.objectContaining({ name: 'Ombreval' })],
        del: [],
        remote: false,
      },
      { table: 'campaigns', put: [], del: ['c1'], remote: false },
    ])
    db.close()
  })

  it('flags writes received from a peer, and reports range deletes with their keys', async () => {
    const { db, seen } = await open()
    await db.transaction('rw', db.campaigns, async (tx) => {
      markRemote(tx.idbtrans)
      await db.campaigns.bulkPut([campaign('a'), campaign('b')])
    })
    await db.campaigns.clear()
    expect(seen[0]).toMatchObject({ table: 'campaigns', remote: true })
    expect(seen[1]).toEqual({ table: 'campaigns', put: [], del: ['a', 'b'], remote: false })
    db.close()
  })

  it('reports nothing for an aborted transaction', async () => {
    const { db, seen } = await open()
    await expect(
      db.transaction('rw', db.campaigns, async () => {
        await db.campaigns.put(campaign('x'))
        throw new Error('abort')
      }),
    ).rejects.toThrow('abort')
    await new Promise((r) => setTimeout(r, 20))
    expect(seen).toEqual([])
    db.close()
  })
})
