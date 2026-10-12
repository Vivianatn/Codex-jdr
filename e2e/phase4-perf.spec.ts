import { expect, test } from '@playwright/test'
import { disableAppAnimations } from './support/a11y'
import { createCampaign, importCharacter, createAccount, reloadAndUnlock } from './support/app'

/**
 * SPEC §11 performance budget: 200 tokens, zoom and pan stay smooth.
 * Run alone with `npm run test:perf` (excluded from test:e2e: parallel workers
 * skew the frame rate). The measured FPS is printed (see DECISIONS D-233); the assertion keeps a
 * wide margin so the test is not flaky on slower machines.
 */
const TOKENS = Number(process.env.PERF_TOKENS ?? 200)

test('200 tokens: zoom and pan stay fluid @perf', async ({ page }) => {
  test.setTimeout(120_000)
  await disableAppAnimations(page)
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.goto('/app/')
  await createAccount(page)
  await createCampaign(page, 'Perf')
  await importCharacter(page, 'Joueurs', { name: 'Modèle', hp: 20 })
  await page.getByRole('link', { name: 'Cartes', exact: true }).click()
  await page.getByRole('button', { name: 'Nouvelle carte' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nouvelle carte' })
  await dialog.getByLabel('Nom').fill('Grande plaine')
  await dialog.getByLabel('Colonnes').fill('40')
  await dialog.getByLabel('Lignes').fill('40')
  await dialog.getByLabel('Lignes').blur()
  await dialog.getByRole('button', { name: 'Nouvelle carte' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Grande plaine' })).toBeVisible()
  await page.waitForTimeout(500) // autosave

  // Seed 200 characters and their tokens through the app's database layer, then reload.
  await page.evaluate(async (count) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DEV hook, untyped on purpose
    const db = (window as unknown as { __codexDb: any }).__codexDb
    const [model] = await db.entities.toArray()
    const [map] = await db.maps.toArray()
    map.tokens = []
    const entities: unknown[] = []
    for (let i = 0; i < count; i++) {
      const id = crypto.randomUUID()
      entities.push({ ...model, id, identity: { ...model.identity, pseudo: `Jeton ${i + 1}` } })
      map.tokens.push({
        id: crypto.randomUUID(),
        entityId: id,
        col: i % 20,
        row: Math.floor(i / 20) * 2,
        size: 1,
        hidden: false,
      })
    }
    await db.transaction('rw', db.entities, db.maps, async () => {
      await db.entities.bulkPut(entities)
      await db.maps.put(map)
    })
  }, TOKENS)
  await reloadAndUnlock(page)
  await expect(page.getByTestId('map-canvas')).toBeVisible()
  const box = (await page.getByTestId('map-canvas').boundingBox())!
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2

  await page.evaluate(() => {
    const w = window as unknown as { __frames: number; __stop: boolean }
    w.__frames = 0
    w.__stop = false
    const tick = () => {
      w.__frames++
      if (!w.__stop) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  const start = Date.now()
  await page.mouse.move(cx, cy)
  for (let i = 0; i < 20; i++) await page.mouse.wheel(0, i < 10 ? -120 : 120)
  for (let i = 0; i < 3; i++) {
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    for (let s = 1; s <= 20; s++) await page.mouse.move(cx + s * 10, cy + s * 6)
    await page.mouse.up()
  }
  const frames = await page.evaluate(() => {
    const w = window as unknown as { __frames: number; __stop: boolean }
    w.__stop = true
    return w.__frames
  })
  const fps = frames / ((Date.now() - start) / 1000)
  console.log(`${TOKENS} tokens — ${fps.toFixed(1)} FPS during zoom and pan`)
  expect(fps).toBeGreaterThan(20)
})
