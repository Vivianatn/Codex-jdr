import { expect, test, type Browser, type Page } from '@playwright/test'
import { disableAppAnimations, expectNoSeriousA11yViolations } from './support/a11y'
import {
  createAccount,
  createCampaign,
  dumpTable,
  E2E_PASSWORD,
  importCharacter,
  putRows,
} from './support/app'

/**
 * Online mode through the server (D-262): three browsers with their own
 * storage — the GM, a player and a co-GM — and the real server (in-memory
 * PostgreSQL, started by Playwright). Each run uses fresh e-mail addresses.
 */

const run = Date.now().toString(36)
const email = (name: string) => `${name.toLowerCase()}-${run}@exemple.fr`

async function device(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ locale: 'fr-FR' })
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const page = await context.newPage()
  await page.addInitScript(() => {
    if (!localStorage.getItem('codex.settings'))
      localStorage.setItem(
        'codex.settings',
        JSON.stringify({ state: { theme: 'light', animations: 'off' }, version: 1 }),
      )
  })
  await disableAppAnimations(page)
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.goto('/app/')
  return page
}

/** Lock screen › « Créer un compte ». */
const registerOnline = (page: Page, name: string) => createAccount(page, name, email(name))

/** The GM: an account, Ombreval with Lyra on the Crypte map, on the server. */
async function gmOnline(browser: Browser, address = 'MJ'): Promise<Page> {
  const gm = await device(browser)
  await createAccount(gm, 'MJ', email(address))
  await createCampaign(gm, 'Ombreval')
  await importCharacter(gm, 'Joueurs', { name: 'Lyra', hp: 22 })
  await gm.getByRole('link', { name: 'Cartes', exact: true }).click()
  await gm.getByRole('button', { name: 'Nouvelle carte' }).click()
  const dialog = gm.getByRole('dialog', { name: 'Nouvelle carte' })
  await dialog.getByLabel('Nom').fill('Crypte')
  await dialog.getByRole('button', { name: 'Nouvelle carte' }).click()
  await expect(gm.getByRole('heading', { level: 1, name: 'Crypte' })).toBeVisible()
  await gm.getByRole('button', { name: 'Retour aux campagnes' }).click()
  const [lyra] = (await dumpTable(gm, 'entities')) as { id: string }[]
  const [map] = (await dumpTable(gm, 'maps')) as Record<string, unknown>[]
  await putRows(gm, 'maps', [
    {
      ...map,
      tokens: [{ id: 'tk-lyra', entityId: lyra!.id, col: 2, row: 2, size: 1, hidden: false }],
    },
  ])
  const [record] = (await dumpTable(gm, 'campaigns')) as Record<string, unknown>[]
  await putRows(gm, 'campaigns', [
    { ...record, play: { ...(record!.play as object), mapId: map!.id } },
  ])

  // The campaign goes to the server by itself (D-266).
  await expect(gm.getByTestId('campaign-online')).toHaveText('En ligne', { timeout: 20_000 })
  return gm
}

/** Asks to join through the GM's invitation link. */
async function requestToJoin(page: Page, link: string, message: string) {
  await page.goto(link)
  const form = page.getByTestId('join-request-form')
  await expect(form).toContainText('Ombreval')
  await form.getByLabel(/Un mot pour le MJ/).fill(message)
  await form.getByRole('button', { name: 'Demander à rejoindre' }).click()
  await expect(page.getByText('Demande envoyée : le MJ va te répondre.')).toBeVisible()
}

test('a GM puts a campaign online, a player plays her character, a co-GM prepares', async ({
  browser,
}) => {
  test.setTimeout(300_000)

  // --- The GM: a local account, a campaign, then the account goes online --------
  const gm = await gmOnline(browser)

  // --- An invitation link ------------------------------------------------------
  await gm.getByRole('link', { name: /Ombreval/ }).click()
  await gm.getByTestId('online-button').click()
  const panel = gm.getByTestId('online-panel')
  await panel.getByRole('button', { name: 'Créer un lien' }).click()
  const link = (await panel.getByTestId('invite-link').textContent())!
  expect(link).toMatch(/\/app\/#\/rejoindre\/[\w-]+$/)
  await expectNoSeriousA11yViolations(gm)
  await gm.keyboard.press('Escape')

  // --- The player asks to join; the GM accepts her with Lyra -------------------
  const player = await device(browser)
  await registerOnline(player, 'Chloé')
  await requestToJoin(player, link, 'Je joue Lyra !')

  await gm.getByTestId('online-button').click()
  const request = panel.getByTestId('join-request')
  await expect(request).toContainText('Chloé', { timeout: 20_000 })
  await expect(request).toContainText('Je joue Lyra !')
  await request.getByLabel('Personnage').selectOption({ label: 'Lyra' })
  await request.getByRole('button', { name: 'Accepter' }).click()
  await expect(panel.getByTestId('members')).toContainText('Chloé')

  // --- A co-GM joins the same way --------------------------------------------
  const cogm = await device(browser)
  await registerOnline(cogm, 'Bastien')
  await requestToJoin(cogm, link, '')
  await expect(request).toContainText('Bastien', { timeout: 20_000 })
  await request.getByLabel('Rôle').selectOption({ label: 'Co-MJ' })
  await request.getByRole('button', { name: 'Accepter' }).click()
  await expect(panel.getByTestId('members')).toContainText('Bastien')
  await gm.keyboard.press('Escape')

  // The co-GM gets the whole campaign on his device.
  await cogm.goto('/app/#/')
  await cogm
    .getByRole('radiogroup', { name: 'Je joue en tant que' })
    .getByRole('radio', { name: 'MJ' })
    .click()
  await expect(cogm.getByTestId('campaign-online')).toContainText('Co-MJ · campagne de MJ', {
    timeout: 20_000,
  })

  // --- The GM starts an online game; the player enters and rolls her dice ------
  await gm.getByRole('radiogroup', { name: 'Mode' }).getByRole('radio', { name: 'En jeu' }).click()
  await gm.getByTestId('start-play').getByRole('button', { name: 'Démarrer la partie' }).click()

  await player.goto('/app/#/')
  await player
    .getByRole('radiogroup', { name: 'Je joue en tant que' })
    .getByRole('radio', { name: 'Joueur' })
    .click()
  const game = player.getByTestId('player-game')
  await expect(game).toContainText('Partie en cours, menée par MJ', { timeout: 20_000 })
  await expectNoSeriousA11yViolations(player)
  await game.getByRole('button', { name: 'Entrer dans la partie' }).click()
  const sheet = player.getByTestId('player-panel')
  // The GM chose her character: straight to Lyra.
  await expect(sheet.getByRole('heading', { name: 'Lyra' })).toBeVisible({ timeout: 20_000 })
  await expect(sheet.getByText('Fais glisser ton jeton')).toBeVisible()
  await expect(player.getByTestId('map-canvas')).toBeVisible()
  await expectNoSeriousA11yViolations(player)
  await sheet.getByRole('button', { name: 'Tester Dextérité' }).click()
  await expect(
    player.getByTestId('player-rolls').getByText(/Lyra · Test de Dextérité/),
  ).toBeVisible()
  await expect.poll(async () => (await dumpTable(gm, 'rolls')).length).toBe(1)
  // The roll reaches the co-GM through the server.
  await expect
    .poll(async () => (await dumpTable(cogm, 'rolls')).length, { timeout: 20_000 })
    .toBe(1)

  // --- The co-GM prepares the next session; the GM gets it ----------------------
  await cogm.getByRole('link', { name: /Ombreval/ }).click()
  await cogm.getByRole('link', { name: 'Sessions', exact: true }).click()
  await cogm.getByRole('button', { name: 'Nouvelle session' }).first().click()
  await cogm.getByLabel('Titre').fill('La crypte, deuxième partie')
  await cogm.getByLabel('Titre').blur()
  await expect
    .poll(
      async () => ((await dumpTable(gm, 'sessions')) as { title: string }[]).map((s) => s.title),
      { timeout: 20_000 },
    )
    .toEqual(['La crypte, deuxième partie'])
  // While the GM runs the game, the co-GM only watches the table.
  await cogm
    .getByRole('radiogroup', { name: 'Mode' })
    .getByRole('radio', { name: 'En jeu' })
    .click()
  await expect(cogm.getByTestId('spectator-bar')).toContainText('MJ mène la partie')

  // --- Locking Codex closes the game for the players ---------------------------
  await gm.getByTestId('lock-button').click()
  await expect(player.getByText('La partie en ligne est terminée.')).toBeVisible({
    timeout: 20_000,
  })
  await expect(player.getByTestId('player-games')).toBeVisible()
  // The player's copy of the table is gone.
  expect(
    await player.evaluate(
      async () =>
        (await indexedDB.databases()).filter((d) => d.name?.startsWith('codex-remote-')).length,
    ),
  ).toBe(0)
})

test('an online account comes back on a new device, campaigns included', async ({ browser }) => {
  test.setTimeout(180_000)
  const first = await device(browser)
  await registerOnline(first, 'Ysolde')
  await createCampaign(first, 'Les Terres Brisées')
  await first.getByRole('button', { name: 'Retour aux campagnes' }).click()
  await expect(first.getByTestId('campaign-online')).toHaveText('En ligne', { timeout: 20_000 })

  const second = await device(browser)
  await second.getByRole('button', { name: 'J’ai déjà un compte' }).click()
  await second.getByLabel(/Adresse e-mail/).fill(email('Ysolde'))
  await second.getByLabel(/^Mot de passe/).fill(E2E_PASSWORD)
  await second.getByRole('button', { name: 'Me connecter' }).click()
  await expect(second.getByRole('link', { name: /Les Terres Brisées/ })).toBeVisible({
    timeout: 20_000,
  })
})

test('a player finds an open session, is accepted in one click and picks a character', async ({
  browser,
}) => {
  test.setTimeout(240_000)
  const gm = await gmOnline(browser, 'MJ-catalogue')
  await gm.getByRole('link', { name: /Ombreval/ }).click()
  await gm.getByRole('radiogroup', { name: 'Mode' }).getByRole('radio', { name: 'En jeu' }).click()
  const start = gm.getByTestId('start-play')
  await start.getByLabel('Afficher dans le catalogue des sessions').check()
  await start.getByRole('button', { name: 'Démarrer la partie' }).click()

  // --- A stranger sees the session and asks in one click -----------------------
  const player = await device(browser)
  await registerOnline(player, 'Maël')
  await player
    .getByRole('radiogroup', { name: 'Je joue en tant que' })
    .getByRole('radio', { name: 'Joueur' })
    .click()
  const session = player.getByTestId('open-session')
  await expect(session).toContainText('Partie libre', { timeout: 20_000 })
  await expect(session).toContainText('« Ombreval », menée par MJ')
  await expectNoSeriousA11yViolations(player)
  await session.getByRole('button', { name: 'Demander à rejoindre' }).click()
  await expect(session.getByRole('button', { name: 'Demande envoyée' })).toBeDisabled()

  // --- The GM accepts without choosing a character ---------------------------------
  await expect(gm.getByText('Nouvelle demande pour rejoindre « Ombreval ».')).toBeVisible({
    timeout: 20_000,
  })
  await gm.getByTestId('online-button').click()
  const request = gm.getByTestId('online-panel').getByTestId('join-request')
  await expect(request).toContainText('Maël')
  await request.getByRole('button', { name: 'Accepter' }).click()
  await gm.keyboard.press('Escape')

  // --- The player enters, picks a free character, then sees the map ---------------
  await session.getByRole('button', { name: 'Entrer dans la partie' }).click({ timeout: 20_000 })
  await expect(player.getByRole('heading', { name: 'Choisis ton personnage' })).toBeVisible({
    timeout: 20_000,
  })
  await expect(player.getByTestId('map-canvas')).toHaveCount(0)
  await expectNoSeriousA11yViolations(player)
  await player.getByRole('button', { name: 'Jouer ce personnage' }).click()
  const sheet = player.getByTestId('player-panel')
  await expect(sheet.getByRole('heading', { name: 'Lyra' })).toBeVisible({ timeout: 20_000 })
  await expect(player.getByTestId('map-canvas')).toBeVisible()

  // --- Unlisted, the session leaves the catalogue ------------------------------------
  await gm.getByTestId('online-button').click()
  await gm
    .getByTestId('online-panel')
    .getByLabel('Afficher dans le catalogue des sessions')
    .uncheck()
  const other = await device(browser)
  await registerOnline(other, 'Ilan')
  await other
    .getByRole('radiogroup', { name: 'Je joue en tant que' })
    .getByRole('radio', { name: 'Joueur' })
    .click()
  await expect(other.getByTestId('open-sessions')).toContainText(
    'Aucune session ouverte pour l’instant.',
  )
})

test('adventurers: a profile with its pictures, found by name and by link', async ({ browser }) => {
  test.setTimeout(240_000)
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    'base64',
  )

  // --- Aube dresses her profile up -------------------------------------------------
  const ysolde = await device(browser)
  await createAccount(ysolde, 'Aube', email('Aube-aventure'))
  await ysolde.getByTestId('profile-button').click()
  await expect(ysolde.getByTestId('profile-card')).toContainText('Aube')
  await ysolde.getByRole('button', { name: 'Modifier le profil' }).click()
  const editor = ysolde.getByTestId('profile-editor')
  await editor
    .getByLabel('Photo de profil : Choisir une image')
    .setInputFiles({ name: 'moi.png', mimeType: 'image/png', buffer: png })
  await editor
    .getByLabel('Bannière : Choisir une image')
    .setInputFiles({ name: 'banniere.png', mimeType: 'image/png', buffer: png })
  await editor.getByLabel('Devise').fill('Toujours un pas devant le dragon.')
  await expectNoSeriousA11yViolations(ysolde)
  await editor.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(ysolde.getByText('Profil enregistré.')).toBeVisible()
  const card = ysolde.getByTestId('profile-card')
  await expect(card).toContainText('Toujours un pas devant le dragon.')
  await expect(ysolde.getByTestId('profile-button').locator('img')).toBeVisible()
  await expectNoSeriousA11yViolations(ysolde)
  const code = (await ysolde.getByTestId('adventurer-code').locator('p').first().textContent())!
  expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/)

  // --- Bran finds her by name and asks; she accepts ---------------------------------
  const bran = await device(browser)
  await createAccount(bran, 'Bran', email('Bran-aventure'))
  await bran.getByTestId('profile-button').click()
  const search = bran.getByTestId('adventurer-search')
  await search.getByLabel('Pseudo ou code d’aventurier').fill('Aub')
  await search.getByRole('button', { name: 'Chercher' }).click()
  await search.getByRole('button', { name: 'Ajouter Aube comme aventurier' }).click()
  await expect(bran.getByTestId('adventurers-outgoing')).toContainText('Aube')

  await expect(ysolde.getByText('Bran veut faire route avec toi.')).toBeVisible({
    timeout: 20_000,
  })
  await expect(ysolde.getByTestId('profile-button')).toContainText('1')
  await ysolde
    .getByTestId('adventurers-incoming')
    .getByRole('button', { name: 'Accepter Bran comme aventurier' })
    .click()
  await expect(ysolde.getByTestId('adventurers-friends')).toContainText('Bran')
  await expect(bran.getByTestId('adventurers-friends')).toContainText('Aube', {
    timeout: 20_000,
  })
  // Both are connected: each sees the other online.
  await expect(bran.getByTestId('adventurers-friends')).toContainText('1 en ligne')

  // --- Bran opens her profile: her pictures, their bond ---------------------------------
  await bran
    .getByTestId('adventurers-friends')
    .getByRole('link', { name: 'Voir le profil de Aube' })
    .click()
  const seen = bran.getByTestId('profile-card')
  await expect(seen).toContainText('Toujours un pas devant le dragon.')
  await expect(seen.getByText('Aventurier', { exact: true })).toBeVisible()
  await expect(seen.locator('img').first()).toBeVisible()

  // --- Corwin follows her shared link -----------------------------------------------------
  const corwin = await device(browser)
  await createAccount(corwin, 'Corwin', email('Corwin-aventure'))
  await corwin.goto(`/app/#/aventurier/${code.replace('-', '')}`)
  await expect(corwin.getByTestId('profile-card')).toContainText('Aube', { timeout: 20_000 })
  await corwin.getByRole('button', { name: 'Ajouter comme aventurier' }).click()
  await expect(corwin.getByText('Demande envoyée', { exact: true })).toBeVisible()
  await expect(ysolde.getByTestId('adventurers-incoming')).toContainText('Corwin', {
    timeout: 20_000,
  })
})
