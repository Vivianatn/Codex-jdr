/**
 * Public website of Codex (D-248): pages, metadata and the legal facts shown on
 * them. Read at build time by `site/plugin.ts`.
 *
 * Anything still marked TO_FILL is a fact only the GM can give (publisher,
 * host address, domain): `npm run launch:check` fails while one remains, so
 * the site can never go live with invented legal information.
 */

import { existsSync } from 'node:fs'

export const TO_FILL = 'À COMPLÉTER'

// The facts live in .env.production.local (ignored by git, template: .env.example).
const LOCAL_ENV = '.env.production.local'
if (typeof process !== 'undefined' && existsSync(LOCAL_ENV)) process.loadEnvFile(LOCAL_ENV)

const env = (name: string) => (typeof process !== 'undefined' ? process.env[name] : undefined)

export const SITE = {
  name: 'Codex',
  /** Public address, without trailing slash (e.g. https://codex-jdr.fr). */
  url: (env('CODEX_SITE_URL') ?? 'https://codex.invalid').replace(/\/+$/, ''),
  tagline: 'Le grimoire du maître du jeu',
  locale: 'fr_FR',
  /** Social sharing picture (1200 × 630), in public/. */
  image: '/og-image.png',
  imageAlt: 'Codex, le grimoire du maître du jeu : fiches, dés, plateau et parties en ligne.',
  /** Date of the legal texts (shown as « Dernière mise à jour »). */
  legalUpdated: '13 octobre 2026',
  publisher: {
    /** Name of the person or company publishing Codex. */
    name: env('CODEX_PUBLISHER_NAME') ?? TO_FILL,
    /** « Particulier », « Entreprise individuelle (SIREN …) », « SAS au capital de … »… */
    status: env('CODEX_PUBLISHER_STATUS') ?? TO_FILL,
    address: env('CODEX_PUBLISHER_ADDRESS') ?? TO_FILL,
    email: env('CODEX_CONTACT_EMAIL') ?? TO_FILL,
    /** Directeur ou directrice de la publication. */
    director: env('CODEX_PUBLICATION_DIRECTOR') ?? TO_FILL,
  },
  host: {
    name: 'PulseHeberg',
    address: env('CODEX_HOST_ADDRESS') ?? TO_FILL,
    contact: env('CODEX_HOST_CONTACT') ?? TO_FILL,
    /** Where the data centre is (« en France », « en Allemagne »…). */
    location: env('CODEX_HOST_LOCATION') ?? TO_FILL,
  },
} as const

export interface SitePage {
  /** HTML entry, relative to the project root. */
  file: string
  /** Public path (pretty URL). */
  path: string
  title: string
  description: string
  /** Listed in sitemap.xml (and indexable). */
  indexed: boolean
  /** Sitemap priority. */
  priority?: number
}

export const PAGES: SitePage[] = [
  {
    file: 'index.html',
    path: '/',
    title: 'Codex · le grimoire du maître du jeu pour tes parties de JDR',
    description:
      'Fiches, dés, plateau à brouillard de guerre, tours par groupes et parties en ligne avec tes joueurs. Tes campagnes restent chiffrées, sur ton appareil comme sur le serveur.',
    indexed: true,
    priority: 1,
  },
  {
    file: 'confidentialite.html',
    path: '/confidentialite',
    title: 'Confidentialité et données personnelles · Codex',
    description:
      'Quelles données Codex conserve, pourquoi, combien de temps, et comment exercer tes droits (RGPD).',
    indexed: true,
    priority: 0.3,
  },
  {
    file: 'cgu.html',
    path: '/cgu',
    title: 'Conditions générales d’utilisation · Codex',
    description: 'Les règles d’utilisation de Codex, de ton compte et des parties en ligne.',
    indexed: true,
    priority: 0.3,
  },
  {
    file: 'mentions-legales.html',
    path: '/mentions-legales',
    title: 'Mentions légales · Codex',
    description: 'Éditeur et hébergeur du site Codex.',
    indexed: true,
    priority: 0.2,
  },
  {
    file: '404.html',
    path: '/404',
    title: 'Page introuvable · Codex',
    description: 'Cette page n’existe pas ou plus.',
    indexed: false,
  },
]

/** The application itself (private, behind an account): never indexed. */
export const APP_PATH = '/app/'
