import { expect, test } from '@playwright/test'
import { disableAppAnimations, expectNoSeriousA11yViolations } from './support/a11y'
import {
  createAccount,
  createCampaign,
  importCharacter,
  reloadAndUnlock,
  startGame,
} from './support/app'

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await disableAppAnimations(page)
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.goto('/')
  await createAccount(page)
})

test('turns by groups, the GM turn, and quick manipulation during play', async ({ page }) => {
  test.setTimeout(120_000)
  await createCampaign(page, 'Partie')
  await importCharacter(page, 'Joueurs', { name: 'Lyra', hp: 25 })
  await importCharacter(page, 'Joueurs', { name: 'Gorak', hp: 25 })
  await page
    .getByRole('radiogroup', { name: 'Mode' })
    .getByRole('radio', { name: 'En jeu' })
    .click()
  await startGame(page)

  const group = async (name: string, members: string[]) => {
    await page.getByLabel('Nouveau groupe').fill(name)
    await page.getByRole('button', { name: 'Créer le groupe' }).click()
    const card = page.getByRole('region', { name })
    for (const m of members) {
      await card
        .getByRole('combobox', { name: `Ajouter au groupe ${name}` })
        .selectOption({ label: m })
      await card.getByRole('button', { name: `Ajouter au groupe ${name}` }).click()
    }
  }
  await group('Avant-garde', ['Gorak (Joueur)'])
  await group('Arrière', ['Lyra (Joueur)'])

  const banner = page.getByRole('region', { name: 'Tours de jeu' })
  await banner.getByRole('button', { name: 'Commencer les tours' }).click()
  await expect(banner).toContainText('Au tour du groupe : Avant-garde')
  await expect(banner.getByRole('button', { name: /Gorak — À Gorak de jouer/ })).toBeVisible()
  await expectNoSeriousA11yViolations(page)

  await banner.getByRole('button', { name: 'Tour suivant' }).click()
  await expect(banner).toContainText('Au tour du groupe : Arrière')
  await banner.getByRole('button', { name: 'Tour suivant' }).click()
  await expect(banner).toContainText('Tour du MJ')
  await expectNoSeriousA11yViolations(page)
  await banner.getByRole('button', { name: 'Reprendre' }).click()
  await expect(banner).toContainText('Round 2')

  // Quick manipulation from the banner: a weapon and a stat, in a few clicks.
  await banner.getByRole('button', { name: /Manipuler Gorak/ }).click()
  const panel = page.getByRole('complementary', { name: 'Manipulation rapide — Gorak' })
  await panel.getByRole('button', { name: 'Ajouter 1 en Force' }).click()
  await panel.getByLabel('Nouvel objet').fill('Hache')
  await panel.getByRole('checkbox', { name: 'Arme' }).check()
  await panel.getByLabel('Dégâts').fill('1d8')
  await panel.getByRole('button', { name: 'Ajouter l’objet' }).click()
  await expect(panel.getByRole('button', { name: 'Déséquiper Hache' })).toBeVisible()
  await expect(panel.getByLabel('Force : 13')).toBeVisible()
  await expectNoSeriousA11yViolations(page)

  // Groups and turn survive a reload.
  await reloadAndUnlock(page)
  await expect(page.getByRole('region', { name: 'Tours de jeu' })).toContainText('Round 2')
})
