import { expect, test, type Page } from '@playwright/test'
import { disableAppAnimations, expectNoSeriousA11yViolations } from './support/a11y'
import { createAccount, createCampaign, dumpTable, importCharacter } from './support/app'

interface Point {
  x: number
  y: number
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await disableAppAnimations(page)
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.goto('/')
  await createAccount(page)
})

/** Screen position of a map point (map pixels), through the DEV debug hook. */
function screen(page: Page, p: Point) {
  return page.evaluate(
    (point) =>
      (window as unknown as { __codexMap: { toScreen: (p: Point) => Point } }).__codexMap.toScreen(
        point,
      ),
    p,
  )
}

async function click(page: Page, p: Point) {
  const s = await screen(page, p)
  await page.mouse.click(s.x, s.y)
}

async function drag(page: Page, from: Point, to: Point, modifiers: { shift?: boolean } = {}) {
  const a = await screen(page, from)
  const b = await screen(page, to)
  if (modifiers.shift) await page.keyboard.down('Shift')
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  for (let i = 1; i <= 8; i++)
    await page.mouse.move(a.x + ((b.x - a.x) * i) / 8, a.y + ((b.y - a.y) * i) / 8)
  await page.mouse.up()
  if (modifiers.shift) await page.keyboard.up('Shift')
}

/** A plain stone-and-grass picture, 768 × 512 px (12 × 8 cells of 64 px). */
function backgroundPng(page: Page) {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 768
    canvas.height = 512
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#5d7d4a'
    ctx.fillRect(0, 0, 768, 512)
    ctx.fillStyle = '#8a8478'
    ctx.fillRect(64, 64, 320, 320)
    return canvas.toDataURL('image/png').split(',')[1]!
  })
}

interface StoredMap {
  name: string
  cols: number
  rows: number
  background: { assetId: string | null }
  walls: { kind: string; door?: { open: boolean } }[]
  elements: { kind: string }[]
  tokens: { entityId: string; col: number; row: number }[]
  fog: { enabled: boolean; revealed: string }
}

const maps = async (page: Page) => (await dumpTable(page, 'maps')) as StoredMap[]
const C = 64
const centre = (col: number, row: number) => ({ x: col * C + C / 2, y: row * C + C / 2 })

test('maps: editor, walls and doors, fog, tokens, areas and the players’ view', async ({
  page,
  context,
}) => {
  test.setTimeout(180_000)
  await createCampaign(page, 'Cartes')
  await importCharacter(page, 'Joueurs', { name: 'Lyra', hp: 25 })
  const campaignId = page.url().match(/\/c\/([^/]+)\//)![1]!

  // --- Préparation › Cartes: create a map ---------------------------------
  await page.getByRole('link', { name: 'Cartes', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Cartes' })).toBeVisible()
  await expectNoSeriousA11yViolations(page)
  await page.getByRole('button', { name: 'Nouvelle carte' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nouvelle carte' })
  await dialog.getByLabel('Nom').fill('Crypte')
  await dialog.getByRole('button', { name: 'Nouvelle carte' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Crypte' })).toBeVisible()
  const settings = page.getByRole('complementary', { name: 'Réglages de la carte' })
  await expect(settings).toBeVisible()

  // Background image: the grid adapts to it (12 × 8 cells).
  await page.getByTestId('map-background-input').setInputFiles({
    name: 'crypte.png',
    mimeType: 'image/png',
    buffer: Buffer.from(await backgroundPng(page), 'base64'),
  })
  await expect(settings.getByRole('button', { name: 'Retirer l’image' })).toBeVisible()
  await expect
    .poll(async () => (await maps(page))[0])
    .toMatchObject({ cols: 12, rows: 8, background: { assetId: expect.any(String) } })
  await expectNoSeriousA11yViolations(page)

  // Walls along x = 6 cells, with a door between rows 3 and 4.
  const toolbar = page.getByRole('toolbar', { name: 'Outils' })
  await toolbar.getByRole('button', { name: 'Tracer des murs' }).click()
  await click(page, { x: 6 * C, y: 0 })
  await click(page, { x: 6 * C, y: 3 * C })
  await page.keyboard.press('Escape')
  await click(page, { x: 6 * C, y: 4 * C })
  await click(page, { x: 6 * C, y: 8 * C })
  await page.keyboard.press('Escape')
  await toolbar.getByRole('button', { name: 'Placer une porte' }).click()
  await click(page, { x: 6 * C, y: 3 * C })
  await click(page, { x: 6 * C, y: 4 * C })
  await expect
    .poll(async () => (await maps(page))[0]!.walls.map((w) => w.kind).sort())
    .toEqual(['door', 'wall', 'wall'])

  // A trap from the palette, with damage.
  await page
    .getByRole('complementary', { name: 'Éléments' })
    .getByRole('button', { name: 'Piège' })
    .click()
  await click(page, centre(9, 2))
  const trapPanel = page.getByRole('complementary', { name: 'Piège' })
  await trapPanel.getByRole('combobox', { name: 'Effet du piège' }).selectOption('damage')
  await expect
    .poll(async () => (await maps(page))[0]!.elements.map((e) => e.kind))
    .toEqual(['trap'])

  // Fog of war, revealed around the players.
  await trapPanel.getByRole('button', { name: 'Fermer' }).click()
  await settings.getByRole('checkbox', { name: 'Activer le brouillard' }).check()
  await settings
    .getByRole('checkbox', { name: 'Révéler automatiquement autour des joueurs' })
    .check()
  await expectNoSeriousA11yViolations(page)

  // --- Play the map --------------------------------------------------------
  await page.getByRole('button', { name: 'Jouer cette carte' }).click()
  await expect(page.getByRole('combobox', { name: 'Carte en jeu' })).toHaveValue(/.+/)
  await page.getByLabel('Nouveau groupe').fill('Groupe')
  await page.getByRole('button', { name: 'Créer le groupe' }).click()
  const card = page.getByRole('region', { name: 'Groupe' })
  await card
    .getByRole('combobox', { name: 'Ajouter au groupe Groupe' })
    .selectOption({ label: 'Lyra (Joueur)' })
  await card.getByRole('button', { name: 'Ajouter au groupe Groupe' }).click()

  await card.getByRole('button', { name: 'Manipuler Lyra' }).click()
  const quick = page.getByRole('complementary', { name: 'Manipulation rapide — Lyra' })
  await quick.getByRole('button', { name: 'Placer sur la carte' }).click()
  await expect(quick.getByRole('combobox', { name: 'Taille du jeton' })).toBeVisible()
  await quick.getByRole('button', { name: 'Fermer' }).first().click()
  await expect
    .poll(async () => (await maps(page))[0]!.tokens)
    .toEqual([expect.objectContaining({ col: 6, row: 4 })])
  expect((await maps(page))[0]!.fog.revealed).toContain('1')
  await expectNoSeriousA11yViolations(page)

  // Mini sheet above the token (D-234): -2 HP, -2 Dexterity in a few keystrokes.
  await click(page, centre(6, 4))
  const mini = page.getByRole('region', { name: 'Mini-fiche — Lyra' })
  await expect(mini).toBeVisible()
  await mini.getByLabel('Modifier les PV de Lyra').fill('-2')
  await mini.getByLabel('Modifier les PV de Lyra').press('Enter')
  await mini.getByRole('button', { name: /^Dextérité : 12/ }).click()
  await mini.getByLabel(/Nouvelle valeur de Dextérité/).fill('-2')
  await mini.getByLabel(/Nouvelle valeur de Dextérité/).press('Enter')
  await expect(mini.getByRole('button', { name: /^Dextérité : 10/ })).toBeVisible()
  await expect
    .poll(async () => {
      const [lyra] = (await dumpTable(page, 'entities')) as {
        hp: { current: number }
        stats: { dexterity: number }
      }[]
      return [lyra!.hp.current, lyra!.stats.dexterity]
    })
    .toEqual([23, 10])
  await expectNoSeriousA11yViolations(page)
  await mini.getByRole('button', { name: 'Fermer la mini-fiche' }).click()
  await page.getByRole('checkbox', { name: 'Mini-fiches des joueurs' }).check()
  await expect(page.getByRole('button', { name: 'Ouvrir la mini-fiche de Lyra' })).toContainText(
    '23/25',
  )
  await expectNoSeriousA11yViolations(page)
  await page.getByRole('checkbox', { name: 'Mini-fiches des joueurs' }).uncheck()

  // The token cannot cross the wall (closed door); it moves freely on its side.
  await drag(page, centre(6, 4), centre(2, 4))
  await expect(page.getByText('Un mur bloque le passage', { exact: false })).toBeVisible()
  await expect.poll(async () => (await maps(page))[0]!.tokens[0]).toMatchObject({ col: 6, row: 4 })
  await drag(page, centre(6, 4), centre(8, 5))
  await expect.poll(async () => (await maps(page))[0]!.tokens[0]).toMatchObject({ col: 8, row: 5 })

  // Open the door.
  await click(page, { x: 6 * C, y: 3.5 * C })
  const doorPanel = page.getByRole('complementary', { name: 'Porte' })
  await doorPanel.getByRole('button', { name: 'Ouvrir' }).click()
  await expect
    .poll(async () => (await maps(page))[0]!.walls.find((w) => w.door)!.door!.open)
    .toBe(true)
  await doorPanel.getByRole('button', { name: 'Fermer', exact: true }).first().click()

  // Area of effect: a circle around Lyra, 3 damage.
  await page
    .getByRole('toolbar', { name: 'Outils' })
    .getByRole('button', { name: 'Zone d’effet' })
    .click()
  await page.getByRole('menuitem', { name: 'Zone d’effet : cercle' }).click()
  await drag(page, centre(8, 5), { x: centre(8, 5).x + C * 1.2, y: centre(8, 5).y })
  const area = page.getByRole('complementary', { name: /Zone d’effet — 1 cible/ })
  await area.getByLabel('Dés ou valeur').fill('3')
  await area.getByRole('button', { name: 'Appliquer' }).first().click()
  await expect
    .poll(
      async () =>
        ((await dumpTable(page, 'entities')) as { hp: { current: number } }[])[0]!.hp.current,
    )
    .toBe(20)
  await expectNoSeriousA11yViolations(page)

  // --- Players' window -----------------------------------------------------
  const players = await context.newPage()
  await players.setViewportSize({ width: 1000, height: 700 })
  await players.goto(`/#/c/${campaignId}/view`)
  await expect(players.getByTestId('map-canvas')).toBeVisible()
  await expectNoSeriousA11yViolations(players)

  // Pause from the GM window reaches the players.
  await page.getByRole('button', { name: 'Vue joueurs' }).click()
  await page.getByRole('menuitemradio', { name: 'Une pause' }).click()
  await expect(players.getByText('Une courte pause. On reprend dans un instant.')).toBeVisible()
})
