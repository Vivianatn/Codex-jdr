import { expect, test } from '@playwright/test'
import { disableAppAnimations, expectNoSeriousA11yViolations } from './support/a11y'
import { createCampaign, importCharacter, STATS } from './support/app'

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await disableAppAnimations(page)
  await page.goto('/')
})

test('one library skill shared by two characters: editing it updates both', async ({ page }) => {
  await createCampaign(page, 'Compétences')
  await importCharacter(page, 'Joueurs', { name: 'Lyra', hp: 25 })
  await importCharacter(page, 'Joueurs', { name: 'Gorak', hp: 25 })

  // Create the skill once in the library, attach it to both characters.
  await page.getByRole('link', { name: 'Compétences', exact: true }).click()
  await page.getByRole('button', { name: 'Ajouter une compétence' }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Nom').fill('Rage')
  await dialog.getByRole('button', { name: 'Enregistrer' }).click()
  for (const name of ['Lyra', 'Gorak']) {
    await page
      .getByLabel('Attacher à un personnage : Rage')
      .selectOption({ label: `${name} (Joueur)` })
    await page.getByRole('button', { name: 'Attacher à un personnage' }).click()
  }
  await expect(page.getByRole('link', { name: 'Lyra' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Gorak' })).toBeVisible()
  await expectNoSeriousA11yViolations(page)

  // Edit it from Lyra's sheet: Gorak gets the new name too.
  await page.getByRole('link', { name: 'Lyra' }).click()
  await page.getByRole('tab', { name: 'Compétences' }).click()
  await expect(page.getByText('Partagée par 2 personnages')).toBeVisible()
  await page.getByRole('button', { name: 'Modifier : Rage' }).click()
  await expect(page.getByRole('dialog')).toContainText('partagée par 2 personnages')
  await page.getByRole('dialog').getByLabel('Nom').fill('Fureur')
  await page.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click()
  await page.getByRole('link', { name: 'Joueurs', exact: true }).click()
  await page.getByRole('link', { name: 'Ouvrir la fiche de Gorak' }).click()
  await page.getByRole('tab', { name: 'Compétences' }).click()
  await expect(page.getByText('Fureur', { exact: true })).toBeVisible()
})

test('HP given directly, body image, and a familiar attached to its master', async ({ page }) => {
  await createCampaign(page, 'Familiers')

  // An ally created before Codex: 47 max HP at level 6, given as is.
  await page.getByRole('link', { name: 'Alliés et familiers', exact: true }).click()
  await page.getByRole('link', { name: 'Nouvel allié' }).first().click()
  await page.getByLabel(/Pseudo/).fill('Bran')
  await page.getByRole('button', { name: /Suivant/ }).click()
  for (const s of [
    'Force',
    'Constitution',
    'Dextérité',
    'Intelligence',
    'Charisme',
    'Sagesse',
    'Chance',
  ])
    await page.getByLabel(s).fill('10')
  await page.getByRole('button', { name: /Suivant/ }).click()
  await page.getByRole('radio', { name: 'PV max donnés' }).click()
  await page.getByLabel('Niveau').fill('6')
  await page.getByRole('textbox', { name: 'PV max' }).fill('47')
  await page.getByRole('button', { name: /Suivant/ }).click()
  await page.getByRole('button', { name: /Suivant/ }).click()
  await page.getByRole('button', { name: 'Créer la fiche' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Bran' })).toBeVisible()
  await expect(page.getByText('47 / 47').first()).toBeVisible()

  // Body image upload (a tiny generated PNG).
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAIAAAAECAYAAACk7+45AAAAFElEQVR4nGNk+M/AwMDAxMDAwMAAAA4AAk3j0cUAAAAASUVORK5CYII=',
    'base64',
  )
  await page
    .locator('input[type=file]')
    .last()
    .setInputFiles({ name: 'corps.png', mimeType: 'image/png', buffer: png })
  await expect(page.getByRole('button', { name: 'Changer l’image du corps' })).toBeVisible()

  // Attach a new familiar to Bran from his sheet.
  await page.getByRole('link', { name: 'Créer un familier pour ce personnage' }).click()
  await page.getByLabel(/Pseudo/).fill('Corbeau')
  await expect(page.getByLabel('Propriétaire')).toHaveValue(/.+/)
  await page.getByRole('button', { name: /Suivant/ }).click()
  for (const s of STATS) await page.getByLabel(s).fill('6')
  await page.getByRole('button', { name: /Suivant/ }).click()
  await page.getByLabel('Jet de PV (1d20)').fill('3')
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: /Suivant/ }).click()
  await page.getByRole('button', { name: 'Créer la fiche' }).click()
  await page.getByRole('link', { name: 'Retour à la liste' }).click()
  await expect(page.getByText('Familier de Bran')).toBeVisible()
  await expectNoSeriousA11yViolations(page)
})

test('game-like inventory: drag an item onto its slot, read its description', async ({ page }) => {
  await createCampaign(page, 'Inventaire')
  await importCharacter(page, 'Joueurs', {
    name: 'Gorak',
    hp: 25,
    extra: ['## Inventaire :', '- Épée longue', '- Potion de soin x3', '----'],
  })
  await page.getByRole('tab', { name: 'Inventaire' }).click()
  const bag = page.getByRole('list', { name: 'Sac' })
  await expect(bag.getByRole('button', { name: 'Potion de soin ×3, Commun' })).toBeVisible()

  // Make the sword a rare weapon, then drag it onto the main hand.
  await bag.getByRole('button', { name: 'Épée longue, Commun' }).click()
  await page
    .getByRole('article', { name: 'Description de Épée longue' })
    .getByRole('button', { name: 'Modifier' })
    .click()
  const edit = page.getByRole('dialog')
  await edit.getByLabel('Type').selectOption({ label: 'Arme' })
  await edit.getByLabel('Rareté').selectOption({ label: 'Rare' })
  await edit.getByLabel('Description').fill('Forgée dans les Monts Gelés.')
  await edit.getByRole('button', { name: 'Enregistrer' }).click()
  await bag
    .getByRole('button', { name: 'Épée longue, Rare' })
    .dragTo(page.getByLabel('Main principale : Vide'))
  await expect(page.getByRole('button', { name: 'Main principale : Épée longue' })).toBeVisible()
  await expect(bag.getByRole('button', { name: /Épée longue/ })).toHaveCount(0)

  await page.getByRole('button', { name: 'Main principale : Épée longue' }).click()
  const details = page.getByRole('article', { name: 'Description de Épée longue' })
  await expect(details).toContainText('Forgée dans les Monts Gelés.')
  await expect(details).toContainText('Arme · Rare · Main principale')
  await expectNoSeriousA11yViolations(page)

  // Keyboard alternative: unequip from the description panel.
  await details.getByRole('button', { name: 'Retirer de l’équipement' }).click()
  await expect(bag.getByRole('button', { name: 'Épée longue, Rare' })).toBeVisible()
})
