import { expect, test, type Browser, type Page } from '@playwright/test'
import { disableAppAnimations, expectNoSeriousA11yViolations } from './support/a11y'
import { createAccount, createCampaign, dumpTable, importCharacter, putRows } from './support/app'

/**
 * Online mode over real WebRTC (D-245): three browsers with their own storage
 * and account — the GM, a player and a co-GM — connected by pasted codes.
 * Same machine, no STUN; Chrome must not hide local addresses behind mDNS.
 */
test.use({ launchOptions: { args: ['--disable-features=WebRtcHideLocalIpsWithMdns'] } })

async function device(browser: Browser, name: string): Promise<Page> {
  const context = await browser.newContext({ locale: 'fr-FR' })
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const page = await context.newPage()
  await page.addInitScript(() => {
    if (!localStorage.getItem('codex.settings'))
      localStorage.setItem(
        'codex.settings',
        JSON.stringify({
          state: { theme: 'light', animations: 'off', stunServer: '' },
          version: 1,
        }),
      )
  })
  await disableAppAnimations(page)
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.goto('/app/')
  await createAccount(page, name)
  return page
}

/** GM side: one invitation, the guest's reply, connected. */
async function invite(
  gm: Page,
  guest: Page,
  role: 'Inviter un joueur' | 'Inviter un éditeur (co-MJ)',
) {
  await gm.getByTestId('online-button').click()
  const panel = gm.getByTestId('online-panel')
  await expectNoSeriousA11yViolations(gm)
  await panel.getByRole('button', { name: role }).click()
  const code = (await panel.getByTestId('invite-code').textContent())!

  await guest.getByRole('button', { name: 'Rejoindre une partie' }).first().click()
  await guest.getByLabel('Code d’invitation').fill(code)
  await guest.getByRole('button', { name: 'Continuer' }).click()
  const reply = (await guest.getByTestId('reply-code').textContent())!

  await panel.getByLabel('Code de réponse reçu').fill(reply)
  await panel.getByRole('button', { name: 'Connecter', exact: true }).click()
  await expect(panel.getByTestId('invite')).toBeHidden({ timeout: 20_000 })
  await gm.keyboard.press('Escape')
}

test('a GM hosts, a player plays her character, a co-GM prepares a session', async ({
  browser,
}) => {
  test.setTimeout(240_000)
  const gm = await device(browser, 'MJ')
  await createCampaign(gm, 'Ombreval')
  await importCharacter(gm, 'Joueurs', { name: 'Lyra', hp: 22 })
  await gm.getByRole('link', { name: 'Cartes', exact: true }).click()
  await gm.getByRole('button', { name: 'Nouvelle carte' }).click()
  const dialog = gm.getByRole('dialog', { name: 'Nouvelle carte' })
  await dialog.getByLabel('Nom').fill('Crypte')
  await dialog.getByRole('button', { name: 'Nouvelle carte' }).click()
  await expect(gm.getByRole('heading', { level: 1, name: 'Crypte' })).toBeVisible()

  // Lyra's token on the map, in play — written while the campaign is closed.
  await gm.getByRole('button', { name: 'Retour aux campagnes' }).click()
  const [lyra] = (await dumpTable(gm, 'entities')) as { id: string }[]
  const [map] = (await dumpTable(gm, 'maps')) as Record<string, unknown>[]
  await putRows(gm, 'maps', [
    {
      ...map,
      tokens: [{ id: 'tk-lyra', entityId: lyra!.id, col: 2, row: 2, size: 1, hidden: false }],
    },
  ])
  const [campaign] = (await dumpTable(gm, 'campaigns')) as Record<string, unknown>[]
  await putRows(gm, 'campaigns', [
    { ...campaign, play: { ...(campaign!.play as object), mapId: map!.id } },
  ])
  await gm.getByRole('link', { name: /Ombreval/ }).click()
  await expect(gm.getByTestId('online-button')).toBeVisible()

  // --- Open online, invite a player ----------------------------------------
  await gm.getByTestId('online-button').click()
  await gm
    .getByTestId('online-panel')
    .getByRole('button', { name: 'Ouvrir la campagne en ligne' })
    .click()
  await gm.keyboard.press('Escape')
  const player = await device(browser, 'Chloé')
  await invite(gm, player, 'Inviter un joueur')

  // The player lands on her screen and picks Lyra.
  await expect(player.getByRole('heading', { name: 'Choisis ton personnage' })).toBeVisible()
  await expectNoSeriousA11yViolations(player)
  await player.getByRole('button', { name: 'Jouer ce personnage' }).click()
  const panel = player.getByTestId('player-panel')
  await expect(panel.getByRole('heading', { name: 'Lyra' })).toBeVisible()
  await expect(panel.getByText('La partie n’a pas commencé')).toBeVisible()
  await expect(player.getByTestId('map-canvas')).toBeVisible()
  await expectNoSeriousA11yViolations(player)

  // --- The GM starts an online game; the player rolls her own dice -----------
  await gm.getByRole('radiogroup', { name: 'Mode' }).getByRole('radio', { name: 'En jeu' }).click()
  await gm.getByTestId('start-play').getByRole('radio', { name: 'En ligne' }).click()
  await gm.getByTestId('start-play').getByRole('button', { name: 'Démarrer la partie' }).click()
  await expect(panel.getByText('Fais glisser ton jeton')).toBeVisible()
  await panel.getByRole('button', { name: 'Tester Dextérité' }).click()
  await expect(
    player.getByTestId('player-rolls').getByText(/Lyra · Test de Dextérité/),
  ).toBeVisible()
  await expect.poll(async () => (await dumpTable(gm, 'rolls')).length).toBe(1)

  // --- A co-GM joins and prepares a session; the GM sees it ----------------
  const editor = await device(browser, 'Bastien')
  await invite(gm, editor, 'Inviter un éditeur (co-MJ)')
  await expect(editor.getByTestId('guest-badge')).toBeVisible()
  await editor.getByRole('link', { name: 'Sessions', exact: true }).click()
  await editor.getByRole('button', { name: 'Nouvelle session' }).first().click()
  await editor.getByLabel('Titre').fill('La crypte, deuxième partie')
  await editor.getByLabel('Titre').blur()
  await expect
    .poll(async () =>
      ((await dumpTable(gm, 'sessions')) as { title: string }[]).map((s) => s.title),
    )
    .toEqual(['La crypte, deuxième partie'])

  // While the GM runs the game, the co-GM only watches the table.
  await editor
    .getByRole('radiogroup', { name: 'Mode' })
    .getByRole('radio', { name: 'En jeu' })
    .click()
  await expect(editor.getByTestId('spectator-bar')).toContainText('MJ mène la partie')

  // --- Locking Codex ends the online session for everyone ------------------
  await gm.getByTestId('lock-button').click()
  await expect(player.getByText('La session en ligne est terminée.')).toBeVisible({
    timeout: 20_000,
  })
  await expect(player.getByRole('heading', { name: 'Tes campagnes' })).toBeVisible()
  // The guest's copy is gone; her own (empty) campaigns are back.
  await expect(player.getByText('Ta bibliothèque est vide')).toBeVisible()
  expect(
    await player.evaluate(
      async () =>
        (await indexedDB.databases()).filter((d) => d.name?.startsWith('codex-remote-')).length,
    ),
  ).toBe(0)
})
