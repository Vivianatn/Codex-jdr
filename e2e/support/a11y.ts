import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

/**
 * Runs axe once every animation has finished: contrast measured during a fade-in
 * (text still semi-transparent) would be a false positive.
 */
export async function expectNoSeriousA11yViolations(page: Page) {
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'))
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  )
  expect(
    serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([])
}

/**
 * Starts the app with its own "Animations : désactivées" setting, so audits and
 * assertions never run in the middle of a fade (axe would measure faded text).
 */
export async function disableAppAnimations(page: Page) {
  await page.addInitScript(() => {
    if (!localStorage.getItem('codex.settings'))
      localStorage.setItem(
        'codex.settings',
        JSON.stringify({ state: { theme: 'light', animations: 'off', locale: 'fr' }, version: 1 }),
      )
  })
}
