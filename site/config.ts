/**
 * Public website of Codex (D-248): pages, metadata and the legal facts shown on
 * them. Read at build time by `site/plugin.ts`.
 *
 * Anything still marked TO_FILL is a fact only the GM can give (publisher,
 * host address, domain): `npm run launch:check` fails while one remains, so
 * the site can never go live with invented legal information.
 */

import { existsSync, readFileSync } from 'node:fs'
import { TERMS_VERSION } from '../shared/legal.ts'

export const TO_FILL = 'À COMPLÉTER'

// The facts live in .env.production.local (ignored by git, template: .env.example).
const LOCAL_ENV = '.env.production.local'
if (typeof process !== 'undefined' && existsSync(LOCAL_ENV)) process.loadEnvFile(LOCAL_ENV)

const env = (name: string) => (typeof process !== 'undefined' ? process.env[name] : undefined)

/** Version of Codex, read from package.json (never written by hand elsewhere). */
export const APP_VERSION = (
  JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
    version: string
  }
).version

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
  legalUpdated: '17 octobre 2026',
  /** Version of the CGU the server records at sign-up (shared/legal.ts, D-271). */
  termsVersion: TERMS_VERSION,
  /** Version of the app (package.json): « 0.1.0-alpha »… */
  version: APP_VERSION,
  /** LCEN art. 1-1 and 6-III (as amended by loi SREN 2024). */
  publisher: {
    /** Name of the person or company publishing Codex. */
    name: env('CODEX_PUBLISHER_NAME') ?? TO_FILL,
    /**
     * « Particulier », « Entreprise individuelle, SIREN … (RCS/RNE …) », « SAS au capital de …,
     * RCS … , TVA … »… A non-professional may stay anonymous (LCEN art. 6-III-2): see DEPLOIEMENT.md.
     */
    status: env('CODEX_PUBLISHER_STATUS') ?? TO_FILL,
    address: env('CODEX_PUBLISHER_ADDRESS') ?? TO_FILL,
    phone: env('CODEX_PUBLISHER_PHONE') ?? TO_FILL,
    /** Contact, rights (RGPD), reports and DSA single point of contact (art. 11 and 12). */
    email: env('CODEX_CONTACT_EMAIL') ?? TO_FILL,
    /** Directeur ou directrice de la publication. */
    director: env('CODEX_PUBLICATION_DIRECTOR') ?? TO_FILL,
  },
  host: {
    name: 'PulseHeberg',
    address: env('CODEX_HOST_ADDRESS') ?? TO_FILL,
    /** Phone number of the host (LCEN art. 6-III-1). CODEX_HOST_CONTACT is the older name. */
    phone: env('CODEX_HOST_PHONE') ?? env('CODEX_HOST_CONTACT') ?? TO_FILL,
    /** Where the data centre is (« en France », « en Allemagne »…). */
    location: env('CODEX_HOST_LOCATION') ?? TO_FILL,
  },
  /** Service sending the e-mails (SMTP_URL of the server): name and country, e.g. « Brevo (France) ». */
  mailProvider: env('CODEX_MAIL_PROVIDER') ?? TO_FILL,
  /**
   * Consumer mediator (Code de la consommation, art. L612-1) when the publisher acts as a
   * professional: name and website. Otherwise the GM writes why it does not apply.
   */
  consumerMediator: env('CODEX_CONSUMER_MEDIATOR') ?? TO_FILL,
  /**
   * RGAA status (décret 2019-768). Without a full RGAA audit, the rules say « non conforme »;
   * « partiellement conforme » (50 % of criteria or more) or « totalement conforme » after one.
   */
  accessibility: {
    status: env('CODEX_ACCESSIBILITY_STATUS') ?? 'non conforme',
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
      'Fiches, dés, plateau à brouillard de guerre, tours par groupes et parties en ligne avec tes joueurs. Tes campagnes te suivent partout, chiffrées sur le serveur.',
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
    description:
      'Éditeur, directeur de la publication, hébergeur, propriété intellectuelle et crédits de Codex.',
    indexed: true,
    priority: 0.2,
  },
  {
    file: 'accessibilite.html',
    path: '/accessibilite',
    title: 'Déclaration d’accessibilité · Codex',
    description:
      'État de conformité de Codex au RGAA, contenus non accessibles, contact et voies de recours.',
    indexed: true,
    priority: 0.2,
  },
  {
    file: 'contact.html',
    path: '/contact',
    title: 'Contact et signalement d’un contenu · Codex',
    description:
      'Écrire à l’éditeur de Codex, signaler un contenu illicite, exercer tes droits : le point de contact unique.',
    indexed: true,
    priority: 0.3,
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
