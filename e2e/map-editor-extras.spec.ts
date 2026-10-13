import { expect, test, type Page } from '@playwright/test'
import { disableAppAnimations, expectNoSeriousA11yViolations } from './support/a11y'
import { createAccount, createCampaign, dumpTable, importCharacter, startGame } from './support/app'

interface StoredMap {
  id: string
  name: string
  tokens: { entityId: string; col: number; row: number }[]
  elements: {
    kind: string
    x: number
    y: number
    link?: { mapId: string | null }
    gallery?: { assetIds: string[] }
  }[]
}

const maps = async (page: Page) => (await dumpTable(page, 'maps')) as StoredMap[]
const mapNamed = async (page: Page, name: string) => (await maps(page)).find((m) => m.name === name)

/** Clicks the centre of a cell of the board on screen (DEV hook). */
async function clickCell(page: Page, col: number, row: number) {
  await page.waitForFunction(() =>
    Boolean((window as unknown as { __codexMap?: unknown }).__codexMap),
  )
  const at = await page.evaluate(
    ([c, r]) => {
      const hook = (
        window as unknown as {
          __codexMap: {
            cellCenter: (c: number, r: number) => { x: number; y: number }
            toScreen: (p: { x: number; y: number }) => { x: number; y: number }
          }
        }
      ).__codexMap
      return hook.toScreen(hook.cellCenter(c!, r!))
    },
    [col, row],
  )
  await page.mouse.click(at.x, at.y)
}

/** A small plain picture, as a PNG file. */
async function picture(page: Page, name: string, colour: string) {
  const base64 = await page.evaluate((fill) => {
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 48
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = fill
    ctx.fillRect(0, 0, 64, 48)
    return canvas.toDataURL('image/png').split(',')[1]!
  }, colour)
  return { name, mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') }
}

async function newMap(page: Page, name: string) {
  await page.getByRole('link', { name: 'Cartes', exact: true }).first().click()
  await page.getByRole('button', { name: 'Nouvelle carte' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Nouvelle carte' })
  await dialog.getByLabel('Nom').fill(name)
  await dialog.getByRole('button', { name: 'Nouvelle carte' }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await disableAppAnimations(page)
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.goto('/app/')
  await createAccount(page)
})

test('map editor: allies on the board, picture zones, doors with two sides (D-259)', async ({
  page,
}) => {
  test.setTimeout(180_000)
  await createCampaign(page, 'Ombres')
  await importCharacter(page, 'Alliés et familiers', { name: 'Brann', hp: 20 })
  await newMap(page, 'Cave')
  await newMap(page, 'Hall')

  // --- An ally on the map, then removed with the Delete key ---------------
  const palette = page.getByRole('complementary', { name: 'Éléments' })
  await palette.getByRole('button', { name: 'Poser Brann sur la carte' }).click()
  await expect.poll(async () => (await mapNamed(page, 'Hall'))?.tokens.length).toBe(1)
  await expect(palette.getByText('déjà sur la carte')).toBeVisible()
  const token = (await mapNamed(page, 'Hall'))!.tokens[0]!
  await clickCell(page, token.col, token.row)
  const tokenPanel = page.getByRole('complementary', { name: 'Jeton' })
  await expect(tokenPanel).toBeVisible()
  await expectNoSeriousA11yViolations(page)
  await page.keyboard.press('Delete')
  await expect.poll(async () => (await mapNamed(page, 'Hall'))?.tokens.length).toBe(0)

  // --- A picture zone with two pictures -----------------------------------
  await palette.getByRole('button', { name: 'Image à montrer' }).click()
  await clickCell(page, 14, 9)
  const zone = page.getByRole('complementary', { name: 'Image à montrer' })
  await expect(zone.getByText('Aucune image')).toBeVisible()
  await page
    .getByTestId('gallery-file')
    .setInputFiles([
      await picture(page, 'un.png', '#aa3333'),
      await picture(page, 'deux.png', '#3333aa'),
    ])
  await expect(zone.getByRole('img')).toHaveCount(2)
  await expect
    .poll(async () => (await mapNamed(page, 'Hall'))?.elements[0]?.gallery?.assetIds.length)
    .toBe(2)
  await expectNoSeriousA11yViolations(page)
  await zone.getByRole('button', { name: 'Fermer' }).first().click()

  // --- A door: the other map gets its way back at once ---------------------
  await palette.getByRole('button', { name: 'Passage vers une carte' }).click()
  await clickCell(page, 6, 4)
  const door = page.getByRole('complementary', { name: 'Passage vers une carte' })
  await door.getByLabel('Mène à la carte').selectOption({ label: 'Cave' })
  await expect
    .poll(async () => {
      const [hall, cave] = [await mapNamed(page, 'Hall'), await mapNamed(page, 'Cave')]
      return {
        out: hall?.elements.some((e) => e.link?.mapId === cave?.id),
        back: cave?.elements.some((e) => e.link?.mapId === hall?.id),
      }
    })
    .toEqual({ out: true, back: true })
  // One undo removes both sides.
  await page.keyboard.press('Control+z')
  await expect.poll(async () => (await mapNamed(page, 'Cave'))?.elements.length).toBe(0)
  await page.keyboard.press('Control+Shift+z')
  await expect.poll(async () => (await mapNamed(page, 'Cave'))?.elements.length).toBe(1)

  // --- In play: the GM shows the pictures one after the other --------------
  await page.getByRole('button', { name: 'Jouer cette carte' }).click()
  await startGame(page)
  const shown = page.getByRole('complementary', { name: 'Image à montrer' })
  // The board frames the map just after it appears: click again until the zone opens.
  await expect(async () => {
    await clickCell(page, 14, 9)
    await expect(shown).toBeVisible({ timeout: 1000 })
  }).toPass()
  await shown.getByRole('button', { name: 'Montrer aux joueurs' }).click()
  const display = async () =>
    ((await dumpTable(page, 'campaigns')) as { play: { display: Record<string, unknown> } }[])[0]!
      .play.display
  await expect.poll(async () => ((await display()).gallery as string[]).length).toBe(2)
  await expect(shown.getByText('1 / 2')).toBeVisible()
  await shown.getByRole('button', { name: 'Image suivante' }).click()
  await expect(shown.getByText('2 / 2')).toBeVisible()
  await shown.getByRole('button', { name: 'Revenir à la carte' }).click()
  await expect.poll(async () => (await display()).mode).toBe('map')

  // --- Deleting in play too (D-260): the button, then Ctrl+Z, then the Delete key
  const hallElements = async () => (await mapNamed(page, 'Hall'))?.elements.length
  const before = (await hallElements())!
  await shown.getByRole('button', { name: 'Supprimer l’élément' }).click()
  await expect.poll(hallElements).toBe(before - 1)
  await page.keyboard.press('Control+z')
  await expect.poll(hallElements).toBe(before)
  await expect(async () => {
    await clickCell(page, 14, 9)
    await expect(shown).toBeVisible({ timeout: 1000 })
  }).toPass()
  await page.keyboard.press('Delete')
  await expect.poll(hallElements).toBe(before - 1)
})
