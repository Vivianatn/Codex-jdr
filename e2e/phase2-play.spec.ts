import { expect, test, type Page } from '@playwright/test'
import { disableAppAnimations, expectNoSeriousA11yViolations } from './support/a11y'
import { createCampaign, dumpTable, importCharacter, STATS } from './support/app'

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await disableAppAnimations(page)
  await page.goto('/')
})

const hpField = (page: Page, name: string) => page.getByLabel(`Modifier les PV de ${name}`)

async function addGoblin(page: Page) {
  await page.getByRole('link', { name: 'Bestiaire' }).click()
  await page.getByRole('link', { name: 'Nouveau modèle' }).first().click()
  await page.getByLabel(/Pseudo/).fill('Gobelin')
  await page.getByRole('button', { name: /Suivant/ }).click()
  for (const s of STATS) await page.getByLabel(s).fill('8')
  await page.getByRole('button', { name: /Suivant/ }).click()
  await page.getByLabel('Jet de PV (1d20)').fill('10')
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: /Suivant/ }).click()
  await page.getByRole('button', { name: 'Créer la fiche' }).click()
  await page.getByRole('button', { name: 'Ajouter à la campagne : Gobelin' }).click()
  await page.getByRole('dialog').getByLabel('Nombre d’exemplaires').fill('1')
  await page.getByRole('dialog').getByRole('button', { name: 'Ajouter' }).click()
}

test('scenario 3 (without initiative): poison expires over turns, a skill goes on cooldown', async ({
  page,
}) => {
  await createCampaign(page, 'Combat')
  await addGoblin(page)
  await importCharacter(page, 'Joueurs', { name: 'Gorak', hp: 30, stats: 14 })

  // A poisoned character loses HP each turn until the poison expires (3 turns).
  await page.getByRole('tab', { name: 'État' }).click()
  await page.getByLabel('Depuis la bibliothèque').selectOption({ label: 'Empoisonné (3 tours)' })
  await page.getByRole('button', { name: 'Ajouter', exact: true }).first().click()
  await expect(page.getByText('3 tours', { exact: true })).toBeVisible()
  const passTurn = page.getByRole('button', { name: 'Passer un tour' }).first()
  await passTurn.click()
  await expect(page.getByText('2 tours', { exact: true })).toBeVisible()
  await passTurn.click()
  await passTurn.click()
  await expect(page.getByText('Empoisonné a expiré pour Gorak')).toBeVisible()
  await expect(page.getByText('Aucun état actif.')).toBeVisible()
  await expect(page.getByRole('meter', { name: 'Points de vie' }).first()).not.toHaveAttribute(
    'aria-valuenow',
    '30',
  )

  // An active skill with a 2-turn cooldown and a fixed damage effect.
  await page.getByRole('tab', { name: 'Compétences' }).click()
  await page.getByRole('button', { name: 'Ajouter : Compétences actives' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Nom').fill('Taillade')
  await dialog.getByLabel('Temps de recharge (tours)').fill('2')
  await dialog.getByLabel('Effet', { exact: true }).selectOption({ label: 'Dégâts' })
  await dialog.getByLabel('Dés de l’effet').fill('6')
  await dialog.getByRole('button', { name: 'Enregistrer' }).click()

  await page.getByRole('button', { name: 'Lancer Taillade' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Lancer' }).click()
  await expect(page.getByRole('button', { name: 'Lancer Taillade' })).toBeDisabled()
  await expect(page.getByText('Recharge : 2 tours')).toBeVisible()
  await passTurn.click()
  await passTurn.click()
  await expect(page.getByRole('button', { name: 'Lancer Taillade' })).toBeEnabled()

  // Saved by the auto-save (debounced), so poll IndexedDB.
  await expect
    .poll(async () => {
      const goblin = (await dumpTable(page, 'entities')).find(
        (e) => (e as { identity: { pseudo: string } }).identity.pseudo === 'Gobelin 1',
      ) as { hp: { current: number } } | undefined
      return goblin?.hp.current
    })
    .toBe(10 + 10 + 1 - 6)
})

test('scenario 6: undo the last 5 actions restores the exact state', async ({ page }) => {
  await createCampaign(page, 'Annulation')
  await importCharacter(page, 'Joueurs', { name: 'Lyra', hp: 25 })
  // Wait for auto-save, then snapshot the stored character.
  await page.waitForTimeout(500)
  const [before] = await dumpTable(page, 'entities')

  const field = hpField(page, 'Lyra')
  await field.fill('-7')
  await field.press('Enter')
  await field.fill('+3')
  await field.press('Enter')
  await field.fill('t+4')
  await field.press('Enter')
  await page.getByRole('button', { name: 'Passer un tour' }).first().click()
  await page.getByRole('tab', { name: 'Inventaire' }).click()
  await page.getByLabel(/Ajouter ou retirer de l’argent/).fill('+5 po')
  await page.getByLabel(/Ajouter ou retirer de l’argent/).press('Enter')
  await expect(page.getByText('5 po')).toBeVisible()

  await page.getByRole('heading', { level: 1, name: 'Lyra' }).click()
  for (let i = 0; i < 5; i++) await page.keyboard.press('Control+z')
  // Only the creation of Lyra is left in the history.
  await expect(page.getByRole('button', { name: /Annuler \(Ctrl\+Z\)/ })).toHaveAccessibleName(
    'Annuler (Ctrl+Z) — Création de Lyra',
  )
  await page.waitForTimeout(500)
  const [after] = await dumpTable(page, 'entities')
  const strip = (e: unknown) => {
    const { updatedAt: _u, ...rest } = e as Record<string, unknown>
    return rest
  }
  expect(strip(after)).toEqual(strip(before))
})

test('dice tray: notation, advantage, secret roll and history', async ({ page }) => {
  await createCampaign(page, 'Dés')
  await page.getByRole('button', { name: 'Dés et historique des jets' }).click()
  const tray = page.getByRole('complementary', { name: 'Dés' })
  await tray.getByLabel('Expression', { exact: true }).fill('4d6dl1')
  await tray.getByRole('button', { name: 'Lancer', exact: true }).click()
  await expect(page.getByTestId('roll-feed')).toContainText('4d6dl1')
  await tray.getByRole('radio', { name: 'Avantage', exact: true }).click()
  await tray.getByLabel('Jet secret (MJ)').check()
  await tray.getByRole('button', { name: 'Lancer 1d20' }).click()
  await expect(page.getByTestId('roll-feed')).toContainText('2d20kh1')
  await expect(page.getByTestId('roll-feed')).toContainText('Secret')
  await expect(tray.getByRole('list', { name: 'Historique' }).getByRole('listitem')).toHaveCount(2)
  await tray.getByLabel('Expression', { exact: true }).fill('3d')
  await tray.getByRole('button', { name: 'Lancer', exact: true }).click()
  await expect(tray.getByRole('alert')).toContainText('L’expression s’arrête trop tôt.')
  // History survives a reload.
  await page.reload()
  await page.getByRole('button', { name: 'Dés et historique des jets' }).click()
  await expect(page.getByRole('list', { name: 'Historique' }).getByRole('listitem')).toHaveCount(2)
})

for (const theme of ['light', 'dark'] as const) {
  test(`play screens have no serious accessibility violations (${theme})`, async ({ page }) => {
    if (theme === 'dark') await page.getByRole('button', { name: 'Changer de thème' }).click()
    await createCampaign(page, 'Accessible')
    await importCharacter(page, 'Joueurs', { name: 'Gorak', hp: 25 })

    for (const tab of ['Statistiques', 'Compétences', 'État', 'Inventaire', 'Journal']) {
      await page.getByRole('tab', { name: tab }).click()
      await expectNoSeriousA11yViolations(page)
    }
    await page.getByRole('tab', { name: 'Statistiques' }).click()
    await page.getByRole('button', { name: 'Tester Force (12)' }).click()
    await expect(page.getByTestId('roll-feed')).toBeVisible()
    await page.getByRole('button', { name: 'Dés et historique des jets' }).click()
    await expectNoSeriousA11yViolations(page)
    await page.getByRole('button', { name: 'Fermer le panneau des dés' }).click()

    for (const section of ['Objets', 'États']) {
      await page.getByRole('link', { name: section, exact: true }).click()
      await expect(page.getByRole('heading', { level: 1, name: section })).toBeVisible()
      await expectNoSeriousA11yViolations(page)
    }

    await page
      .getByRole('radiogroup', { name: 'Mode' })
      .getByRole('radio', { name: 'En jeu' })
      .click()
    await page.getByRole('button', { name: 'Ouvrir la fiche de Gorak' }).click()
    await expect(
      page.getByRole('complementary', { name: 'Ouvrir la fiche de Gorak' }),
    ).toBeVisible()
    await expectNoSeriousA11yViolations(page)
  })
}
