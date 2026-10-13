import { expect, test, type Page } from '@playwright/test'
import { disableAppAnimations } from './support/a11y'
import { createAccount, startGame } from './support/app'

/**
 * No horizontal scrolling anywhere (DA): everything must be reachable as it
 * is shown. Walks every screen of the example campaign at several sizes and
 * lists each element that scrolls sideways (and the page itself).
 */

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'laptop', width: 1280, height: 720 },
  { name: 'small laptop', width: 1024, height: 768 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'half-screen window', width: 620, height: 800 },
  { name: 'phone', width: 390, height: 844 },
]

/** Elements scrolling sideways, described so they can be found in the code. */
function sideways(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const describe = (el: Element) => {
      const parts: string[] = []
      let node: Element | null = el
      for (let depth = 0; node && depth < 4; depth++, node = node.parentElement) {
        const label =
          node.getAttribute('aria-label') ??
          node.getAttribute('data-testid') ??
          (node.id ? `#${node.id}` : null)
        parts.unshift(
          `${node.tagName.toLowerCase()}${label ? `[${label}]` : ''}.${String(node.className).split(' ').slice(0, 3).join('.')}`,
        )
      }
      return `${parts.join(' > ')} (${el.scrollWidth} > ${el.clientWidth})`
    }
    const found: string[] = []
    const root = document.documentElement
    if (root.scrollWidth > root.clientWidth + 1)
      found.push(`page (${root.scrollWidth} > ${root.clientWidth})`)
    for (const el of document.querySelectorAll('body *')) {
      const style = getComputedStyle(el)
      // Toasts, dialogs, panels: fixed to the screen, they must not stick out of it.
      // (A fixed container may be empty itself — toasts — so its children are measured too.)
      if (style.position === 'fixed' && style.visibility !== 'hidden') {
        const out = [el, ...el.querySelectorAll('*')]
          .map((node) => node.getBoundingClientRect())
          .find(
            (r) => r.width > 0 && r.height > 0 && (r.left < -1 || r.right > window.innerWidth + 1),
          )
        if (out)
          found.push(
            `${describe(el)} hors de l'écran (${Math.round(out.left)}→${Math.round(out.right)})`,
          )
      }
      if (style.overflowX !== 'auto' && style.overflowX !== 'scroll') continue
      if (el.scrollWidth > el.clientWidth + 1) found.push(describe(el))
    }
    return found
  })
}

/**
 * Board screens fill the window: their panels scroll, never the page (a second,
 * useless scroll bar next to the panel's). Also checked with larger text.
 */
async function pageScrollsDown(page: Page, textSize?: string): Promise<string | null> {
  return page.evaluate(async (size) => {
    const root = document.documentElement
    const before = root.style.fontSize
    if (size) root.style.fontSize = size
    await new Promise((resolve) => setTimeout(resolve, 150))
    const height = root.scrollHeight
    root.style.fontSize = before
    return height > root.clientHeight + 1 ? `page (${height} > ${root.clientHeight})` : null
  }, textSize)
}

const SECTIONS = [
  'Tableau de bord',
  'Joueurs',
  'Bestiaire',
  'Alliés et familiers',
  'Compétences',
  'Objets',
  'États',
  'Cartes',
  'Sessions',
  'Notes',
  'Règles',
]

for (const viewport of VIEWPORTS) {
  test(`no horizontal scrolling — ${viewport.name} @layout`, async ({ page }) => {
    test.setTimeout(240_000)
    await disableAppAnimations(page)
    await page.setViewportSize(viewport)
    await page.goto('/app/')
    const problems: string[] = []
    const check = async (screen: string, target: Page = page) => {
      await target.waitForTimeout(150)
      for (const p of await sideways(target)) problems.push(`${screen}: ${p}`)
    }
    await expect(page.getByRole('heading', { name: 'Bienvenue dans Codex' })).toBeVisible()
    await check('connexion')
    await createAccount(page)
    await check('campagnes')
    const homeMode = page.getByRole('radiogroup', { name: 'Je joue en tant que' })
    await homeMode.getByRole('radio', { name: 'Joueur' }).click()
    await check('mes parties')
    await homeMode.getByRole('radio', { name: 'MJ' }).click()

    await page
      .getByTestId('campaign-import-input')
      .setInputFiles('exemples/campagne-test-ombreval.json')
    await page.getByRole('link', { name: /Ombreval/ }).click()
    await expect(page.getByRole('radiogroup', { name: 'Mode' })).toBeVisible()
    for (const section of SECTIONS) {
      await page.getByRole('link', { name: section, exact: true }).click()
      await check(section)
    }

    // Character creation: the wizard and the Discord import.
    await page.getByRole('link', { name: 'Joueurs', exact: true }).click()
    await page.getByRole('link', { name: 'Nouveau joueur' }).first().click()
    await check('assistant de création')
    await page.getByRole('link', { name: 'Joueurs', exact: true }).click()
    await page.getByRole('button', { name: 'Importer depuis Discord' }).first().click()
    await check('import Discord')
    await page.keyboard.press('Escape')

    // A full sheet, every tab.
    await page.getByRole('link', { name: 'Joueurs', exact: true }).click()
    await page.getByRole('link', { name: /Gorak/ }).first().click()
    for (const tab of await page.getByRole('tab').all()) {
      await tab.click()
      await check(`fiche › ${await tab.textContent()}`)
    }

    // A session plan, the map editor.
    await page.getByRole('link', { name: 'Sessions', exact: true }).click()
    await page.getByRole('link', { name: 'La Crypte d’Ombreval' }).click()
    await check('session')
    await page.getByRole('link', { name: 'Cartes', exact: true }).click()
    await page.getByRole('link', { name: 'Crypte d’Ombreval' }).click()
    await check('éditeur de carte')
    // On phones the menu stacks above the board: the page scrolls down there, as it should.
    const textSizes = viewport.width >= 768 ? [undefined, '125%', '150%'] : [undefined]
    for (const size of textSizes) {
      const down = await pageScrollsDown(page, size)
      if (down)
        problems.push(
          `éditeur de carte${size ? ` (texte ${size})` : ''} : défile en hauteur, ${down}`,
        )
    }

    // Play: start panel, then the table, the quick panel and the sheet drawer.
    await page
      .getByRole('radiogroup', { name: 'Mode' })
      .getByRole('radio', { name: 'En jeu' })
      .click()
    await check('démarrage')
    await startGame(page)
    await check('en jeu')
    const down = await pageScrollsDown(page)
    if (down) problems.push(`en jeu : défile en hauteur, ${down}`)
    const quick = page.getByRole('button', { name: 'Manipuler Gorak' }).first()
    if (await quick.isVisible()) {
      await quick.click()
      await check('en jeu › manipulation rapide')
      await page.keyboard.press('Escape')
    }

    // The players' window.
    const campaignId = page.url().match(/#\/c\/([^/]+)/)![1]!
    const players = await page.context().newPage()
    await players.setViewportSize(viewport)
    await players.goto(`/app/#/c/${campaignId}/view`)
    await expect(players.getByTestId('map-canvas')).toBeVisible()
    await check('vue joueurs', players)
    await players.close()

    await page.getByRole('button', { name: 'Ouvrir les paramètres' }).click()
    await check('paramètres')
    await page.keyboard.press('Escape')
    await page.getByTestId('online-button').click()
    await check('panneau en ligne')

    expect(problems).toEqual([])
  })
}
