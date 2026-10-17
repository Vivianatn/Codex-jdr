import cookie from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
import websocket from '@fastify/websocket'
import Fastify, { type FastifyInstance, type FastifyReply } from 'fastify'
import type { ApiErrorCode } from '../../shared/sync.ts'
import { registerAuth } from './auth.ts'
import { registerCampaigns } from './campaigns.ts'
import { registerCompliance } from './compliance.ts'
import type { Config } from './config.ts'
import type { Db } from './db.ts'
import { Hub, registerHub } from './hub.ts'
import type { Mailer } from './mailer.ts'
import { registerRecords } from './records.ts'
import { registerSite } from './site.ts'
import { registerSocial } from './social.ts'
import { recordCipher, type RecordCipher } from './secrets.ts'

/** Everything a route needs. */
export interface Ctx {
  db: Db
  config: Config
  mailer: Mailer | null
  cipher: RecordCipher
  hub: Hub
  now: () => number
}

/** A refusal the app understands: HTTP status + code (shared/sync.ts). */
export class ApiError extends Error {
  readonly status: number
  readonly code: ApiErrorCode
  readonly extra: Record<string, unknown>
  constructor(status: number, code: ApiErrorCode, extra: Record<string, unknown> = {}) {
    super(code)
    this.status = status
    this.code = code
    this.extra = extra
  }
}

export interface AppOptions {
  db: Db
  config: Config
  mailer: Mailer | null
  now?: () => number
  /** Request logs (off in tests). */
  logger?: boolean
}

/** Largest request: a campaign upload with its pictures. */
export const BODY_LIMIT = 64 * 1024 * 1024

export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger
      ? {
          // Never log cookies, passwords or campaign contents.
          redact: ['req.headers.cookie', 'req.headers.authorization'],
        }
      : false,
    bodyLimit: 1024 * 1024,
    // Behind Caddy: the client address comes from X-Forwarded-For.
    trustProxy: !options.config.dev,
  })
  const ctx: Ctx = {
    db: options.db,
    config: options.config,
    mailer: options.mailer,
    cipher: recordCipher(options.config.dataKey),
    hub: new Hub(options.db),
    now: options.now ?? Date.now,
  }

  await app.register(cookie)
  // Anti-spam (launch checklist point 18): a ceiling per address, tighter on account routes.
  await app.register(rateLimit, {
    // End-to-end tests run many browsers from one address.
    max: ctx.config.relaxLimits ? 60_000 : 600,
    timeWindow: '1 minute',
    keyGenerator: (request) => request.ip || 'unknown',
  })
  await app.register(websocket, { options: { maxPayload: BODY_LIMIT } })

  app.setErrorHandler((error: unknown, request, reply) => {
    if (error instanceof ApiError) return send(reply, error.status, error.code, error.extra)
    const status = (error as { statusCode?: number }).statusCode ?? 500
    if (status === 413) return send(reply, 413, 'tooLarge')
    if (status === 429) return send(reply, 429, 'throttled')
    if (status >= 400 && status < 500) return send(reply, status, 'invalid')
    request.log.error(error)
    return send(reply, 500, 'server')
  })

  // Requests that change something must come from Codex's own pages (with SameSite cookies).
  app.addHook('onRequest', async (request) => {
    if (request.method === 'GET' || request.method === 'HEAD') return
    const origin = request.headers.origin
    if (origin && new URL(origin).host !== request.headers.host)
      throw new ApiError(403, 'forbidden')
  })

  app.get('/api/health', async () => ({ ok: true }))
  registerCompliance(app, ctx)
  registerAuth(app, ctx)
  registerCampaigns(app, ctx)
  registerRecords(app, ctx)
  registerSocial(app, ctx)
  registerHub(app, ctx)
  if (options.config.siteDir) await registerSite(app, options.config.siteDir)
  app.addHook('onClose', async () => ctx.hub.closeAll())
  return app
}

function send(reply: FastifyReply, status: number, code: ApiErrorCode, extra = {}) {
  return reply.status(status).send({ error: code, ...extra })
}
