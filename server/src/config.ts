import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { siteDir } from './site.ts'

/** Settings of the server, from the environment (deploy/.env, see docs/DEPLOIEMENT.md). */
export interface Config {
  port: number
  host: string
  /** `postgres://…`, or `pglite:memory` / `pglite:./folder` for development. */
  databaseUrl: string
  /** 32 bytes: encrypts the campaign records at rest. */
  dataKey: Buffer
  /** Public address of the site, for links in e-mails (https://codex-jdr.fr). */
  publicUrl: string
  /** `smtp://user:password@host:587` (or smtps://…); empty = no e-mail. */
  smtpUrl: string
  mailFrom: string
  /** Where new reports are announced (DSA notice and action, D-271); empty = nowhere. */
  moderationEmail: string
  /** End-to-end tests only (`CODEX_RELAX_LIMITS=true`): account routes allow many more tries. */
  relaxLimits: boolean
  /** Session cookie only over HTTPS (off for the local dev server). */
  secureCookies: boolean
  /** Development: e-mails are printed instead of sent. */
  dev: boolean
  /** Built site served by the server itself (Plesk, D-263), or null (Caddy serves it). */
  siteDir: string | null
  /** Administration dashboard (D-275): empty = nobody can sign in at /admin. */
  adminUsername: string
  /** scrypt hash of the admin password (`npm run admin:hash`), same format as account passwords. */
  adminPasswordHash: string
}

/** A value pasted with its quotes (`'scrypt$…'`, as `admin:hash` prints it for .env files) is unquoted. */
const unquote = (value: string | undefined) => (value ?? '').trim().replace(/^(['"])(.*)\1$/, '$2')

/** The server/ folder, from src/ or from the compiled dist/server/src/. */
function serverDir(): string {
  let dir = dirname(fileURLToPath(import.meta.url))
  for (let i = 0; i < 4 && !existsSync(join(dir, 'package.json')); i++) dir = dirname(dir)
  return dir
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const dev = env.NODE_ENV !== 'production'
  const keyHex = env.CODEX_DATA_KEY ?? ''
  if (!dev && !/^[0-9a-f]{64}$/i.test(keyHex))
    throw new Error('CODEX_DATA_KEY manquant : 64 caractères hexadécimaux (openssl rand -hex 32)')
  // Development: an in-memory PostgreSQL (a folder, pglite:./.data, also works outside Windows).
  const databaseUrl = env.DATABASE_URL ?? (dev ? 'pglite:memory' : '')
  if (!databaseUrl) throw new Error('DATABASE_URL manquant')
  return {
    port: Number(env.PORT ?? 3000),
    host: env.HOST ?? (dev ? '127.0.0.1' : '0.0.0.0'),
    databaseUrl,
    // A fixed key in development only, so a local database survives restarts.
    dataKey: keyHex
      ? Buffer.from(keyHex, 'hex')
      : createHash('sha256').update('codex-dev-only-key').digest(),
    publicUrl: (env.CODEX_SITE_URL ?? 'http://localhost:5173').replace(/\/+$/, ''),
    smtpUrl: env.SMTP_URL ?? '',
    mailFrom: env.MAIL_FROM ?? 'Codex <ne-pas-repondre@codex.invalid>',
    moderationEmail: env.MODERATION_EMAIL ?? '',
    relaxLimits: dev && env.CODEX_RELAX_LIMITS === 'true',
    secureCookies: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : !dev,
    dev,
    siteDir: env.CODEX_SERVE_SITE === 'false' ? null : siteDir(env, serverDir()),
    adminUsername: unquote(env.ADMIN_USERNAME),
    adminPasswordHash: unquote(env.ADMIN_PASSWORD_HASH),
  }
}
