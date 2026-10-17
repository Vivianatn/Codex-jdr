import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { disableAppAnimations } from './support/a11y'
import { createAccount } from './support/app'

/**
 * Legal duties seen from the app (D-271): consent recorded at sign-up, the
 * account's data downloaded from the server, the version and alpha status shown.
 */

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await disableAppAnimations(page)
  await page.goto('/app/')
  await createAccount(page, 'Ysolde')
})

test('downloads what the server keeps about the account, with the terms accepted at sign-up', async ({
  page,
}) => {
  await expect(page.getByTestId('alpha-badge')).toHaveAttribute('href', '/cgu#alpha')
  await page.getByRole('button', { name: 'Ouvrir les paramètres' }).click()
  await expect(page.getByTestId('app-version')).toContainText('version alpha')

  const privacy = page.getByTestId('privacy-section')
  const downloadPromise = page.waitForEvent('download')
  await privacy.getByRole('button', { name: 'Télécharger mes données' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^codex-mes-donnees-\d{4}-\d{2}-\d{2}\.json$/)
  const data = JSON.parse(await readFile(await download.path(), 'utf8'))
  expect(data.format).toBe('codex-account-export')
  expect(data.account.displayName).toBe('Ysolde')
  // The sign-up form recorded the terms and the age on the server.
  expect(data.account.terms).toMatchObject({ age: '15+' })
  expect(data.account.terms.version).toMatch(/^\d{4}-\d{2}-\d{2}$/)
})
