import { sweepAdmin } from './admin.ts'
import { buildApp } from './app.ts'
import { sweepInactive } from './auth.ts'
import { sweepReports } from './compliance.ts'
import { loadConfig } from './config.ts'
import { openDb } from './db.ts'
import { createMailer } from './mailer.ts'

/** Codex's online server (D-262). Settings: environment variables, see config.ts. */
const config = loadConfig()
const db = await openDb(config.databaseUrl)
const mailer = createMailer(config)
if (!mailer)
  console.warn('SMTP_URL absent : la réinitialisation du mot de passe par e-mail est désactivée.')
const app = await buildApp({ db, config, mailer, logger: true })

// Once a day: accounts unused for three years go (privacy notice).
const sweep = () =>
  sweepInactive({ db, now: Date.now }).then(
    (n) => n && app.log.info(`${n} compte(s) inactif(s) supprimé(s)`),
    (error: unknown) => app.log.error(error),
  )
// Closed reports go one year after their decision (D-271).
const sweepClosedReports = () =>
  sweepReports({ db, now: Date.now }).catch((error: unknown) => app.log.error(error))
// Expired admin sessions, audit lines older than a year (D-275).
const sweepAdminData = () =>
  sweepAdmin({ db, now: Date.now }).catch((error: unknown) => app.log.error(error))
if (!config.adminUsername || !config.adminPasswordHash)
  console.warn(
    'ADMIN_USERNAME / ADMIN_PASSWORD_HASH absents : le tableau /admin refuse toute connexion.',
  )
void sweep()
void sweepClosedReports()
void sweepAdminData()
setInterval(sweepAdminData, 86_400_000).unref()
setInterval(sweepClosedReports, 86_400_000).unref()
setInterval(sweep, 86_400_000).unref()

for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => {
    void app
      .close()
      .then(() => db.close())
      .then(() => process.exit(0))
  })

await app.listen({ port: config.port, host: config.host })
