import { expect, test, type Page } from '@playwright/test'
import { disableAppAnimations } from './support/a11y'
import { createAccount, createCampaign, E2E_PASSWORD, importCharacter, unlock } from './support/app'

/** Production build served with its Content Security Policy (playwright.config.ts). */
const BUILD_URL = 'http://localhost:4174'

/** Every byte the browser keeps for Codex, read without any key. */
function rawStorage(page: Page) {
  return page.evaluate(async () => {
    const out: string[] = []
    for (const { name } of await indexedDB.databases()) {
      if (!name) continue
      const idb = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(name)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
      for (const store of Array.from(idb.objectStoreNames)) {
        const rows = await new Promise<unknown[]>((resolve) => {
          const get = idb.transaction(store).objectStore(store).getAll()
          get.onsuccess = () => resolve(get.result)
        })
        // Binary fields are decoded as text too, so nothing hides in them.
        out.push(
          JSON.stringify(rows, (_, v: unknown) =>
            v instanceof Uint8Array ? new TextDecoder().decode(v) : v,
          ),
        )
      }
      idb.close()
    }
    out.push(JSON.stringify({ ...localStorage }))
    return out.join('\n')
  })
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await disableAppAnimations(page)
})

test('nothing readable is left on disk: campaign, characters, password', async ({ page }) => {
  await page.goto('/')
  await createAccount(page, 'Agathe')
  await createCampaign(page, 'Ombreval Secrète')
  await importCharacter(page, 'Joueurs', { name: 'Gorakdusoir', hp: 31 })
  await page.waitForTimeout(500) // autosave

  const disk = await rawStorage(page)
  expect(disk).toContain('Agathe') // the account name, needed to log in
  for (const secret of ['Ombreval', 'Gorakdusoir', E2E_PASSWORD]) expect(disk).not.toContain(secret)
})

test('the players’ window opens only through an unlocked GM window, and locks with it', async ({
  page,
  context,
}) => {
  await page.goto('/')
  await createAccount(page)
  await createCampaign(page, 'Ombreval')
  const campaignId = page.url().match(/#\/c\/([^/]+)/)![1]!

  const players = await context.newPage()
  await players.goto(`/#/c/${campaignId}/view`)
  await expect(players.getByTestId('players-waiting')).toBeHidden()

  await page.getByRole('button', { name: 'Verrouiller' }).click()
  await expect(page.getByTestId('lock-screen')).toBeVisible()
  await expect(players.getByTestId('players-waiting')).toBeVisible()
  // No password field on the projector.
  await expect(players.getByLabel(/Mot de passe/)).toHaveCount(0)

  await unlock(page)
  await expect(players.getByTestId('players-waiting')).toBeHidden()
})

test('the built app runs under its Content Security Policy without a single violation', async ({
  page,
  context,
}) => {
  test.setTimeout(120_000)
  await context.addInitScript(() => {
    const violations: string[] = []
    ;(window as unknown as { __csp: string[] }).__csp = violations
    document.addEventListener('securitypolicyviolation', (e) =>
      violations.push(`${e.violatedDirective} ${e.blockedURI}`),
    )
  })
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  await page.goto(BUILD_URL)
  const csp = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute('content')
  expect(csp).toContain("connect-src 'none'")
  expect(csp).not.toContain('unsafe-eval')

  await createAccount(page)
  await createCampaign(page, 'Sous CSP')
  await importCharacter(page, 'Joueurs', { name: 'Lyra', hp: 22 })
  await page.getByRole('link', { name: 'Cartes', exact: true }).click()
  await page.getByRole('button', { name: 'Nouvelle carte' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nouvelle carte' })
  await dialog.getByLabel('Nom').fill('Crypte')
  await dialog.getByRole('button', { name: 'Nouvelle carte' }).click()
  await expect(page.getByTestId('map-canvas')).toBeVisible()
  await page.getByRole('button', { name: 'Ouvrir les paramètres' }).click()
  await expect(page.getByTestId('account-section')).toBeVisible()
  await page.keyboard.press('Escape')

  // The online mode (WebRTC, D-245) still works under the policy: a loopback data channel.
  const echoed = await page.evaluate(async () => {
    const a = new RTCPeerConnection()
    const b = new RTCPeerConnection()
    a.onicecandidate = (e) => e.candidate && b.addIceCandidate(e.candidate)
    b.onicecandidate = (e) => e.candidate && a.addIceCandidate(e.candidate)
    const channel = a.createDataChannel('codex')
    const received = new Promise<string>((resolve) => {
      b.ondatachannel = (e) => (e.channel.onmessage = (m) => resolve(String(m.data)))
    })
    await a.setLocalDescription(await a.createOffer())
    await b.setRemoteDescription(a.localDescription!)
    await b.setLocalDescription(await b.createAnswer())
    await a.setRemoteDescription(b.localDescription!)
    await new Promise<void>((resolve) => (channel.onopen = () => resolve()))
    channel.send('bonjour')
    const text = await received
    a.close()
    b.close()
    return text
  })
  expect(echoed).toBe('bonjour')

  // A fetch to anywhere is refused by the policy itself.
  const fetched = await page.evaluate(() =>
    fetch('https://example.com/').then(
      () => 'sent',
      () => 'blocked',
    ),
  )
  expect(fetched).toBe('blocked')
  const violations = await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)
  expect(violations).toEqual(['connect-src https://example.com/'])
  expect(errors.filter((e) => !e.includes('example.com'))).toEqual([])
})
