import fastifyStatic from '@fastify/static'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { existsSync, statSync } from 'node:fs'
import { join, normalize, sep } from 'node:path'

/**
 * Serves the built site and app (dist/) when the server runs alone, as a
 * Plesk Node.js application where every request reaches Node (D-263). Same
 * rules as deploy/Caddyfile: pretty URLs (/cgu → cgu.html), the real 404
 * page, hashed assets cached for a year, pages never cached.
 */
export async function registerSite(app: FastifyInstance, root: string): Promise<void> {
  await app.register(fastifyStatic, { root, serve: false })

  const file = (path: string) => {
    const full = normalize(join(root, path))
    if (!full.startsWith(root + sep) && full !== root) return null
    return existsSync(full) && statSync(full).isFile() ? full.slice(root.length + 1) : null
  }

  const send = (reply: FastifyReply, rel: string, status = 200) => {
    const immutable = rel.startsWith(`assets${sep}`) || rel.startsWith('assets/')
    reply
      .status(status)
      .header('Cache-Control', immutable ? 'public, max-age=31536000, immutable' : 'no-cache')
      .header('X-Content-Type-Options', 'nosniff')
      .header('Referrer-Policy', 'no-referrer')
      .header('X-Frame-Options', 'DENY')
    return reply.sendFile(rel.split(sep).join('/'), { cacheControl: false })
  }

  app.get('/*', async (request, reply) => {
    const path = decodeURIComponent(new URL(request.url, 'http://x').pathname)
    if (path.startsWith('/api/')) return reply.status(404).send({ error: 'notFound' })
    const found =
      file(path === '/' ? 'index.html' : path) ??
      file(`${path}.html`) ??
      file(join(path, 'index.html'))
    if (found) return send(reply, found)
    return send(reply, '404.html', 404)
  })
}

/** Where the built site is: CODEX_SITE_DIR, or dist/ next to the repository's server/. */
export function siteDir(env: NodeJS.ProcessEnv, serverDir: string): string | null {
  const candidates = [
    env.CODEX_SITE_DIR,
    join(serverDir, '..', 'dist'),
    join(serverDir, '..', 'site'),
  ]
  for (const dir of candidates)
    if (dir && existsSync(join(dir, 'index.html'))) return normalize(dir)
  return null
}
