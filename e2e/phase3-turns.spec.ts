import { expect, test } from '@playwright/test'
import { disableAppAnimations, expectNoSeriousA11yViolations } from './support/a11y'
import {
  createAccount,
  createCampaign,
  dumpTable,
  importCharacter,
  putRows,
  reloadAndUnlock,
  startGame,
} from './support/app'

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await disableAppAnimations(page)
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.goto('/app/')
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
  const panel = page.getByRole('complementary', { name: 'Manipulation rapide : Gorak' })
  await panel.getByRole('button', { name: 'Ajouter 1 en Force' }).click()
  await panel.getByLabel('Nouvel objet').fill('Hache')
  await panel.getByRole('checkbox', { name: 'Arme' }).check()
  await panel.getByLabel('Dégâts').fill('1d8')
  await panel.getByRole('button', { name: 'Ajouter l’objet' }).click()
  await expect(panel.getByRole('button', { name: 'Déséquiper Hache' })).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Tester Force pour Gorak' })).toContainText('13')
  await expectNoSeriousA11yViolations(page)

  // Groups and turn survive a reload.
  await reloadAndUnlock(page)
  await expect(page.getByRole('region', { name: 'Tours de jeu' })).toContainText('Round 2')
})

test('a familiar shares its master’s turn; the GM adds it next to its master and deletes an enemy (D-269)', async ({
  page,
}) => {
  test.setTimeout(150_000)
  await createCampaign(page, 'Familiers')
  await importCharacter(page, 'Joueurs', { name: 'Lyra', hp: 25 })
  await page.getByRole('link', { name: 'Cartes', exact: true }).click()
  await page.getByRole('button', { name: 'Nouvelle carte' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nouvelle carte' })
  await dialog.getByLabel('Nom').fill('Crypte')
  await dialog.getByRole('button', { name: 'Nouvelle carte' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Crypte' })).toBeVisible()
  await page.getByRole('button', { name: 'Retour aux campagnes' }).click()

  // An enemy and Lyra's owl, written like the app would.
  const [lyra] = (await dumpTable(page, 'entities')) as Record<string, unknown>[]
  const identity = lyra!.identity as Record<string, unknown>
  const goblinId = crypto.randomUUID()
  const owlId = crypto.randomUUID()
  await putRows(page, 'entities', [
    {
      ...lyra,
      id: goblinId,
      kind: 'enemy',
      identity: { ...identity, pseudo: 'Gobelin' },
      details: { templateId: null, copyNumber: null, xpReward: 0, loot: '' },
    },
    {
      ...lyra,
      id: owlId,
      kind: 'familiar',
      identity: { ...identity, pseudo: 'Hibou' },
      details: { ownerId: lyra!.id, loyalty: 50, actsOnOwnerTurn: true },
    },
  ])
  const [map] = (await dumpTable(page, 'maps')) as Record<string, unknown>[]
  await putRows(page, 'maps', [
    {
      ...map,
      tokens: [
        { id: 'tk-lyra', entityId: lyra!.id, col: 3, row: 3, size: 1, hidden: false },
        { id: 'tk-gob', entityId: goblinId, col: 8, row: 8, size: 1, hidden: false },
      ],
    },
  ])
  const [record] = (await dumpTable(page, 'campaigns')) as Record<string, unknown>[]
  await putRows(page, 'campaigns', [
    { ...record, play: { ...(record!.play as object), mapId: map!.id } },
  ])

  // The open campaign lives in memory: reload so it reads what was just written.
  await reloadAndUnlock(page)
  await page.getByRole('link', { name: /Familiers/ }).click()
  await page
    .getByRole('radiogroup', { name: 'Mode' })
    .getByRole('radio', { name: 'En jeu' })
    .click()
  await startGame(page)

  // The GM brings the owl next to Lyra: only player characters' and enemies' familiars.
  const add = page.getByRole('region', { name: 'Ajouter un familier' })
  // Folded in the turns rail (D-272).
  await add.getByRole('button', { name: 'Ajouter un familier' }).click()
  await add.getByRole('button', { name: 'Placer Hibou' }).click()
  await expect(add).toContainText('déjà sur le plateau')
  await expect
    .poll(async () => {
      const [m] = (await dumpTable(page, 'maps')) as {
        tokens: { entityId: string; col: number; row: number }[]
      }[]
      const owl = m!.tokens.find((tk) => tk.entityId === owlId)
      return owl ? Math.max(Math.abs(owl.col - 3), Math.abs(owl.row - 3)) : null
    })
    .toBe(1)

  // Groups: the owl is not offered, it plays with Lyra.
  const group = async (name: string, member: string) => {
    await page.getByLabel('Nouveau groupe').fill(name)
    await page.getByRole('button', { name: 'Créer le groupe' }).click()
    const card = page.getByRole('region', { name })
    const select = card.getByRole('combobox', { name: `Ajouter au groupe ${name}` })
    await expect(select.locator('option', { hasText: 'Hibou' })).toHaveCount(0)
    await select.selectOption({ label: member })
    await card.getByRole('button', { name: `Ajouter au groupe ${name}` }).click()
  }
  await group('Héros', 'Lyra (Joueur)')
  await group('Monstres', 'Gobelin (Ennemi)')
  await expect(
    page.getByRole('region', { name: 'Héros' }).getByRole('list', { name: 'Joue au tour de Lyra' }),
  ).toBeVisible()

  const banner = page.getByRole('region', { name: 'Tours de jeu' })
  await banner.getByRole('button', { name: 'Commencer les tours' }).click()
  await expect(banner.getByRole('button', { name: /Lyra — À Lyra de jouer/ })).toBeVisible()
  const actors = banner.getByRole('list', { name: 'Qui joue' })
  await expect(actors.getByRole('button', { name: 'Lancer les dés pour Hibou' })).toBeVisible()
  await expectNoSeriousA11yViolations(page)

  // The goblin's turn: the GM rolls for it from the banner, then deletes it.
  await banner.getByRole('button', { name: 'Tour suivant' }).click()
  await actors.getByRole('button', { name: 'Lancer les dés pour Gobelin' }).click()
  const panel = page.getByRole('complementary', { name: 'Manipulation rapide : Gobelin' })
  await panel.getByRole('button', { name: 'Tester Force pour Gobelin' }).click()
  await panel.getByRole('button', { name: 'Supprimer l’ennemi' }).click()
  const confirm = page.getByRole('dialog', { name: 'Supprimer Gobelin ?' })
  await confirm.getByRole('button', { name: 'Supprimer' }).click()
  await expect(banner).toContainText('Tour du MJ')
  await expect
    .poll(async () =>
      ((await dumpTable(page, 'entities')) as { id: string }[]).some((e) => e.id === goblinId),
    )
    .toBe(false)
})

test('every roll of a live game shows big, in the roller colour (D-268)', async ({ page }) => {
  test.setTimeout(120_000)
  await createCampaign(page, 'Grands dés')
  await importCharacter(page, 'Joueurs', { name: 'Lyra', hp: 25 })
  // The GM gives Lyra her colour on her sheet.
  await page.getByRole('tab', { name: 'Identité' }).click()
  const picker = page.getByTestId('player-color-picker')
  await picker.getByTitle('Azur', { exact: true }).click()
  await expect(picker.getByRole('radio', { name: 'Azur', exact: true })).toBeChecked()
  await page
    .getByRole('radiogroup', { name: 'Mode' })
    .getByRole('radio', { name: 'En jeu' })
    .click()
  await startGame(page)

  // A GM roll: the DA gold.
  await page.getByRole('button', { name: 'Dés et historique des jets' }).click()
  const tray = page.getByRole('complementary', { name: 'Dés' })
  await tray.getByLabel('Expression', { exact: true }).fill('2d6+40')
  await tray.getByRole('button', { name: 'Lancer', exact: true }).click()
  const stage = page.getByTestId('dice-stage')
  await expect(stage).toBeVisible()
  await expect(stage).toHaveAttribute('data-player-color', 'gm')
  await expect(stage).toContainText('MJ')
  await expect(page.getByTestId('dice-stage-total')).toHaveText(/^(4[2-9]|5[0-2])$/)
  await expectNoSeriousA11yViolations(page)
  // Escape skips it (and closes the dice tray).
  await page.keyboard.press('Escape')
  await expect(stage).toHaveCount(0)
  await expect(tray).toBeHidden()

  // Lyra's check: her colour.
  await page.getByRole('button', { name: 'Manipuler Lyra' }).click()
  await page.getByRole('button', { name: 'Fiche complète' }).click()
  await page.getByRole('button', { name: /^Tester Force/ }).click()
  await expect(stage).toHaveAttribute('data-player-color', 'azure')
  await expect(stage).toContainText('Lyra')
  // It leaves by itself.
  await expect(stage).toHaveCount(0, { timeout: 6000 })
})
