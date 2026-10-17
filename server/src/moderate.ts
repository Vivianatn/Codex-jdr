import { loadConfig } from './config.ts'
import { openDb } from './db.ts'
import { createMailer } from './mailer.ts'
import {
  dismissReport,
  getReport,
  hideProfile,
  listReports,
  restoreProfile,
  suspendAccount,
  unsuspendAccount,
  type ModerationCtx,
} from './moderation.ts'

/**
 * Moderation from the server's command line (D-271, docs/DEPLOIEMENT.md):
 *
 *   node dist/server/src/moderate.js reports [--all]
 *   node dist/server/src/moderate.js show <report id>
 *   node dist/server/src/moderate.js hide-profile <user id> --reason "…" [--report <id>] [--illegal] [--rename "…"]
 *   node dist/server/src/moderate.js restore-profile <user id>
 *   node dist/server/src/moderate.js suspend <user id> --reason "…" [--report <id>] [--illegal]
 *   node dist/server/src/moderate.js unsuspend <user id>
 *   node dist/server/src/moderate.js dismiss <report id> --reason "…"
 *
 * Same environment as the server (DATABASE_URL, SMTP_URL, MAIL_FROM…).
 */

export function parseArgs(argv: string[]) {
  const [command = 'help', target, ...rest] = argv
  const flags: Record<string, string | true> = {}
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]!
    if (!arg.startsWith('--')) continue
    const next = rest[i + 1]
    if (next !== undefined && !next.startsWith('--')) {
      flags[arg.slice(2)] = next
      i++
    } else flags[arg.slice(2)] = true
  }
  return { command, target, flags }
}

const USAGE = `Commandes :
  reports [--all]                       signalements ouverts (ou tous)
  show <signalement>                    détail d'un signalement
  hide-profile <compte> --reason "…" [--report <id>] [--illegal] [--rename "…"]
  restore-profile <compte>
  suspend <compte> --reason "…" [--report <id>] [--illegal]
  unsuspend <compte>
  dismiss <signalement> --reason "…"`

async function main() {
  const { command, target, flags } = parseArgs(process.argv.slice(2))
  const config = loadConfig()
  const db = await openDb(config.databaseUrl)
  const ctx: ModerationCtx = {
    db,
    mailer: createMailer(config),
    now: Date.now,
    contact: config.moderationEmail || config.mailFrom,
  }
  const reason = typeof flags.reason === 'string' ? flags.reason : ''
  const decision = {
    reason,
    illegal: flags.illegal === true,
    ...(typeof flags.report === 'string' ? { reportId: flags.report } : {}),
  }
  const needs = (ok: unknown, what: string) => {
    if (!ok) throw new Error(`${what} manquant.\n\n${USAGE}`)
  }
  try {
    switch (command) {
      case 'reports': {
        const rows = await listReports(db, flags.all === true)
        if (!rows.length) console.log('Aucun signalement.')
        for (const r of rows)
          console.log(
            `${r.id}  ${new Date(r.created_at as string).toISOString().slice(0, 16)}  ${r.status.padEnd(9)}  ${r.category.padEnd(20)}  profil ${r.target_id} (« ${r.snapshot.displayName ?? '?'} »)`,
          )
        break
      }
      case 'show': {
        needs(target, 'Identifiant du signalement')
        const report = await getReport(db, target!)
        if (!report) throw new Error('Signalement introuvable.')
        const shorten = (v: string | null | undefined) =>
          v ? `${v.slice(0, 40)}… (${v.length} caractères)` : null
        console.log(
          JSON.stringify(
            {
              ...report,
              snapshot: {
                ...report.snapshot,
                avatar: shorten(report.snapshot.avatar),
                banner: shorten(report.snapshot.banner),
              },
            },
            null,
            2,
          ),
        )
        break
      }
      case 'hide-profile':
        needs(target, 'Identifiant du compte')
        needs(reason, '--reason')
        await hideProfile(ctx, target!, {
          ...decision,
          ...(typeof flags.rename === 'string' ? { rename: flags.rename } : {}),
        })
        console.log('Profil masqué ; la personne a reçu l’exposé des motifs.')
        break
      case 'restore-profile':
        needs(target, 'Identifiant du compte')
        await restoreProfile(ctx, target!)
        console.log('Profil de nouveau modifiable.')
        break
      case 'suspend':
        needs(target, 'Identifiant du compte')
        needs(reason, '--reason')
        await suspendAccount(ctx, target!, decision)
        console.log('Compte suspendu ; la personne a reçu l’exposé des motifs.')
        break
      case 'unsuspend':
        needs(target, 'Identifiant du compte')
        await unsuspendAccount(ctx, target!)
        console.log('Suspension levée.')
        break
      case 'dismiss':
        needs(target, 'Identifiant du signalement')
        needs(reason, '--reason')
        await dismissReport(ctx, target!, reason)
        console.log('Signalement classé ; son auteur a reçu la décision.')
        break
      default:
        console.log(USAGE)
    }
  } finally {
    await db.close()
  }
}

// Run only as a command, not when a test imports parseArgs.
if (process.argv[1] && /moderate\.(ts|js)$/.test(process.argv[1]))
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
