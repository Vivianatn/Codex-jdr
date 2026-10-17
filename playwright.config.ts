import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
/** The online server (D-262), on an in-memory PostgreSQL; both app servers proxy /api to it. */
const API_PORT = 3100
const api = { CODEX_API: `http://127.0.0.1:${API_PORT}` }
/** Production build (with its Content Security Policy), for the security scenarios (CODEX_BUILD_PORT: another port when 4174 is taken). */
export const BUILD_PORT = Number(process.env.CODEX_BUILD_PORT ?? 4174)

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // Each test drives a full app with axe audits: keep the machine responsive.
  workers: process.env.CI ? 2 : '25%',
  timeout: 60_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'fr-FR',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node server/src/index.ts',
      url: `http://127.0.0.1:${API_PORT}/api/health`,
      env: {
        PORT: String(API_PORT),
        DATABASE_URL: 'pglite:memory',
        NODE_ENV: 'test',
        // Every scenario creates an online account (D-266).
        CODEX_RELAX_LIMITS: 'true',
        // Administration dashboard (D-275, e2e/admin.spec.ts): a test-only admin, password E2E_ADMIN_PASSWORD.
        ADMIN_USERNAME: 'admin-e2e',
        ADMIN_PASSWORD_HASH:
          'scrypt$32768$8$1$mCvjCsoyEZAXlb+abQgt8g==$Wm2BtTW1U1Kq8dOopvRiIklZ4fOQbQufawTDd/cfMyk=',
      },
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: `npm run dev -- --port ${PORT} --strictPort`,
      url: `http://localhost:${PORT}`,
      env: api,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: `npx vite build --outDir dist-e2e --emptyOutDir && npx vite preview --outDir dist-e2e --port ${BUILD_PORT} --strictPort`,
      url: `http://localhost:${BUILD_PORT}`,
      env: api,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
})
