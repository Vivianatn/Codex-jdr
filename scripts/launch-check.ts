/**
 * Launch checklist (D-248): the 20 points to check before putting Codex online, plus the
 * legal points 21–24 of the public alpha (D-271),
 * verified on the production build (`dist/`). Points that need a browser
 * (contrast, responsive, forms, the notice) are checked by e2e/site.spec.ts,
 * run by `npm run launch:check` right after this script.
 *
 * Usage: node scripts/launch-check.ts [distDir]
 * Exit code 1 while any point fails. Never weaken a check to make it pass:
 * fix the site, or give the missing fact (site/config.ts).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { PAGES, SITE, TO_FILL } from '../site/config.ts'

const root = resolve(import.meta.dirname, '..')
const dist = resolve(root, process.argv[2] ?? 'dist')

type Status = 'ok' | 'fail' | 'browser'
interface Result {
  point: number
  label: string
  status: Status
  details: string[]
}
const results: Result[] = []

function check(point: number, label: string, run: () => string[] | 'browser'): void {
  try {
    const out = run()
    if (out === 'browser') results.push({ point, label, status: 'browser', details: [] })
    else results.push({ point, label, status: out.length ? 'fail' : 'ok', details: out })
  } catch (error) {
    results.push({ point, label, status: 'fail', details: [String(error)] })
  }
}

// ---- helpers --------------------------------------------------------------------

function files(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? files(path) : [path]
  })
}

const all = files(dist)
const htmlFiles = all.filter((f) => f.endsWith('.html'))
const read = (file: string) => readFileSync(file, 'utf8')
const rel = (file: string) => relative(dist, file).replace(/\\/g, '/')
const pageHtml = (file: string) => read(join(dist, file))
const sitePages = PAGES.filter((p) => existsSync(join(dist, p.file)))
const gz = (file: string) => gzipSync(readFileSync(file)).length
const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} kB`
const attr = (tag: string, name: string) =>
  tag.match(new RegExp(`\\s${name}="([^"]*)"`, 'i'))?.[1] ?? null
const tags = (html: string, name: string) => html.match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) ?? []
const caddy = existsSync(resolve(root, 'deploy/Caddyfile'))
  ? read(resolve(root, 'deploy/Caddyfile'))
  : ''

/** Every local URL a page points to (links, scripts, styles, pictures, icons). */
function localRefs(html: string): string[] {
  const refs = [...html.matchAll(/\s(?:href|src)="([^"]+)"/gi)].map((m) => m[1]!)
  return refs.filter((r) => r.startsWith('/') && !r.startsWith('//'))
}

/** What the production server answers for a path (deploy/Caddyfile: try_files). */
function resolves(path: string): boolean {
  const clean = decodeURIComponent(path.split(/[?#]/)[0]!)
  const candidates = [clean, `${clean}.html`, join(clean, 'index.html')]
  return candidates.some((c) => {
    const file = join(dist, c)
    return existsSync(file) && statSync(file).isFile()
  })
}

if (!htmlFiles.length) {
  console.error(`Aucun build dans ${dist} : lance d’abord « vite build ».`)
  process.exit(1)
}

// ---- the 20 points --------------------------------------------------------------

check(1, 'Page RGPD (confidentialité)', () => {
  const out: string[] = []
  if (!existsSync(join(dist, 'confidentialite.html'))) out.push('confidentialite.html absente')
  for (const p of sitePages)
    if (!pageHtml(p.file).includes('href="/confidentialite"'))
      out.push(`${p.file} : pas de lien vers /confidentialite`)
  if (!existsSync(join(dist, 'confidentialite.html'))) return out
  const html = pageHtml('confidentialite.html')
  for (const needed of [
    'Tes droits',
    'cnil.fr',
    'Combien de temps',
    'id="audience"',
    // D-271: every cookie and tracker listed, portability in the product, recipients, legal bases.
    'id="cookies"',
    'codex_session',
    'Télécharger mes données',
    'sous-traitants',
    'Base légale',
    'art. 85',
  ])
    if (!html.includes(needed)) out.push(`la notice ne contient pas « ${needed} »`)
  for (const p of sitePages)
    if (!pageHtml(p.file).includes('href="/confidentialite#cookies"'))
      out.push(`${p.file} : pas de lien « Cookies » vers /confidentialite#cookies`)
  return out
})

check(2, 'Page de CGU', () => {
  const out: string[] = []
  if (!existsSync(join(dist, 'cgu.html'))) out.push('cgu.html absente')
  for (const p of sitePages)
    if (!pageHtml(p.file).includes('href="/cgu"')) out.push(`${p.file} : pas de lien vers /cgu`)
  if (!existsSync(join(dist, 'mentions-legales.html'))) out.push('mentions-legales.html absente')
  if (!existsSync(join(dist, 'cgu.html'))) return out
  // D-271: alpha status, age, notice and action (DSA art. 16), statement of reasons (art. 17),
  // points of contact (art. 11-12), governing law.
  const cgu = pageHtml('cgu.html')
  for (const needed of [
    'id="alpha"',
    'id="signaler"',
    'id="moderation"',
    'id="contact"',
    '15 ans',
    'exposé des motifs',
    'droit français',
  ])
    if (!cgu.includes(needed)) out.push(`les CGU ne contiennent pas « ${needed} »`)
  return out
})

check(3, 'Aucune clé ni secret côté navigateur (API hors front-end)', () => {
  const out: string[] = []
  const patterns: [string, RegExp][] = [
    ['clé privée', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
    ['clé OpenAI/Anthropic', /\bsk-(?:ant-)?[A-Za-z0-9_-]{20,}/],
    ['clé AWS', /\bAKIA[0-9A-Z]{16}\b/],
    ['clé Google', /\bAIza[0-9A-Za-z_-]{35}\b/],
    ['jeton GitHub', /\bgh[pousr]_[A-Za-z0-9]{36}\b/],
    [
      'chaîne de connexion',
      /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s"'`]+:[^\s"'`]+@/,
    ],
    [
      'secret en dur',
      /\b(?:api[_-]?key|client[_-]?secret|app[_-]?secret|password|passwd)\b["']?\s*[:=]\s*["'][^"'\s]{12,}["']/i,
    ],
  ]
  for (const file of all.filter((f) => /\.(js|html|css|json|txt|xml|webmanifest)$/.test(f))) {
    const text = read(file)
    for (const [name, re] of patterns) if (re.test(text)) out.push(`${rel(file)} : ${name}`)
  }
  for (const f of all) if (/(^|[\\/])\.env/.test(rel(f))) out.push(`${rel(f)} publié`)
  // Only public values may reach the bundle through VITE_ variables.
  const envDecl = read(resolve(root, 'src/env.d.ts'))
  const declared = [...envDecl.matchAll(/readonly (VITE_\w+)/g)].map((m) => m[1])
  if (declared.some((name) => name !== 'VITE_UMAMI_WEBSITE_ID'))
    out.push('src/env.d.ts expose une variable VITE_ autre que l’identifiant public Umami')
  return out
})

check(4, 'HTTPS forcé', () => {
  const out: string[] = []
  if (!SITE.url.startsWith('https://'))
    out.push(`CODEX_SITE_URL doit commencer par https:// (${SITE.url})`)
  if (SITE.url.includes('.invalid')) out.push('CODEX_SITE_URL non renseignée (adresse du site)')
  if (!/Strict-Transport-Security "max-age=\d{8,}/.test(caddy))
    out.push('deploy/Caddyfile : en-tête HSTS manquant')
  if (/^http:\/\//m.test(caddy)) out.push('deploy/Caddyfile : un site est servi en http://')
  for (const f of htmlFiles) {
    const insecure = [...read(f).matchAll(/(?:href|src|content)="(http:\/\/[^"]+)"/g)].map(
      (m) => m[1],
    )
    for (const url of insecure) out.push(`${rel(f)} : ressource non sécurisée ${url}`)
  }
  return out
})

check(5, 'Bandeau cookies / mesure d’audience', () => {
  const out: string[] = []
  const js = all
    .filter((f) => f.endsWith('.js'))
    .map(read)
    .join('\n')
  if (!js.includes('consent-notice')) out.push('bandeau absent des pages publiques')
  if (!js.includes('analytics-notice-title')) out.push('bandeau absent de l’application')
  for (const p of sitePages)
    if (!pageHtml(p.file).includes('data-consent-open'))
      out.push(`${p.file} : pas de lien pour revenir sur son choix`)
  return out
})

check(6, 'Meta title et description', () => {
  const out: string[] = []
  const titles = new Set<string>()
  for (const f of htmlFiles) {
    const html = read(f)
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1]?.trim() ?? ''
    if (title.length < 5 || title.length > 70)
      out.push(`${rel(f)} : titre de ${title.length} caractères`)
    if (titles.has(title)) out.push(`${rel(f)} : titre en double « ${title} »`)
    titles.add(title)
    const description = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? ''
    if (description.length < 30 || description.length > 170)
      out.push(`${rel(f)} : description de ${description.length} caractères`)
    if (!/<html lang="fr"/.test(html)) out.push(`${rel(f)} : langue non déclarée`)
  }
  return out
})

check(7, 'Image pour les réseaux sociaux', () => {
  const out: string[] = []
  const image = join(dist, SITE.image)
  if (!existsSync(image)) return [`${SITE.image} absente`]
  const png = readFileSync(image)
  const [w, h] = [png.readUInt32BE(16), png.readUInt32BE(20)]
  if (w !== 1200 || h !== 630) out.push(`${SITE.image} fait ${w} × ${h} (attendu 1200 × 630)`)
  if (png.length > 300 * 1024) out.push(`${SITE.image} pèse ${kb(png.length)} (300 kB au plus)`)
  for (const p of sitePages) {
    const html = pageHtml(p.file)
    for (const prop of ['og:image', 'og:title', 'og:description', 'twitter:card', 'og:image:alt'])
      if (!html.includes(`"${prop}"`)) out.push(`${p.file} : ${prop} manquant`)
  }
  return out
})

check(8, 'Favicon', () => {
  const out: string[] = []
  for (const icon of [
    'favicon.svg',
    'favicon-32.png',
    'apple-touch-icon.png',
    'icon-192.png',
    'icon-512.png',
    'site.webmanifest',
  ])
    if (!existsSync(join(dist, icon))) out.push(`${icon} absent`)
  for (const f of htmlFiles) {
    const html = read(f)
    if (!html.includes('rel="icon"')) out.push(`${rel(f)} : pas de favicon`)
    if (!html.includes('rel="apple-touch-icon"')) out.push(`${rel(f)} : pas d’icône Apple`)
  }
  return out
})

check(9, 'Sitemap et robots.txt', () => {
  const out: string[] = []
  if (!existsSync(join(dist, 'robots.txt'))) return ['robots.txt absent']
  if (!existsSync(join(dist, 'sitemap.xml'))) return ['sitemap.xml absent']
  const robots = read(join(dist, 'robots.txt'))
  if (!robots.includes(`Sitemap: ${SITE.url}/sitemap.xml`))
    out.push('robots.txt ne cite pas le sitemap')
  if (!robots.includes('Disallow: /app/')) out.push('robots.txt laisse indexer l’application')
  const sitemap = read(join(dist, 'sitemap.xml'))
  for (const p of PAGES.filter((p) => p.indexed))
    if (!sitemap.includes(`<loc>${SITE.url}${p.path}</loc>`))
      out.push(`sitemap : ${p.path} manquant`)
  if (sitemap.includes('/404') || sitemap.includes('/app/'))
    out.push('sitemap : page non indexable listée')
  return out
})

check(10, 'Textes alternatifs des images', () => {
  const out: string[] = []
  for (const f of htmlFiles)
    for (const img of tags(read(f), 'img')) {
      const alt = attr(img, 'alt')
      if (alt === null) out.push(`${rel(f)} : <img> sans alt (${attr(img, 'src')})`)
      // A decorative picture (alt="") is fine; a content picture needs a real description.
      if (alt !== null && alt !== '' && alt.length < 10)
        out.push(`${rel(f)} : alt trop court « ${alt} »`)
    }
  // The app's own pictures: every <img> in the source has an alt.
  for (const f of files(resolve(root, 'src')).filter(
    (f) => f.endsWith('.tsx') && !f.includes('.test.'),
  )) {
    const src = read(f)
    for (const m of src.matchAll(/<img\b[\s\S]*?\/?>/g))
      if (!/\balt=/.test(m[0])) out.push(`${relative(root, f)} : <img> sans alt`)
  }
  return out
})

check(11, 'Images compressées', () => {
  const out: string[] = []
  const budget: Record<string, number> = {
    '.png': 300,
    '.jpg': 250,
    '.jpeg': 250,
    '.webp': 200,
    '.gif': 100,
    '.svg': 30,
  }
  for (const f of all) {
    const ext = extname(f).toLowerCase()
    const max = budget[ext]
    if (max === undefined) continue
    const size = statSync(f).size
    if (size > max * 1024) out.push(`${rel(f)} : ${kb(size)} (budget ${max} kB)`)
  }
  // Large photos belong in WebP.
  for (const f of all.filter((f) => /\.(png|jpe?g)$/i.test(f) && statSync(f).size > 100 * 1024))
    if (!rel(f).endsWith('og-image.png')) out.push(`${rel(f)} : préférer le WebP au-delà de 100 kB`)
  return out
})

check(12, 'Vitesse des pages (poids au chargement)', () => {
  const out: string[] = []
  const pageWeight = (file: string) => {
    const html = pageHtml(file)
    const assets = [
      ...[...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]!),
      ...[...html.matchAll(/<link[^>]+rel="(?:stylesheet|modulepreload)"[^>]+href="([^"]+)"/g)].map(
        (m) => m[1]!,
      ),
      ...[...html.matchAll(/<link[^>]+href="([^"]+)"[^>]+rel="(?:stylesheet|modulepreload)"/g)].map(
        (m) => m[1]!,
      ),
    ]
    return [...new Set(assets)]
      .map((a) => join(dist, a))
      .filter(existsSync)
      .reduce((sum, a) => sum + gz(a), gz(join(dist, file)))
  }
  for (const p of sitePages) {
    const weight = pageWeight(p.file)
    if (weight > 50 * 1024) out.push(`${p.file} : ${kb(weight)} compressés (budget 50 kB)`)
  }
  const app = pageWeight('app/index.html')
  if (app > 420 * 1024) out.push(`app : ${kb(app)} compressés au démarrage (budget 420 kB)`)
  for (const f of htmlFiles)
    for (const img of tags(read(f), 'img'))
      if (!attr(img, 'width') || !attr(img, 'height'))
        out.push(`${rel(f)} : <img> sans width/height (décalage de mise en page)`)
  if (!/Cache-Control "public, max-age=31536000, immutable"/.test(caddy))
    out.push('deploy/Caddyfile : pas de cache long sur les fichiers versionnés')
  if (!/encode .*(gzip|zstd)/.test(caddy)) out.push('deploy/Caddyfile : pas de compression')
  return out
})

check(13, 'Contraste', () => 'browser')
check(14, 'Site responsive', () => {
  const out: string[] = []
  for (const f of htmlFiles)
    if (!read(f).includes('name="viewport" content="width=device-width'))
      out.push(`${rel(f)} : pas de viewport`)
  return out.length ? out : 'browser'
})

check(15, 'Page 404 personnalisée', () => {
  const out: string[] = []
  if (!existsSync(join(dist, '404.html'))) return ['404.html absente']
  const html = pageHtml('404.html')
  if (!html.includes('name="robots" content="noindex"')) out.push('404 indexable')
  if (!html.includes('href="/"')) out.push('404 sans lien vers l’accueil')
  if (!/handle_errors 404[\s\S]*?status 404/.test(caddy))
    out.push('deploy/Caddyfile : la 404 n’est pas servie avec le statut 404')
  return out
})

check(16, 'Liens cassés', () => {
  const out: string[] = []
  for (const f of htmlFiles)
    for (const ref of localRefs(read(f))) if (!resolves(ref)) out.push(`${rel(f)} → ${ref}`)
  const manifest = JSON.parse(read(join(dist, 'site.webmanifest'))) as { icons: { src: string }[] }
  for (const icon of manifest.icons)
    if (!resolves(icon.src)) out.push(`site.webmanifest → ${icon.src}`)
  return out
})

check(17, 'Validation des formulaires', () => {
  const out: string[] = []
  for (const f of htmlFiles)
    for (const input of tags(read(f), 'input')) {
      const id = attr(input, 'id')
      if (!id || !read(f).includes(`for="${id}"`)) out.push(`${rel(f)} : champ sans libellé`)
    }
  return out.length ? out : 'browser'
})

check(18, 'Anti-spam', () => {
  const out: string[] = []
  // Online accounts and messages need limits on the server (phase 7, D-249).
  const server = resolve(root, 'server/src')
  const code = files(server)
    .filter((f) => f.endsWith('.ts'))
    .map(read)
    .join('\n')
  if (!code) return ['serveur en ligne pas encore construit (phase 7) : limites anti-spam absentes']
  for (const [what, needle] of [
    ['limitation du débit', 'rateLimit'],
    ['limite de création de comptes', 'signupLimit'],
    ['limite de messages', 'messageLimit'],
  ] as const)
    if (!code.includes(needle)) out.push(`serveur : ${what} absente (${needle})`)
  return out
})

check(19, 'Outil d’analytics', () => {
  const out: string[] = []
  if (!process.env.VITE_UMAMI_WEBSITE_ID)
    out.push('VITE_UMAMI_WEBSITE_ID non défini au build : la mesure d’audience est éteinte')
  if (!/handle_path \/stats\/\*/.test(caddy))
    out.push('deploy/Caddyfile : /stats non relayé vers Umami')
  const compose = resolve(root, 'deploy/docker-compose.yml')
  if (!existsSync(compose) || !read(compose).includes('umami'))
    out.push('Umami absent du déploiement')
  return out
})

check(20, 'Un seul appel à l’action par page', () => {
  const out: string[] = []
  for (const p of sitePages) {
    const count = (pageHtml(p.file).match(/class="[^"]*\bcta\b[^"]*"/g) ?? []).length
    if (count > 1) out.push(`${p.file} : ${count} appels à l’action`)
    if (p.path === '/' && count !== 1) out.push('accueil : il faut exactement un appel à l’action')
  }
  return out
})

// ---- legal points added for the public alpha (D-271) ------------------------------

check(21, 'Mentions légales complètes (LCEN, crédits)', () => {
  const out: string[] = []
  if (!existsSync(join(dist, 'mentions-legales.html'))) return ['mentions-legales.html absente']
  const html = pageHtml('mentions-legales.html')
  for (const needed of [
    'Éditeur',
    'Directeur ou directrice de la publication',
    'Hébergeur',
    'game-icons.net',
    'Creative Commons BY 3.0',
    'SIL Open Font License',
    'Lucide',
  ])
    if (!html.includes(needed)) out.push(`mentions légales : « ${needed} » absent`)
  // Publisher and host each need an address and a phone number (art. 6-III).
  if ((html.match(/<dt>Téléphone<\/dt>/g) ?? []).length < 2)
    out.push('mentions légales : téléphone de l’éditeur ou de l’hébergeur absent')
  for (const p of sitePages)
    if (!pageHtml(p.file).includes('href="/mentions-legales"'))
      out.push(`${p.file} : pas de lien vers /mentions-legales`)
  return out
})

check(22, 'Déclaration d’accessibilité (RGAA)', () => {
  const out: string[] = []
  if (!existsSync(join(dist, 'accessibilite.html'))) return ['accessibilite.html absente']
  const html = pageHtml('accessibilite.html')
  for (const needed of [
    'État de conformité',
    'Contenus non accessibles',
    'Environnement de test',
    'Défenseur des droits',
  ])
    if (!html.includes(needed)) out.push(`déclaration : « ${needed} » absent`)
  // The status is a mandatory mention on every page (décret 2019-768, art. 4).
  const mention =
    /href="\/accessibilite">Accessibilité : (non conforme|partiellement conforme|totalement conforme)</
  for (const p of sitePages)
    if (!mention.test(pageHtml(p.file)))
      out.push(`${p.file} : mention « Accessibilité : … conforme » absente du pied de page`)
  return out
})

check(23, 'Signalement et point de contact (DSA)', () => {
  const out: string[] = []
  if (!existsSync(join(dist, 'contact.html'))) return ['contact.html absente']
  const html = pageHtml('contact.html')
  for (const needed of ['id="signaler"', 'id="autorites"', 'art. 16', 'internet-signalement'])
    if (!html.includes(needed)) out.push(`contact : « ${needed} » absent`)
  for (const p of sitePages)
    if (!pageHtml(p.file).includes('href="/contact"'))
      out.push(`${p.file} : pas de lien vers /contact`)
  const server = resolve(root, 'server/src')
  if (!existsSync(join(server, 'moderate.ts'))) out.push('serveur : outil de modération absent')
  const code = existsSync(join(server, 'compliance.ts')) ? read(join(server, 'compliance.ts')) : ''
  for (const route of ["'/api/reports'", "'/api/account/export'", "'/api/account/terms'"])
    if (!code.includes(route)) out.push(`serveur : route ${route} absente`)
  return out
})

check(24, 'Version alpha signalée', () => {
  const out: string[] = []
  for (const p of sitePages)
    if (!/class="site-alpha" href="\/cgu#alpha"/.test(pageHtml(p.file)))
      out.push(`${p.file} : badge « Alpha » absent de l’en-tête`)
  const app = resolve(root, 'src/features/shell/AppHeader.tsx')
  if (!existsSync(app) || !read(app).includes('<AlphaBadge'))
    out.push('application : badge « Alpha » absent de la barre du haut')
  return out
})

check(0, 'Informations légales renseignées', () => {
  const out: string[] = []
  for (const f of htmlFiles)
    if (read(f).includes(TO_FILL)) out.push(`${rel(f)} contient « ${TO_FILL} »`)
  return out
})

// ---- report ------------------------------------------------------------------------

const icon: Record<Status, string> = { ok: '✓', fail: '✗', browser: '◐' }
console.log(`\nContrôle de mise en ligne — ${rel(dist) || dist}\n`)
for (const r of results.sort((a, b) => a.point - b.point)) {
  const n = r.point ? String(r.point).padStart(2) : ' +'
  const note = r.status === 'browser' ? '  (vérifié dans le navigateur : e2e/site.spec.ts)' : ''
  console.log(`${icon[r.status]} ${n}. ${r.label}${note}`)
  for (const d of r.details) console.log(`       – ${d}`)
}
const failed = results.filter((r) => r.status === 'fail')
console.log(
  failed.length
    ? `\n${failed.length} point(s) à corriger avant la mise en ligne.\n`
    : '\nTous les points statiques sont bons.\n',
)
process.exit(failed.length ? 1 : 0)
