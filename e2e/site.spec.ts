import { expect, test, type Page } from '@playwright/test'
import { BUILD_PORT } from '../playwright.config'
import { expectNoSeriousA11yViolations } from './support/a11y'

/**
 * The public website on the production build (D-248): the launch checklist
 * points a browser must check — contrast (13), responsive (14), forms (17) —
 * plus the audience notice (5), the 404 (15), links (16) and the single call to
 * action (20). scripts/launch-check.ts checks the rest on the files.
 */

const BUILD = `http://localhost:${BUILD_PORT}`
const PAGES = [
  '/',
  '/confidentialite',
  '/cgu',
  '/mentions-legales',
  '/accessibilite',
  '/contact',
  '/une-page-qui-nexiste-pas',
]
/** The real pages (not the 404). */
const REAL_PAGES = PAGES.slice(0, -1)
const WIDTHS = [320, 390, 768, 1024, 1440]

function scrollsSideways(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
}

for (const scheme of ['light', 'dark'] as const) {
  test(`pages are readable in ${scheme} theme (contrast, point 13)`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme })
    for (const path of PAGES) {
      await page.goto(`${BUILD}${path}`)
      await expect(page.locator('html')).toHaveAttribute('data-theme', scheme)
      await expectNoSeriousA11yViolations(page)
    }
  })
}

test('no page scrolls sideways, from phones to large screens (point 14)', async ({ page }) => {
  const problems: string[] = []
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 800 })
    for (const path of PAGES) {
      await page.goto(`${BUILD}${path}`)
      if (await scrollsSideways(page)) problems.push(`${path} à ${width} px`)
    }
  }
  expect(problems).toEqual([])
})

test('the landing page has one call to action, and it opens the app (point 20)', async ({
  page,
}) => {
  await page.goto(`${BUILD}/`)
  const cta = page.locator('.cta')
  await expect(cta).toHaveCount(1)
  await cta.click()
  await expect(page).toHaveURL(`${BUILD}/app/`)
  await expect(page.getByRole('heading', { name: 'Bienvenue dans Codex' })).toBeVisible()
})

test('unknown addresses get the custom 404 page with a 404 status (point 15)', async ({ page }) => {
  const response = await page.goto(`${BUILD}/grimoire/perdu`)
  expect(response?.status()).toBe(404)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('brouillard')
  await page.getByRole('link', { name: 'Retour à l’accueil' }).click()
  await expect(page).toHaveURL(`${BUILD}/`)
})

test('every internal link and resource answers (point 16)', async ({ page, request }) => {
  const seen = new Set<string>()
  const broken: string[] = []
  for (const path of REAL_PAGES) {
    await page.goto(`${BUILD}${path}`)
    const refs = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('[href], [src]')]
        .map((el) => el.getAttribute('href') ?? el.getAttribute('src') ?? '')
        .filter((ref) => ref.startsWith('/') && !ref.startsWith('//')),
    )
    for (const ref of refs) {
      const url = ref.split('#')[0]!
      if (seen.has(url)) continue
      seen.add(url)
      const response = await request.get(`${BUILD}${url}`)
      if (response.status() !== 200) broken.push(`${path} → ${ref} (${response.status()})`)
    }
  }
  expect(broken).toEqual([])
})

test('the audience notice can be reopened and refused from any page (point 5)', async ({
  page,
}) => {
  await page.goto(`${BUILD}/cgu`)
  await page.getByRole('button', { name: 'Mesure d’audience' }).click()
  const notice = page.getByRole('region', { name: 'Mesure d’audience' })
  await expect(notice).toBeVisible()
  await expect(notice.getByRole('button', { name: 'Refuser' })).toBeFocused()
  await notice.getByRole('button', { name: 'Refuser' }).click()
  await expect(notice).toBeHidden()
  expect(await page.evaluate(() => localStorage.getItem('codex.analytics'))).toBe('refused')
  await page.getByRole('button', { name: 'Mesure d’audience' }).click()
  await expect(page.getByText('Ton choix actuel : refusé.')).toBeVisible()
})

test('forms refuse invalid input and say why (point 17)', async ({ page }) => {
  await page.goto(`${BUILD}/app/`)
  await expect(page.getByRole('heading', { name: 'Bienvenue dans Codex' })).toBeVisible()
  await page.getByRole('button', { name: 'Créer un compte', exact: true }).click()
  await page.getByLabel(/Adresse e-mail/).fill('mj@exemple.fr')
  await page.getByLabel(/Nom affiché/).fill('MJ')
  await page.getByLabel(/^Mot de passe/).fill('court')
  await page.getByLabel('Confirme le mot de passe').fill('autre chose')
  await page.getByRole('button', { name: 'Créer mon compte en ligne' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'au moins 15 caractères' })).toBeVisible()
  await expect(page.getByRole('alert').filter({ hasText: 'pas identiques' })).toBeVisible()
  await expect(page.getByLabel(/^Mot de passe/)).toHaveAttribute('aria-invalid', 'true')
  // Age and terms are asked explicitly, unticked by default (D-271). The errors above appear
  // when the field is left (the button moves under the pointer): submit with Enter to be sure.
  await page.getByLabel('Confirme le mot de passe').press('Enter')
  await expect(page.getByRole('alert').filter({ hasText: 'Indique ton âge' })).toBeVisible()
  await expect(
    page.getByRole('alert').filter({ hasText: 'Accepte les conditions d’utilisation' }),
  ).toBeVisible()
  await expect(
    page.getByRole('checkbox', { name: /J’accepte les conditions d’utilisation/ }),
  ).not.toBeChecked()
  await expect(page.getByTestId('lock-screen')).toBeVisible()
})

test('every page shows the alpha badge and the legal footer (D-271)', async ({ page }) => {
  for (const path of PAGES) {
    await page.goto(`${BUILD}${path}`)
    await expect(page.getByRole('link', { name: 'Alpha' })).toHaveAttribute('href', '/cgu#alpha')
    const footer = page.getByRole('navigation', { name: 'Informations légales' })
    for (const [name, href] of [
      ['Mentions légales', '/mentions-legales'],
      ['Confidentialité', '/confidentialite'],
      ['Cookies', '/confidentialite#cookies'],
      ['Conditions d’utilisation', '/cgu'],
      ['Contact et signalement', '/contact'],
    ])
      await expect(footer.getByRole('link', { name, exact: true })).toHaveAttribute('href', href)
    await expect(
      footer.getByRole('link', { name: /^Accessibilité : .*conforme$/ }),
    ).toHaveAttribute('href', '/accessibilite')
  }
})

test('the legal anchors the footer and the app point to exist', async ({ page }) => {
  for (const [path, id] of [
    ['/confidentialite', 'cookies'],
    ['/confidentialite', 'audience'],
    ['/cgu', 'alpha'],
    ['/cgu', 'signaler'],
    ['/contact', 'signaler'],
  ]) {
    await page.goto(`${BUILD}${path}#${id}`)
    await expect(page.locator(`#${id}`)).toBeVisible()
  }
})
