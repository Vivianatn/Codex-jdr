import { expect, type Page } from '@playwright/test'

export const STATS = [
  'Force',
  'Constitution',
  'Dextérité',
  'Intelligence',
  'Charisme',
  'Sagesse',
  'Chance',
]

export async function createCampaign(page: Page, name: string) {
  await page.getByRole('button', { name: 'Nouvelle campagne' }).first().click()
  await page.getByLabel('Nom').fill(name)
  await page.getByRole('button', { name: 'Créer' }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
}

/** Fast character creation through the Discord import (players or allies page). */
export async function importCharacter(
  page: Page,
  section: 'Joueurs' | 'Alliés et familiers',
  sheet: { name: string; hp: number; stats?: number; level?: number; extra?: string[] },
) {
  await page.getByRole('link', { name: section, exact: true }).click()
  await page.getByRole('button', { name: 'Importer depuis Discord' }).first().click()
  const lines = [
    `# fiche ${sheet.name.toLowerCase()}`,
    '## Identité :',
    `- Pseudo : ${sheet.name}`,
    '## Statistiques :',
    `- Niveau : ${sheet.level ?? 1}`,
    `- PV(points de vie): ${sheet.hp}`,
    ...STATS.map((s) => `- ${s} : ${sheet.stats ?? 12}`),
    ...(sheet.extra ?? []),
  ]
  await page.getByRole('textbox', { name: 'Fiche Discord' }).fill(lines.join('\n'))
  await page.getByRole('button', { name: 'Importer la fiche' }).click()
  await expect(page.getByRole('heading', { level: 1, name: sheet.name })).toBeVisible()
}

/** Reads every row of an IndexedDB table of the app. */
export function dumpTable(page: Page, table: string) {
  return page.evaluate(
    (name) =>
      new Promise<unknown[]>((resolve) => {
        const req = indexedDB.open('codex')
        req.onsuccess = () => {
          const get = req.result.transaction(name).objectStore(name).getAll()
          get.onsuccess = () => resolve(get.result)
        }
      }),
    table,
  )
}
