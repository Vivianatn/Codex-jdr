import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createCampaignRepository } from '@/db/campaigns'
import { accountDbName, CodexDB } from '@/db/db'
import {
  AccountError,
  createAccountService,
  FREE_ATTEMPTS,
  legacyCampaignCount,
  migrateLegacyData,
  type AccountService,
} from './accounts'

const PASSWORD = 'lanterne verte sous le pont de grès'
const OTHER = 'trois corbeaux sur la tour nord'

let service: AccountService
let clock: number
const cleanup: string[] = []

beforeEach(() => {
  clock = 1_000_000
  const name = `codex-accounts-${crypto.randomUUID()}`
  cleanup.push(name)
  service = createAccountService({ name, iterations: 1000, now: () => clock })
})

afterEach(async () => {
  for (const account of await service.list()) cleanup.push(accountDbName(account.id))
  service.registry.close()
  for (const name of cleanup.splice(0)) await Dexie.delete(name)
})

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toSatisfy((e) => e instanceof AccountError && e.code === code)
}

describe('accounts (D-241)', () => {
  it('creates an account whose password unlocks the same data key', async () => {
    const created = await service.create({ username: '  Agathe  ', password: PASSWORD })
    expect(created.account.username).toBe('Agathe')
    expect(created.recoveryCode).toMatch(/^(\w{4}-){7}\w{4}$/)
    const { key } = await service.unlock(created.account.id, PASSWORD)
    expect(key).toEqual(created.key)
  })

  it('never stores the password or the data key in clear', async () => {
    const { account, key, recoveryCode } = await service.create({
      username: 'Agathe',
      password: PASSWORD,
    })
    const stored = JSON.stringify(await service.registry.accounts.get(account.id))
    expect(stored).not.toContain(PASSWORD)
    expect(stored).not.toContain(recoveryCode)
    expect(stored).not.toContain(btoa(String.fromCharCode(...key)))
  })

  it('refuses weak passwords and duplicate names (case and accents ignored)', async () => {
    await expectCode(service.create({ username: 'A', password: 'court' }), 'passwordTooShort')
    await expectCode(
      service.create({ username: 'A', password: 'azertyuiop123456789' }),
      'passwordTooSimple',
    )
    await service.create({ username: 'Élodie', password: PASSWORD })
    await expectCode(service.create({ username: 'elodie', password: PASSWORD }), 'usernameTaken')
  })

  it('slows down guessing: after the free attempts, each failure doubles the wait', async () => {
    const { account } = await service.create({ username: 'Agathe', password: PASSWORD })
    for (let i = 0; i < FREE_ATTEMPTS - 1; i++)
      await expectCode(service.unlock(account.id, 'mauvais mot de passe !!'), 'wrongPassword')
    await expect(service.unlock(account.id, 'mauvais mot de passe !!')).rejects.toMatchObject({
      code: 'wrongPassword',
      retryAt: clock + 30_000,
    })
    // Even the right password waits.
    await expectCode(service.unlock(account.id, PASSWORD), 'throttled')
    clock += 30_000
    await expect(service.unlock(account.id, 'encore raté encore raté')).rejects.toMatchObject({
      retryAt: clock + 60_000,
    })
    clock += 60_000
    await expect(service.unlock(account.id, PASSWORD)).resolves.toBeTruthy()
    // Success resets the counter.
    await expectCode(service.unlock(account.id, 'mauvais mot de passe !!'), 'wrongPassword')
    await expect(service.unlock(account.id, PASSWORD)).resolves.toBeTruthy()
  })

  it('recovers with the code, which is then replaced', async () => {
    const created = await service.create({ username: 'Agathe', password: PASSWORD })
    await expectCode(
      service.recover(created.account.id, 'AAAA-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA', OTHER),
      'wrongRecoveryCode',
    )
    const recovered = await service.recover(
      created.account.id,
      created.recoveryCode.toLowerCase(),
      OTHER,
    )
    expect(recovered.key).toEqual(created.key)
    expect(recovered.recoveryCode).not.toBe(created.recoveryCode)
    await expectCode(service.unlock(created.account.id, PASSWORD), 'wrongPassword')
    await expect(service.unlock(created.account.id, OTHER)).resolves.toBeTruthy()
    await expectCode(
      service.recover(created.account.id, created.recoveryCode, PASSWORD),
      'wrongRecoveryCode',
    )
  })

  it('changes the password and renews the code only with the current password', async () => {
    const { account, recoveryCode } = await service.create({
      username: 'Agathe',
      password: PASSWORD,
    })
    await expectCode(service.changePassword(account.id, OTHER, OTHER), 'wrongPassword')
    await service.changePassword(account.id, PASSWORD, OTHER)
    await expect(service.unlock(account.id, OTHER)).resolves.toBeTruthy()

    await expectCode(service.renewRecoveryCode(account.id, PASSWORD), 'wrongPassword')
    const code = await service.renewRecoveryCode(account.id, OTHER)
    await expectCode(service.recover(account.id, recoveryCode, PASSWORD), 'wrongRecoveryCode')
    await expect(service.recover(account.id, code, PASSWORD)).resolves.toBeTruthy()
  })

  it('deletes the account and its database', async () => {
    const { account, key } = await service.create({ username: 'Agathe', password: PASSWORD })
    const db = new CodexDB(accountDbName(account.id), { key })
    await createCampaignRepository(() => db).create({ name: 'À effacer' })
    db.close()
    await expectCode(service.remove(account.id, OTHER), 'wrongPassword')
    await service.remove(account.id, PASSWORD)
    expect(await service.list()).toEqual([])
    expect(await Dexie.exists(accountDbName(account.id))).toBe(false)
  })
})

describe('data saved before accounts', () => {
  it('moves into the first account, encrypted, then disappears', async () => {
    const legacyName = `codex-legacy-${crypto.randomUUID()}`
    cleanup.push(legacyName)
    const legacy = new CodexDB(legacyName)
    await createCampaignRepository(() => legacy).create({ name: 'Ancienne campagne' })
    legacy.close()
    expect(await legacyCampaignCount(legacyName)).toBe(1)

    const { account, key } = await service.create({ username: 'Agathe', password: PASSWORD })
    const target = new CodexDB(accountDbName(account.id), { key })
    expect(await migrateLegacyData(target, legacyName)).toBe(1)
    expect((await target.campaigns.toArray()).map((c) => c.name)).toEqual(['Ancienne campagne'])
    target.close()
    expect(await Dexie.exists(legacyName)).toBe(false)
    expect(await legacyCampaignCount(legacyName)).toBe(0)
  })
})
