import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { BUILD_PORT } from '../playwright.config'
import { expectNoSeriousA11yViolations } from './support/a11y'

/**
 * Administration dashboard (D-275) against the real server: sign-in, the
 * overview, a report handled from the dashboard (suspension), the audit log;
 * the production build under its Content Security Policy, without sideways
 * scrolling at phone width. Admin set in playwright.config.ts (test only).
 */

const E2E_ADMIN = 'admin-e2e'
const E2E_ADMIN_PASSWORD = 'mot de passe e2e admin codex'
const BUILD = `http://localhost:${BUILD_PORT}`
const run = Date.now().toString(36)

async function register(request: APIRequestContext, name: string) {
  const response = await request.post('/api/auth/register', {
    data: {
      email: `${name.toLowerCase()}-${run}@exemple.fr`,
      displayName: name,
      password: 'une phrase de passe assez longue',
    },
  })
  expect(response.ok()).toBe(true)
  return ((await response.json()) as { user: { id: string } }).user.id
}

async function signIn(page: Page) {
  await page.getByLabel('Identifiant').fill(E2E_ADMIN)
  await page.getByLabel('Mot de passe').fill(E2E_ADMIN_PASSWORD)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByRole('heading', { name: 'Vue d’ensemble' })).toBeVisible()
}

test('the admin signs in, handles a report and finds it in the audit log', async ({
  page,
  playwright,
  baseURL,
}) => {
  // Two accounts: one reports the other's profile.
  const target = `Cible${run}`
  const reporterCtx = await playwright.request.newContext({ baseURL })
  const targetCtx = await playwright.request.newContext({ baseURL })
  await register(reporterCtx, `Témoin${run}`)
  const targetId = await register(targetCtx, target)
  const report = await reporterCtx.post('/api/reports', {
    data: {
      targetType: 'profile',
      targetId,
      category: 'harassment',
      explanation: 'Sa devise insulte les autres joueurs.',
      goodFaith: true,
    },
  })
  expect(report.ok()).toBe(true)

  const response = await page.goto('/admin')
  expect(response?.headers()['x-robots-tag']).toContain('noindex')
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)

  await page.getByLabel('Identifiant').fill(E2E_ADMIN)
  await page.getByLabel('Mot de passe').fill('pas le bon mot de passe')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByRole('alert')).toHaveText('Identifiant ou mot de passe incorrect.')
  await signIn(page)
  await expect(page.getByText('Inscriptions par jour (30 jours)')).toBeVisible()
  await expectNoSeriousA11yViolations(page)

  await page.getByRole('button', { name: 'Signalements', exact: true }).click()
  const card = page.getByRole('article').filter({ hasText: target })
  await expect(card).toBeVisible()
  await card.getByRole('button', { name: 'Suspendre le compte' }).click()
  await card.getByLabel(/Faits et motifs/).fill('Insultes répétées dans la devise.')
  await card.getByRole('button', { name: 'Suspendre le compte' }).last().click()
  await expect(page.getByRole('status').filter({ hasText: 'Compte suspendu.' })).toBeVisible()
  // The suspended account is signed out.
  expect((await targetCtx.get('/api/auth/me')).status()).toBe(401)

  await page.getByRole('button', { name: 'Comptes', exact: true }).click()
  await page.getByLabel(/Rechercher un compte/).fill(target)
  await page.getByRole('button', { name: 'Rechercher' }).click()
  await page.getByRole('button', { name: new RegExp(target) }).click()
  await expect(page.getByRole('button', { name: 'Réactiver le compte' })).toBeVisible()
  await expectNoSeriousA11yViolations(page)

  await page.getByRole('button', { name: 'Journal', exact: true }).click()
  await expect(
    page.getByRole('listitem').filter({ hasText: 'Compte suspendu' }).filter({ hasText: target }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Se déconnecter' }).click()
  await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible()
  await reporterCtx.dispose()
  await targetCtx.dispose()
})

test('the built dashboard works under its CSP and never scrolls sideways', async ({ page }) => {
  const violations: string[] = []
  page.on(
    'console',
    (m) =>
      m.type() === 'error' &&
      /Content Security Policy/i.test(m.text()) &&
      violations.push(m.text()),
  )
  page.on('pageerror', (e) => violations.push(e.message))
  await page.setViewportSize({ width: 390, height: 800 })
  await page.goto(`${BUILD}/admin`)
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute(
    'content',
    /connect-src 'self'/,
  )
  await signIn(page)
  for (const section of ['Signalements', 'Comptes', 'Campagnes', 'Journal']) {
    await page.getByRole('button', { name: section, exact: true }).click()
    await expect(page.getByRole('heading', { name: section, level: 2 })).toBeVisible()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    ).toBe(false)
  }
  expect(violations).toEqual([])
})
