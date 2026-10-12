/**
 * Generates the pictures of the public website (D-248), compressed:
 * favicons (PNG 32, 180, 192, 512 from public/favicon.svg), the social
 * sharing card (public/og-image.png, 1200 × 630) and the landing screenshot
 * (public/images/plateau.webp, from `npm run screens`).
 *
 * Run: node scripts/brand-assets.ts   (after `npm run screens` for the screenshot)
 * The outputs are committed; rerun only when the brand or the app's look changes.
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import sharp from 'sharp'

const root = resolve(import.meta.dirname, '..')
const pub = (file: string) => resolve(root, 'public', file)
const font = (path: string) =>
  `data:font/woff2;base64,${readFileSync(resolve(root, 'node_modules', path)).toString('base64')}`

async function favicons() {
  const svg = readFileSync(pub('favicon.svg'))
  for (const [file, size] of [
    ['favicon-32.png', 32],
    ['apple-touch-icon.png', 180],
    ['icon-192.png', 192],
    ['icon-512.png', 512],
  ] as const) {
    let image = sharp(svg, { density: 72 * (size / 32) * 2 }).resize(size, size)
    // iOS draws the touch icon on black: give it the parchment background.
    if (file === 'apple-touch-icon.png') image = image.flatten({ background: '#110d0a' })
    await image.png({ compressionLevel: 9, palette: true }).toFile(pub(file))
  }
}

const SCREENSHOT = resolve(root, 'test-results/screens/dark-11-play.png')

/** Landing pictures (public/images), from `npm run screens`. */
const PICTURES: Record<string, string> = {
  'plateau.webp': 'dark-11-play.png',
  'table.webp': 'dark-10-quick-panel.png',
  'fiche.webp': 'dark-04-sheet-identity.png',
}

async function screenshot() {
  mkdirSync(pub('images'), { recursive: true })
  for (const [out, source] of Object.entries(PICTURES)) {
    const file = resolve(root, 'test-results/screens', source)
    if (!existsSync(file)) {
      console.warn(`No ${source}: run \`npm run screens\` first to refresh ${out}.`)
      continue
    }
    await sharp(file)
      .resize({ width: 1200 })
      .webp({ quality: 78, effort: 6 })
      .toFile(pub(`images/${out}`))
  }
}

async function socialCard() {
  const logo = readFileSync(pub('favicon.svg'), 'utf8')
  const shot = existsSync(SCREENSHOT)
    ? `data:image/png;base64,${readFileSync(SCREENSHOT).toString('base64')}`
    : null
  const html = `<!doctype html><html><head><style>
    @font-face { font-family: 'Alegreya SC'; font-weight: 700; src: url(${font('@fontsource/alegreya-sc/files/alegreya-sc-latin-700-normal.woff2')}); }
    @font-face { font-family: 'Alegreya'; font-weight: 400 900; src: url(${font('@fontsource-variable/alegreya/files/alegreya-latin-wght-normal.woff2')}); }
    @font-face { font-family: 'Source Sans 3'; font-weight: 200 900; src: url(${font('@fontsource-variable/source-sans-3/files/source-sans-3-latin-wght-normal.woff2')}); }
    * { margin: 0; box-sizing: border-box; }
    body { width: 1200px; height: 630px; overflow: hidden; background: #110d0a; color: #f2eadd;
      font-family: 'Source Sans 3'; position: relative; }
    .glow { position: absolute; inset: 0; background: radial-gradient(ellipse 60% 70% at 20% 40%, rgba(163,48,42,0.22), transparent 70%); }
    .text { position: absolute; left: 72px; top: 110px; width: 560px; }
    .logo { width: 72px; height: 72px; margin-bottom: 28px; }
    .logo svg { width: 100%; height: 100%; }
    h1 { font-family: 'Alegreya SC'; font-weight: 700; font-size: 92px; letter-spacing: 0.04em; line-height: 1; }
    p { font-family: 'Alegreya'; font-size: 38px; line-height: 1.25; color: #d9cfbe; margin-top: 22px; }
    .tags { margin-top: 36px; font-size: 24px; color: #ebc274; letter-spacing: 0.04em; }
    .shot { position: absolute; left: 660px; top: 90px; width: 760px; border-radius: 18px;
      border: 1px solid #c9963a; box-shadow: 0 30px 80px rgba(0,0,0,0.6); }
  </style></head><body><div class="glow"></div>
    <div class="text"><div class="logo">${logo}</div><h1>Codex</h1>
      <p>Le grimoire du maître du jeu</p>
      <div class="tags">Fiches · Dés · Plateau · Parties en ligne</div></div>
    ${shot ? `<img class="shot" src="${shot}" alt="">` : ''}
  </body></html>`
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
  await page.setContent(html, { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  const png = await page.screenshot({ type: 'png' })
  await browser.close()
  await sharp(png)
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toFile(pub('og-image.png'))
}

await favicons()
await screenshot()
await socialCard()
console.log('Brand assets written to public/.')
