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
  /** Session cookie only over HTTPS (off for the local dev server). */
  secureCookies: boolean
  /** Development: e-mails are printed instead of sent. */
  dev: boolean
  /** Built site served by the server itself (Plesk, D-263), or null (Caddy serves it). */
  siteDir: string | null
}

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
    secureCookies: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : !dev,
    dev,
    siteDir: env.CODEX_SERVE_SITE === 'false' ? null : siteDir(env, serverDir()),
  }
}
