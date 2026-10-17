import { existsSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import type { Connect, Plugin } from 'vite'
import { APP_PATH, PAGES, SITE, type SitePage } from './config.ts'

/** The administration dashboard (D-275), its own Vite entry admin/index.html. */
export const ADMIN_PATH = '/admin'

/**
 * Builds the public website (D-248) around the app: shared head (title,
 * description, canonical, social cards), icons, header and footer injected
 * into each page, `{{site.…}}` facts replaced, robots.txt and sitemap.xml
 * emitted, pretty URLs and the custom 404 in the dev and preview servers.
 */

const escape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function pageOf(root: string, filename: string): SitePage | undefined {
  const file = relative(root, filename).replace(/\\/g, '/')
  return PAGES.find((p) => p.file === file)
}

function head(page: SitePage): string {
  const url = `${SITE.url}${page.path === '/404' ? '/' : page.path}`
  const image = `${SITE.url}${SITE.image}`
  return [
    `<title>${escape(page.title)}</title>`,
    `<meta name="description" content="${escape(page.description)}" />`,
    page.indexed
      ? `<link rel="canonical" href="${url}" />`
      : '<meta name="robots" content="noindex" />',
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE.name}" />`,
    `<meta property="og:locale" content="${SITE.locale}" />`,
    `<meta property="og:title" content="${escape(page.title)}" />`,
    `<meta property="og:description" content="${escape(page.description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${escape(SITE.imageAlt)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escape(page.title)}" />`,
    `<meta name="twitter:description" content="${escape(page.description)}" />`,
    `<meta name="twitter:image" content="${image}" />`,
    `<meta name="twitter:image:alt" content="${escape(SITE.imageAlt)}" />`,
  ].join('\n    ')
}

const ICONS = [
  '<link rel="icon" href="/favicon.svg" type="image/svg+xml" />',
  '<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png" />',
  '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />',
  '<link rel="manifest" href="/site.webmanifest" />',
].join('\n    ')

const HEADER = `<header class="site-header">
      <a class="site-brand" href="/" aria-label="Codex, accueil">
        <img src="/favicon.svg" alt="" width="28" height="28" />
        <span>Codex</span>
      </a>
      <a class="site-alpha" href="/cgu#alpha" title="Version alpha : ce que cela implique">Alpha</a>
    </header>`

/**
 * Every page links to the legal pages (LCEN, RGPD, CNIL cookies, RGAA: the
 * accessibility status is a mandatory mention, décret 2019-768 art. 4) and to
 * the single point of contact for reports (DSA art. 11, 12 and 16).
 */
const FOOTER = `<footer class="site-footer">
      <nav aria-label="Informations légales">
        <ul>
          <li><a href="/mentions-legales">Mentions légales</a></li>
          <li><a href="/confidentialite">Confidentialité</a></li>
          <li><a href="/confidentialite#cookies">Cookies</a></li>
          <li><a href="/cgu">Conditions d’utilisation</a></li>
          <li><a href="/accessibilite">Accessibilité : ${escape(SITE.accessibility.status)}</a></li>
          <li><a href="/contact">Contact et signalement</a></li>
          <li><button type="button" class="site-link" data-consent-open>Mesure d’audience</button></li>
        </ul>
      </nav>
      <p>© ${new Date().getFullYear()} ${SITE.name}, ${SITE.tagline.toLowerCase()}. Version ${escape(SITE.version)}.</p>
    </footer>`

/** `{{site.publisher.email}}` → the value from SITE (escaped). */
function facts(html: string): string {
  return html.replace(/\{\{site\.([\w.]+)\}\}/g, (match, path: string) => {
    const value = path
      .split('.')
      .reduce<unknown>((obj, key) => (obj as Record<string, unknown> | undefined)?.[key], SITE)
    if (typeof value !== 'string') throw new Error(`Unknown site fact ${match}`)
    return escape(value)
  })
}

export function robotsTxt(): string {
  return [
    'User-agent: *',
    'Allow: /',
    `Disallow: ${APP_PATH}`,
    // Administration dashboard (D-275): never indexed.
    `Disallow: ${ADMIN_PATH}`,
    '',
    `Sitemap: ${SITE.url}/sitemap.xml`,
    '',
  ].join('\n')
}

export function sitemapXml(): string {
  const urls = PAGES.filter((p) => p.indexed)
    .map(
      (p) =>
        `  <url><loc>${SITE.url}${p.path}</loc><priority>${(p.priority ?? 0.5).toFixed(1)}</priority></url>`,
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

/** Pretty URLs (/cgu → cgu.html) and the custom 404, like the production server (deploy/Caddyfile). */
function prettyUrls(root: string): Connect.NextHandleFunction {
  return (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const path = decodeURIComponent(url.pathname)
    // The online server's API and socket go on to the proxy (D-262).
    if (path.startsWith('/api/')) return next()
    if (path === '/robots.txt' || path === '/sitemap.xml') {
      res.setHeader('Content-Type', path.endsWith('.xml') ? 'application/xml' : 'text/plain')
      res.end(path === '/robots.txt' ? robotsTxt() : sitemapXml())
      return
    }
    // Administration dashboard (D-275): /admin and /admin/ serve its page, never indexed.
    if (path === ADMIN_PATH || path === `${ADMIN_PATH}/`) {
      res.setHeader('X-Robots-Tag', 'noindex, nofollow')
      req.url = `${ADMIN_PATH}/index.html${url.search}`
      return next()
    }
    const page = PAGES.find((p) => p.path === path && p.path !== '/')
    if (page) {
      req.url = `/${page.file}${url.search}`
      return next()
    }
    // Anything that is not a page, the app, a module or a file gets the 404 page.
    const known =
      path === '/' ||
      path.startsWith(APP_PATH.slice(0, -1)) ||
      path.startsWith('/@') ||
      path.startsWith('/src/') ||
      path.startsWith('/node_modules/') ||
      path.startsWith('/site/') ||
      path.startsWith('/assets/') ||
      path.endsWith('.html') ||
      existsSync(resolve(root, `.${path}`)) ||
      existsSync(resolve(root, 'public', `.${path}`))
    if (!known) {
      // Vite's HTML middleware answers 200: keep the 404 status whatever it sets.
      const writeHead = res.writeHead.bind(res) as (...args: unknown[]) => typeof res
      res.writeHead = ((_status: number, ...rest: unknown[]) =>
        writeHead(404, ...rest)) as typeof res.writeHead
      res.statusCode = 404
      req.url = '/404.html'
    }
    next()
  }
}

export function sitePlugin(): Plugin {
  let root = process.cwd()
  let outDir = 'dist'
  return {
    name: 'codex-site',
    configResolved(config) {
      root = config.root
      outDir = config.build.outDir
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const page = pageOf(root, ctx.filename)
        let out = html.replace('<!-- site:icons -->', ICONS)
        if (page)
          out = out
            .replace('<!-- site:head -->', head(page))
            .replace('<!-- site:header -->', HEADER)
            .replace('<!-- site:footer -->', FOOTER)
        return facts(out)
      },
    },
    configureServer(server) {
      server.middlewares.use(prettyUrls(root))
    },
    configurePreviewServer(server) {
      server.middlewares.use(prettyUrls(resolve(root, outDir)))
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robotsTxt() })
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemapXml() })
    },
  }
}

/** Rollup inputs: every site page plus the app. */
export function siteInputs(root: string): Record<string, string> {
  return {
    ...Object.fromEntries(PAGES.map((p) => [p.file.replace(/\.html$/, ''), resolve(root, p.file)])),
    app: resolve(root, 'app/index.html'),
    admin: resolve(root, 'admin/index.html'),
  }
}
