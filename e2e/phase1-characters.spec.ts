import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { expectNoSeriousA11yViolations } from './support/a11y'

const STATS = [
  'Force',
  'Constitution',
  'Dextérité',
  'Intelligence',
  'Charisme',
  'Sagesse',
  'Chance',
]

async function createCampaign(page: Page, name: string) {
  await page.getByRole('button', { name: 'Nouvelle campagne' }).first().click()
  await page.getByLabel('Nom').fill(name)
  await page.getByRole('button', { name: 'Créer' }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
}

async function next(page: Page) {
  await page.getByRole('button', { name: /Suivant/ }).click()
}

/** Runs the whole wizard with pre-rolled values; `audit` checks every step with axe. */
async function createPlayer(page: Page, pseudo: string, audit = false) {
  await page.getByRole('link', { name: 'Joueurs', exact: true }).click()
  await page.getByRole('link', { name: 'Nouveau joueur' }).first().click()
  await expect(page.getByRole('heading', { name: 'Nouveau joueur' })).toBeVisible()

  await page.getByLabel(/Pseudo/).fill(pseudo)
  await page.getByLabel('Nom Discord').fill(`${pseudo.toLowerCase()}#0001`)
  await page.getByLabel('Classe').fill('Barbare')
  if (audit) await expectNoSeriousA11yViolations(page)
  await next(page)

  for (const [i, stat] of STATS.entries()) await page.getByLabel(stat).fill(String(8 + i))
  if (audit) await expectNoSeriousA11yViolations(page)
  await next(page)

  await page.getByLabel('Jet de PV (1d20)').fill('14')
  await expect(page.getByText('10 + 14 + 1 = 25')).toBeVisible()
  await next(page)

  const add = async (group: string, name: string) => {
    await page.getByRole('button', { name: `Ajouter : ${group}` }).click()
    await page.getByRole('dialog').getByLabel('Nom').fill(name)
    await page.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click()
  }
  await expect(page.getByRole('button', { name: /Suivant/ })).toBeDisabled()
  await add('Compétences actives', 'Rage')
  await add('Compétences actives', 'Cri de guerre')
  await add('Compétences passives', 'Endurci')
  await add('Passif de classe', 'Peau de pierre')
  if (audit) await expectNoSeriousA11yViolations(page)
  await next(page)

  await page.getByLabel('Ajouter un objet').fill('Potion de soin')
  await page.getByLabel('Quantité').last().fill('2')
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click()
  await next(page)
  if (audit) await expectNoSeriousA11yViolations(page)
  await page.getByRole('button', { name: 'Créer la fiche' }).click()
  await expect(page.getByRole('heading', { level: 1, name: pseudo })).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
})

test('scenario 1: create a player with the wizard and copy the sheet for Discord', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await createCampaign(page, 'La Crypte')
  await createPlayer(page, 'Gorak')

  await page.getByRole('button', { name: 'Copier pour Discord' }).click()
  await expect(page.getByText('Fiche copiée')).toBeVisible()
  const markdown = await page.evaluate(() => navigator.clipboard.readText())
  expect(markdown).toContain('# fiche gorak#0001')
  expect(markdown).toContain('- PV(points de vie): 25/25 (10 + 14 + 1)')
  expect(markdown).toContain('- Force : 8')
  expect(markdown).toContain('- Chance : 14')
  expect(markdown).toContain('- [Passif de classe] Peau de pierre')
  expect(markdown).toContain('- Potion de soin x2')

  // The sheet survives a reload (auto-save to IndexedDB).
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Gorak' })).toBeVisible()
})

test('scenario 2 (part): create a Gobelin template and add 5 numbered copies', async ({ page }) => {
  await createCampaign(page, 'Gobelins')
  await page.getByRole('link', { name: 'Bestiaire' }).click()
  await page.getByRole('link', { name: 'Nouveau modèle' }).first().click()
  await page.getByLabel(/Pseudo/).fill('Gobelin')
  await next(page)
  for (const stat of STATS) await page.getByLabel(stat).fill('8')
  await next(page)
  await page.getByLabel('Jet de PV (1d20)').fill('4')
  await next(page)
  await next(page) // skills are optional for enemies
  await next(page)
  await page.getByRole('button', { name: 'Créer la fiche' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Gobelin' })).toBeVisible()

  await page.getByRole('button', { name: 'Ajouter à la campagne : Gobelin' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Nombre d’exemplaires').fill('5')
  await expect(dialog.getByText('de « Gobelin 1 » à « Gobelin 5 »')).toBeVisible()
  await dialog.getByRole('button', { name: 'Ajouter' }).click()

  await page.getByRole('link', { name: 'Retour à la liste' }).click()
  const instances = page.getByRole('list', { name: 'Ennemis de la campagne' })
  for (let n = 1; n <= 5; n++)
    await expect(instances.getByText(`Gobelin ${n}`, { exact: true })).toBeVisible()
  await expectNoSeriousA11yViolations(page)

  // In play mode, the enemies appear in the quick-access bar.
  await page.getByRole('radio', { name: 'En jeu' }).click()
  await expect(
    page.getByRole('complementary', { name: 'Accès rapide' }).getByText('Gobelin 5'),
  ).toBeVisible()
})

test('scenario 7: export, delete and re-import a campaign with its characters', async ({
  page,
}) => {
  await createCampaign(page, 'Sauvegarde')
  await createPlayer(page, 'Lyra')
  await page.getByRole('button', { name: 'Retour aux campagnes' }).click()

  await page.getByRole('button', { name: /Plus d’actions — Sauvegarde/ }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: 'Exporter' }).click()
  const file = JSON.parse(await readFile(await (await downloadPromise).path(), 'utf8'))
  expect(file).toMatchObject({ format: 'codex-campaign', version: 2 })
  expect(file.entities).toHaveLength(1)

  const dump = () =>
    page.evaluate(
      () =>
        new Promise((resolve) => {
          const req = indexedDB.open('codex')
          req.onsuccess = () => {
            const tx = req.result.transaction(['campaigns', 'entities'])
            const c = tx.objectStore('campaigns').getAll()
            const e = tx.objectStore('entities').getAll()
            tx.oncomplete = () => resolve({ campaigns: c.result, entities: e.result })
          }
        }),
    )
  const before = await dump()

  await page.getByRole('button', { name: /Plus d’actions — Sauvegarde/ }).click()
  await page.getByRole('menuitem', { name: 'Supprimer' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click()
  await expect(page.getByText('Aucune campagne pour l’instant')).toBeVisible()
  expect(await dump()).toEqual({ campaigns: [], entities: [] })

  await page.getByTestId('campaign-import-input').setInputFiles({
    name: 'export.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(file)),
  })
  await expect(page.getByRole('link', { name: /Sauvegarde/ })).toBeVisible()
  expect(await dump()).toEqual(before)
})

for (const theme of ['light', 'dark'] as const) {
  test(`character screens have no serious accessibility violations (${theme})`, async ({
    page,
  }) => {
    if (theme === 'dark') await page.getByRole('button', { name: 'Changer de thème' }).click()
    await createCampaign(page, 'Accessible')
    await createPlayer(page, 'Gorak', true)

    for (const tab of [
      'Identité',
      'Statistiques',
      'Compétences',
      'État',
      'Inventaire',
      'Journal',
    ]) {
      await page.getByRole('tab', { name: tab }).click()
      await expectNoSeriousA11yViolations(page)
    }

    await page.getByRole('link', { name: 'Retour à la liste' }).click()
    await expect(page.getByRole('link', { name: 'Ouvrir la fiche de Gorak' })).toBeVisible()
    await expectNoSeriousA11yViolations(page)

    await page.getByRole('button', { name: 'Importer depuis Discord' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expectNoSeriousA11yViolations(page)
    await page.keyboard.press('Escape')

    await page.getByRole('link', { name: 'Règles' }).click()
    await expect(page.getByRole('heading', { name: 'Règles de la campagne' })).toBeVisible()
    await expectNoSeriousA11yViolations(page)
  })
}
