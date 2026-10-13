import { expect, test, type Page } from '@playwright/test'
import { disableAppAnimations, expectNoSeriousA11yViolations } from './support/a11y'
import { createAccount, createCampaign, dumpTable } from './support/app'

interface StoredMap {
  id: string
  name: string
  elements: { kind: string; x: number; y: number; link?: { mapId: string | null } }[]
}

/** Clicks the centre of a cell on the board shown in the door dialog (DEV hook). */
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

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await disableAppAnimations(page)
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.goto('/app/')
  await createAccount(page)
})

test('a session is built as a route of maps, with its doors placed on the board (D-258)', async ({
  page,
}) => {
  await createCampaign(page, 'La crypte')
  await page.getByRole('link', { name: 'Sessions', exact: true }).click()
  await page.getByRole('button', { name: 'Nouvelle session' }).first().click()
  await expect(page.getByText('Aucune carte pour l’instant')).toBeVisible()

  // Two rooms, created from the session itself.
  for (const name of ['Hall', 'Cave']) {
    await page.getByLabel('Nom de la nouvelle carte').fill(name)
    await page.getByRole('button', { name: 'Nouvelle carte' }).click()
  }
  const steps = page.getByTestId('route-step')
  await expect(steps).toHaveCount(2)
  await expect(steps.nth(0)).toContainText('Hall')
  await expect(steps.nth(1)).toContainText('Cave')
  await expectNoSeriousA11yViolations(page)

  // A door in the hall towards the cellar, then the way back.
  await steps.nth(0).getByRole('button', { name: 'Poser une porte' }).click()
  const dialog = page.getByRole('dialog', { name: 'Porte dans « Hall »' })
  await expect(dialog.getByLabel('Elle mène à')).toHaveValue(/.+/)
  await clickCell(page, 3, 3)
  await expect(page.getByRole('dialog', { name: 'Arrivée dans « Cave »' })).toBeVisible()
  await clickCell(page, 1, 2)
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await expect(steps.nth(0)).toContainText('vers 2. Cave')
  await expect(steps.nth(1)).toContainText('vers 1. Hall')
  // Maps are saved a moment after the change (auto-save).
  const stored = async () => (await dumpTable(page, 'maps')) as StoredMap[]
  await expect.poll(async () => (await stored()).every((m) => m.elements.length === 1)).toBe(true)
  const hall = (await stored()).find((m) => m.name === 'Hall')!
  const cave = (await stored()).find((m) => m.name === 'Cave')!
  expect(hall.elements).toEqual([
    expect.objectContaining({ kind: 'link', x: 3, y: 3, link: { mapId: cave.id } }),
  ])
  expect(cave.elements).toEqual([
    expect.objectContaining({ kind: 'link', x: 1, y: 2, link: { mapId: hall.id } }),
  ])

  // Order of appearance: the cellar first.
  await steps.nth(0).getByRole('button', { name: 'Reculer « Hall » d’une étape' }).click()
  await expect(steps.nth(0)).toContainText('Cave')
  await expect
    .poll(async () => ((await dumpTable(page, 'sessions')) as { mapIds: string[] }[])[0]!.mapIds)
    .toEqual([cave.id, hall.id])
})
