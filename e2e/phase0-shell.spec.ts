import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { disableAppAnimations, expectNoSeriousA11yViolations } from './support/a11y'
import { createAccount, dumpTable, reloadAndUnlock, startGame, unlock } from './support/app'

async function createCampaign(page: Page, name: string) {
  await page.getByRole('button', { name: 'Nouvelle campagne' }).first().click()
  await page.getByLabel('Nom').fill(name)
  await page.getByRole('button', { name: 'Créer' }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await disableAppAnimations(page)
  await page.goto('/app/')
  await createAccount(page)
})

test('creates a campaign, switches modes and survives a reload', async ({ page }) => {
  await expect(page.getByText('Aucune campagne pour l’instant')).toBeVisible()
  await createCampaign(page, 'La Crypte des Murmures')

  const modes = page.getByRole('radiogroup', { name: 'Mode' })
  await page.getByRole('link', { name: 'Bestiaire', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Bestiaire', exact: true })).toBeVisible()

  await modes.getByRole('radio', { name: 'En jeu' }).click()
  await startGame(page)
  await expect(page.getByRole('main', { name: 'Plateau de jeu' })).toBeVisible()

  await modes.getByRole('radio', { name: 'Préparation' }).click()
  await expect(page.getByRole('heading', { name: 'Bestiaire', exact: true })).toBeVisible()

  await reloadAndUnlock(page)
  await expect(page.getByRole('heading', { name: 'Bestiaire', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Retour aux campagnes' }).click()
  await expect(page.getByRole('link', { name: /La Crypte des Murmures/ })).toBeVisible()
})

test('dark theme persists across reloads without a flash', async ({ page }) => {
  await page.getByRole('button', { name: 'Changer de thème' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.reload()
  // Set by the inline boot script, before React mounts.
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

test('exports a campaign, deletes it and re-imports it identically', async ({ page }) => {
  await createCampaign(page, 'Aller-retour')
  await page.getByRole('button', { name: 'Retour aux campagnes' }).click()

  await page.getByRole('button', { name: /Plus d’actions — Aller-retour/ }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: 'Exporter' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^codex-aller-retour-\d{4}-\d{2}-\d{2}\.json$/)
  const file = JSON.parse(await readFile(await download.path(), 'utf8'))
  expect(file).toMatchObject({ format: 'codex-campaign', version: 8 })

  await page.getByRole('button', { name: /Plus d’actions — Aller-retour/ }).click()
  await page.getByRole('menuitem', { name: 'Supprimer' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click()
  await expect(page.getByText('Aucune campagne pour l’instant')).toBeVisible()

  await page.getByTestId('campaign-import-input').setInputFiles({
    name: 'export.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(file)),
  })
  await expect(page.getByRole('link', { name: /Aller-retour/ })).toBeVisible()

  const reimported = await dumpTable(page, 'campaigns')
  expect(reimported).toEqual([file.campaign])
})

test('rejects an invalid import file with a clear message', async ({ page }) => {
  await page.getByTestId('campaign-import-input').setInputFiles({
    name: 'nope.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"hello": "world"}'),
  })
  await expect(page.getByText('Ce fichier n’est pas une campagne Codex.')).toBeVisible()
})

for (const theme of ['light', 'dark'] as const) {
  test(`main screens have no serious accessibility violations (${theme})`, async ({ page }) => {
    if (theme === 'dark') await page.getByRole('button', { name: 'Changer de thème' }).click()
    await expectNoSeriousA11yViolations(page) // empty campaigns list

    await createCampaign(page, 'Accessible')
    await expectNoSeriousA11yViolations(page) // dashboard

    await page.getByRole('link', { name: 'Joueurs', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Joueurs', exact: true })).toBeVisible()
    await expectNoSeriousA11yViolations(page) // section empty state

    await page
      .getByRole('radiogroup', { name: 'Mode' })
      .getByRole('radio', { name: 'En jeu' })
      .click()
    await startGame(page)
    await expect(page.getByRole('main', { name: 'Plateau de jeu' })).toBeVisible()
    await expectNoSeriousA11yViolations(page) // play mode

    await page.getByRole('button', { name: 'Retour aux campagnes' }).click()
    await expect(page.getByRole('link', { name: /Accessible/ })).toBeVisible()
    await expectNoSeriousA11yViolations(page) // campaigns list

    await page.getByRole('button', { name: 'Ouvrir les paramètres' }).click()
    await expect(page.getByRole('dialog', { name: 'Paramètres' })).toBeVisible()
    await expectNoSeriousA11yViolations(page) // settings dialog
  })
}

test('GDPR: exports every campaign in one archive, then erases everything', async ({ page }) => {
  await createCampaign(page, 'Première')
  await page.getByRole('button', { name: 'Retour aux campagnes' }).click()
  await createCampaign(page, 'Seconde')
  await page.getByRole('button', { name: 'Retour aux campagnes' }).click()
  await page.getByRole('button', { name: 'Changer de thème' }).click()

  await page.getByRole('button', { name: 'Ouvrir les paramètres' }).click()
  const privacy = page.getByTestId('privacy-section')
  await privacy.getByText('Lire la notice de confidentialité').click()
  await expect(privacy.getByText(/Responsable des données : toi/)).toBeVisible()
  await expectNoSeriousA11yViolations(page)

  const downloadPromise = page.waitForEvent('download')
  await privacy.getByRole('button', { name: 'Tout exporter' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^codex-archive-\d{4}-\d{2}-\d{2}\.json$/)
  const archive = JSON.parse(await readFile(await download.path(), 'utf8'))
  expect(archive.format).toBe('codex-archive')
  expect(archive.campaigns.map((c: { campaign: { name: string } }) => c.campaign.name)).toEqual([
    'Première',
    'Seconde',
  ])

  await privacy.getByRole('button', { name: 'Tout effacer' }).click()
  await page.getByTestId('erase-all-confirm').click()
  await expect(page.getByTestId('lock-screen')).toBeVisible()
  await unlock(page)
  await expect(page.getByText('Aucune campagne pour l’instant')).toBeVisible()
  // Preferences are gone too: back to the default light theme.
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')

  // The archive brings both campaigns back.
  await page.getByTestId('campaign-import-input').setInputFiles(await download.path())
  await expect(page.getByText('Archive importée : 2 campagnes.')).toBeVisible()
  await expect(page.getByRole('link', { name: /Première/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Seconde/ })).toBeVisible()
})
