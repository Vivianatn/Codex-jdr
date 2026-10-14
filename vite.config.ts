import { createHash } from 'node:crypto'
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import { siteInputs, sitePlugin } from './site/plugin.ts'

/**
 * Content Security Policy of every built page (D-243, D-248). Connections only
 * to Codex's own server (audience measurement, and the online mode's API);
 * scripts only from the bundle (plus each page's inline theme script, allowed
 * by its hash), pictures only from the app or data: URLs. Not applied by the
 * dev server, whose hot reload needs inline code and a socket. The production
 * server repeats it as an HTTP header (deploy/Caddyfile).
 */
function contentSecurityPolicy(): Plugin {
  return {
    name: 'codex-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const hashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
          ([, code]) => `'sha256-${createHash('sha256').update(code!).digest('base64')}'`,
        )
        const policy = [
          "default-src 'none'",
          `script-src 'self' ${hashes.join(' ')}`,
          // Sonner and Radix inject <style> elements.
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob:",
          "font-src 'self' data:",
          "connect-src 'self'",
          "manifest-src 'self'",
          "base-uri 'none'",
          "form-action 'none'",
          "object-src 'none'",
        ].join('; ')
        return html.replace(
          '<meta charset="UTF-8" />',
          `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />\n    <meta name="referrer" content="no-referrer" />`,
        )
      },
    },
  }
}

/** The online server (D-262) behind /api, as Caddy does in production. */
const apiProxy = {
  '/api': { target: process.env.CODEX_API ?? 'http://127.0.0.1:3000', ws: true },
}

export default defineConfig({
  plugins: [react(), tailwindcss(), sitePlugin(), contentSecurityPolicy()],
  // Several pages (D-248): the public site at /, the app at /app/. No SPA fallback:
  // unknown paths get the 404 page.
  appType: 'mpa',
  server: {
    proxy: apiProxy,
    // Build outputs and test reports are not sources: watching them also locks them on Windows.
    watch: {
      ignored: [
        '**/dist/**',
        '**/dist-e2e/**',
        '**/test-results/**',
        '**/playwright-report/**',
        '**/release/**',
        '**/server/.data/**',
      ],
    },
  },
  preview: { proxy: apiProxy },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Code shared with the online server (D-262).
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  // Absolute paths so the 404 page works at any depth. A desktop shell would build with CODEX_BASE=./
  base: process.env.CODEX_BASE ?? '/',
  build: {
    // Every supported browser has module preloading: no polyfill request on each page.
    modulePreload: { polyfill: false },
    rollupOptions: { input: siteInputs(fileURLToPath(new URL('.', import.meta.url))) },
    // Single-bundle local app (~280 kB gzip in phase 2). Route-level code splitting: phase 6 (D-011).
    chunkSizeWarningLimit: 1000,
    // No source maps in production: the bundle is all there is to read.
    sourcemap: false,
  },
  test: {
    restoreMocks: true,
    // Each jsdom worker is heavy: more than two starve each other (full-app tests time out) and run slower.
    maxWorkers: 2,
    projects: [
      {
        extends: true,
        test: {
          name: 'app',
          environment: 'jsdom',
          setupFiles: ['./src/test/setup.ts'],
          include: ['src/**/*.test.{ts,tsx}', 'shared/**/*.test.ts'],
          css: false,
          // Full-app component tests type into many fields; the whole suite runs them in parallel.
          testTimeout: 40_000,
        },
      },
      {
        // The online server (D-262): Node, a PostgreSQL in memory per test file.
        extends: true,
        test: {
          name: 'server',
          environment: 'node',
          include: ['server/src/**/*.test.ts'],
          testTimeout: 30_000,
          // Each test starts a fresh in-memory PostgreSQL: slow while the app suite runs alongside.
          hookTimeout: 30_000,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}', 'server/src/**/*.ts', 'shared/**/*.ts'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx'],
    },
  },
})
