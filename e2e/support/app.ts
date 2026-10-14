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

/** Password of the account every scenario creates (a valid passphrase, D-241). */
export const E2E_PASSWORD = 'lanterne verte sous le pont de grès'

/** First launch: creates the account and goes through the recovery code step. */
export async function createAccount(page: Page, username = 'MJ') {
  await expect(page.getByRole('heading', { name: 'Bienvenue dans Codex' })).toBeVisible()
  await page.getByRole('button', { name: 'Créer un compte', exact: true }).click()
  await page.getByLabel(/Nom du compte/).fill(username)
  await page.getByLabel(/^Mot de passe/).fill(E2E_PASSWORD)
  await page.getByLabel('Confirme le mot de passe').fill(E2E_PASSWORD)
  await page.getByRole('button', { name: 'Créer le compte' }).click()
  await expect(page.getByTestId('recovery-code')).toBeVisible({ timeout: 15_000 })
  await page.getByLabel(/J’ai rangé ce code/).check()
  await page.getByRole('button', { name: 'Continuer' }).click()
  await expect(page.getByTestId('lock-screen')).toBeHidden()
}

/** After a reload: the key was only in memory, the password is asked again. */
export async function unlock(page: Page) {
  await page.getByLabel(/^Mot de passe/).fill(E2E_PASSWORD)
  await page.getByRole('button', { name: 'Déverrouiller' }).click()
  await expect(page.getByTestId('lock-screen')).toBeHidden({ timeout: 15_000 })
}

/** Reloads the page and unlocks again. */
export async function reloadAndUnlock(page: Page) {
  await page.reload()
  await unlock(page)
}

/**
 * Reads every row of a table, decrypted, through the DEV hook of the session
 * (the IndexedDB files themselves are encrypted).
 */
export function dumpTable(page: Page, table: string) {
  return page.evaluate(
    (name) =>
      (
        window as unknown as { __codexDb: { table(n: string): { toArray(): Promise<unknown[]> } } }
      ).__codexDb
        .table(name)
        .toArray(),
    table,
  )
}

/** Writes rows (decrypted form) through the DEV hook, like the app would. */
export function putRows(page: Page, table: string, rows: unknown[]) {
  return page.evaluate(
    ([name, values]) =>
      (
        window as unknown as {
          __codexDb: { table(n: string): { bulkPut(v: unknown[]): Promise<unknown> } }
        }
      ).__codexDb
        .table(name as string)
        .bulkPut(values as unknown[]),
    [table, rows] as const,
  )
}

/** The play screen starts empty: games start by hand (D-244). Starts a free local game. */
export async function startGame(page: Page) {
  await page.getByTestId('start-play').getByRole('button', { name: 'Démarrer la partie' }).click()
  await expect(page.getByRole('main', { name: 'Plateau de jeu' })).toBeVisible()
}
