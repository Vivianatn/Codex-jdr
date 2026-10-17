import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { testServer } from './testing.ts'

let dir: string
let server: Awaited<ReturnType<typeof testServer>>
beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'codex-site-'))
  mkdirSync(join(dir, 'app'))
  mkdirSync(join(dir, 'admin'))
  writeFileSync(join(dir, 'admin', 'index.html'), 'admin')
  mkdirSync(join(dir, 'assets'))
  writeFileSync(join(dir, 'index.html'), 'accueil')
  writeFileSync(join(dir, 'cgu.html'), 'cgu')
  writeFileSync(join(dir, '404.html'), 'perdu')
  writeFileSync(join(dir, 'app', 'index.html'), 'app')
  writeFileSync(join(dir, 'assets', 'app-x1.css'), 'body{}')
  server = await testServer(dir)
})
afterEach(async () => {
  await server.close()
  rmSync(dir, { recursive: true, force: true })
})

const get = (url: string) => server.app.inject({ method: 'GET', url })

describe('the server serves the built site (Plesk, D-263)', () => {
  it('pages, pretty URLs, the app and styles with the right type and cache', async () => {
    expect((await get('/')).body).toBe('accueil')
    expect((await get('/cgu')).body).toBe('cgu')
    expect((await get('/app/')).body).toBe('app')
    const css = await get('/assets/app-x1.css')
    expect(css.headers['content-type']).toMatch(/text\/css/)
    expect(css.headers['cache-control']).toContain('immutable')
    expect((await get('/cgu')).headers['cache-control']).toBe('no-cache')
  })

  it('serves the administration dashboard at /admin, never indexed (D-275)', async () => {
    for (const url of ['/admin', '/admin/']) {
      const page = await get(url)
      expect([page.statusCode, page.body]).toEqual([200, 'admin'])
      expect(page.headers['x-robots-tag']).toContain('noindex')
    }
    expect((await get('/cgu')).headers['x-robots-tag']).toBeUndefined()
  })

  it('sends the same security headers as Caddy (D-271)', async () => {
    const page = await get('/cgu')
    expect(page.headers['strict-transport-security']).toMatch(/max-age=\d{8,}/)
    expect(page.headers['x-frame-options']).toBe('DENY')
    expect(page.headers['content-security-policy']).toContain("frame-ancestors 'none'")
    expect(page.headers['permissions-policy']).toContain('camera=()')
    expect((await get('/nulle-part')).headers['x-content-type-options']).toBe('nosniff')
  })

  it('answers unknown pages with the 404 page, never files outside the site, and leaves /api alone', async () => {
    const missing = await get('/nulle-part')
    expect([missing.statusCode, missing.body]).toEqual([404, 'perdu'])
    expect((await get('/../package.json')).statusCode).toBe(404)
    expect((await get('/%2e%2e/package.json')).statusCode).toBe(404)
    expect((await get('/api/health')).json()).toEqual({ ok: true })
    expect((await get('/api/inconnu')).json()).toEqual({ error: 'notFound' })
  })
})
