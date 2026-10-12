import { expect, test } from '@playwright/test'
import { disableAppAnimations, expectNoSeriousA11yViolations } from './support/a11y'
import { createAccount, createCampaign, importCharacter, startGame } from './support/app'

/**
 * Art direction (docs/CODEX-DA.md §12, step 12): the redesigned screens pass
 * axe in both themes — empty states, settings, map editor, play screen with
 * a mini sheet, the players' pause screen.
 */
for (const theme of ['light', 'dark'] as const) {
  test(`art direction screens are accessible (${theme})`, async ({ page }) => {
    test.setTimeout(150_000)
    await page.addInitScript((t) => {
      if (!localStorage.getItem('codex.settings'))
        localStorage.setItem('codex.settings', JSON.stringify({ state: { theme: t }, version: 1 }))
    }, theme)
    await disableAppAnimations(page)
    await page.setViewportSize({ width: 1400, height: 900 })
    await page.goto('/')
    // Lock screen (D-241), then the empty campaigns screen.
    await expect(page.getByRole('heading', { name: 'Bienvenue dans Codex' })).toBeVisible()
    await expectNoSeriousA11yViolations(page)
    await createAccount(page)
    await expect(page.getByRole('img', { name: /chandelle éteinte/ })).toBeVisible()
    await expectNoSeriousA11yViolations(page)

    await createCampaign(page, 'Chandelle')
    await page.getByRole('link', { name: 'Bestiaire', exact: true }).click()
    await expect(page.getByRole('img', { name: /grimoire ouvert/ })).toBeVisible()
    await expectNoSeriousA11yViolations(page)

    await page.getByRole('button', { name: 'Ouvrir les paramètres' }).click()
    await expect(page.getByRole('checkbox', { name: /En jeu, toujours en sombre/ })).toBeChecked()
    await expectNoSeriousA11yViolations(page)
    await page.keyboard.press('Escape')

    await importCharacter(page, 'Joueurs', { name: 'Gorak', hp: 31 })
    await page.getByRole('link', { name: 'Cartes', exact: true }).click()
    await page.getByRole('button', { name: 'Nouvelle carte' }).click()
    const dialog = page.getByRole('dialog', { name: 'Nouvelle carte' })
    await dialog.getByLabel('Nom').fill('Crypte')
    await dialog.getByRole('button', { name: 'Nouvelle carte' }).click()
    await expect(page.getByRole('complementary', { name: 'Éléments' })).toBeVisible()
    await expectNoSeriousA11yViolations(page)

    await page.getByRole('button', { name: 'Jouer cette carte' }).click()
    await startGame(page)
    // The play screen is dark whatever the preparation theme (D-235).
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page
      .getByRole('complementary', { name: 'Accès rapide' })
      .getByRole('button', { name: 'Manipuler Gorak' })
      .click()
    const quick = page.getByRole('complementary', { name: 'Manipulation rapide — Gorak' })
    await quick.getByRole('button', { name: 'Placer sur la carte' }).click()
    await quick.getByRole('button', { name: 'Fermer' }).first().click()
    await page.getByRole('checkbox', { name: 'Mini-fiches des joueurs' }).check()
    await expect(page.getByRole('button', { name: 'Ouvrir la mini-fiche de Gorak' })).toBeVisible()
    await expectNoSeriousA11yViolations(page)

    const campaignId = page.url().match(/\/c\/([^/]+)\//)![1]!
    const players = await page.context().newPage()
    await players.goto(`/#/c/${campaignId}/view`)
    await page.getByRole('button', { name: 'Vue joueurs' }).click()
    await page.getByRole('menuitemradio', { name: 'Une pause' }).click()
    await expect(players.getByText('Une courte pause. On reprend dans un instant.')).toBeVisible()
    await expectNoSeriousA11yViolations(players)
  })
}
