import { expect, test, type Page } from '@playwright/test'
import { disableAppAnimations } from './support/a11y'
import { createCampaign, importCharacter } from './support/app'

/**
 * Screenshots of the main screens in both themes, to review the art
 * direction (docs/CODEX-DA.md). Not part of test:e2e: run `npm run screens`,
 * images land in test-results/screens/.
 */

const shot = (page: Page, theme: string, name: string) =>
  page.screenshot({ path: `test-results/screens/${theme}-${name}.png` })

async function backgroundPng(page: Page) {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1280
    canvas.height = 768
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#6b7d52'
    ctx.fillRect(0, 0, 1280, 768)
    ctx.fillStyle = '#8f877a'
    ctx.fillRect(64, 64, 576, 448)
    ctx.fillStyle = '#4c7aa0'
    ctx.fillRect(900, 0, 96, 768)
    return canvas.toDataURL('image/png').split(',')[1]!
  })
}

for (const theme of ['light', 'dark'] as const) {
  test(`screens in ${theme} theme @visual`, async ({ page }) => {
    test.setTimeout(180_000)
    await page.addInitScript((t) => {
      if (!localStorage.getItem('codex.settings'))
        localStorage.setItem(
          'codex.settings',
          JSON.stringify({ state: { theme: t, animations: 'off' }, version: 1 }),
        )
    }, theme)
    await disableAppAnimations(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await shot(page, theme, '01-campaigns-empty')

    await createCampaign(page, 'La Crypte d’Ombreval')
    await shot(page, theme, '02-dashboard')
    await page.getByRole('link', { name: 'Bestiaire', exact: true }).click()
    await shot(page, theme, '03-bestiary-empty')

    await importCharacter(page, 'Joueurs', {
      name: 'Gorak',
      hp: 31,
      stats: 14,
      level: 3,
      extra: ['## Identité :', '- Classe : Barbare'],
    })
    await shot(page, theme, '04-sheet-identity')
    await page.getByRole('tab', { name: 'Statistiques' }).click()
    await shot(page, theme, '05-sheet-stats')
    await page.getByRole('tab', { name: 'Inventaire' }).click()
    await shot(page, theme, '06-sheet-inventory')
    await importCharacter(page, 'Joueurs', { name: 'Lyra', hp: 22, stats: 11 })
    await page.getByRole('link', { name: 'Joueurs', exact: true }).click()
    await shot(page, theme, '07-players')

    // A map with a background.
    await page.getByRole('link', { name: 'Cartes', exact: true }).click()
    await page.getByRole('button', { name: 'Nouvelle carte' }).click()
    const dialog = page.getByRole('dialog', { name: 'Nouvelle carte' })
    await dialog.getByLabel('Nom').fill('Ombreval')
    await shot(page, theme, '08-dialog')
    await dialog.getByRole('button', { name: 'Nouvelle carte' }).click()
    await page.getByTestId('map-background-input').setInputFiles({
      name: 'ombreval.png',
      mimeType: 'image/png',
      buffer: Buffer.from(await backgroundPng(page), 'base64'),
    })
    await expect(page.getByRole('button', { name: 'Retirer l’image' })).toBeVisible()
    await shot(page, theme, '09-map-editor')

    // Play: a group, the tokens, a mini sheet.
    await page.getByRole('button', { name: 'Jouer cette carte' }).click()
    await page.getByLabel('Nouveau groupe').fill('Le groupe')
    await page.getByRole('button', { name: 'Créer le groupe' }).click()
    const card = page.getByRole('region', { name: 'Le groupe' })
    for (const m of ['Gorak (Joueur)', 'Lyra (Joueur)']) {
      await card.getByRole('combobox', { name: 'Ajouter au groupe Le groupe' }).selectOption({
        label: m,
      })
      await card.getByRole('button', { name: 'Ajouter au groupe Le groupe' }).click()
    }
    for (const name of ['Gorak', 'Lyra']) {
      await card.getByRole('button', { name: `Manipuler ${name}` }).click()
      const quick = page.getByRole('complementary', { name: `Manipulation rapide — ${name}` })
      await quick.getByRole('button', { name: 'Placer sur la carte' }).click()
      if (name === 'Gorak') await shot(page, theme, '10-quick-panel')
      await quick.getByRole('button', { name: 'Fermer' }).first().click()
    }
    await page
      .getByRole('region', { name: 'Tours de jeu' })
      .getByRole('button', {
        name: 'Commencer les tours',
      })
      .click()
    await page.getByRole('checkbox', { name: 'Mini-fiches des joueurs' }).check()
    await page.waitForTimeout(400)
    await shot(page, theme, '11-play')

    // Players' window: pause screen.
    const campaignId = page.url().match(/\/c\/([^/]+)\//)![1]!
    const players = await page.context().newPage()
    await players.setViewportSize({ width: 1440, height: 810 })
    await players.goto(`/#/c/${campaignId}/view`)
    await expect(players.getByTestId('map-canvas')).toBeVisible()
    await players.waitForTimeout(400)
    await players.screenshot({ path: `test-results/screens/${theme}-12-players-map.png` })
    await page.getByRole('button', { name: 'Vue joueurs' }).click()
    await page.getByRole('menuitemradio', { name: 'Une pause' }).click()
    await players.waitForTimeout(400)
    await players.screenshot({ path: `test-results/screens/${theme}-13-players-pause.png` })
  })
}
