import type { Queryable } from './db.ts'
import type { Mailer } from './mailer.ts'
import { referenceOf } from './compliance.ts'

/**
 * The operator's side of notice and action (DSA art. 16 and 17, D-271), used
 * by the `moderate.ts` command line (docs/DEPLOIEMENT.md). Every restriction
 * is decided by a person, never automatically, and explained to the account
 * concerned (statement of reasons); the reporter learns the decision.
 */

export interface ModerationCtx {
  db: Queryable
  mailer: Mailer | null
  now: () => number
  /** Address people answer to (contact of the site). */
  contact: string
}

export interface ReportRow {
  id: string
  reporter_id: string | null
  target_id: string
  category: string
  explanation: string
  status: 'open' | 'actioned' | 'dismissed'
  decision: string | null
  created_at: unknown
  decided_at: unknown
  snapshot: { displayName?: string; bio?: string; avatar?: string | null; banner?: string | null }
}

export async function listReports(db: Queryable, all = false): Promise<ReportRow[]> {
  return db.query<ReportRow>(
    `SELECT * FROM reports ${all ? '' : "WHERE status = 'open'"} ORDER BY created_at`,
  )
}

export async function getReport(db: Queryable, id: string): Promise<ReportRow | null> {
  const [row] = await db.query<ReportRow>('SELECT * FROM reports WHERE id::text = $1', [id])
  return row ?? null
}

/** Why a restriction is decided: a law (illegal content) or the terms. */
export interface Decision {
  /** Facts and circumstances, in plain French, shown to the account concerned. */
  reason: string
  /** Illegal content (true) or only contrary to the CGU (false). */
  illegal: boolean
  /** The report that led to it, if any. */
  reportId?: string
}

type Restriction = 'profile' | 'suspension'

const RESTRICTIONS: Record<Restriction, string> = {
  profile:
    'ta devise, ta photo de profil et ta bannière ont été retirées, et ne peuvent plus être modifiées pour le moment',
  suspension: 'ton compte est suspendu : tu ne peux plus t’y connecter',
}

async function userOf(db: Queryable, userId: string) {
  const [row] = await db.query<{ id: string; email: string; display_name: string }>(
    'SELECT id, email, display_name FROM users WHERE id::text = $1',
    [userId],
  )
  if (!row) throw new Error(`Compte introuvable : ${userId}`)
  return row
}

/** Statement of reasons (DSA art. 17(3)). */
function statement(name: string, restriction: Restriction, decision: Decision, contact: string) {
  return [
    `Bonjour ${name},`,
    '',
    `Nous t’informons d’une décision de modération sur ton compte Codex : ${RESTRICTIONS[restriction]}.`,
    '',
    `Faits et circonstances : ${decision.reason}`,
    decision.reportId
      ? `Cette décision fait suite à un signalement (référence ${referenceOf(decision.reportId)}).`
      : 'Cette décision a été prise à notre initiative.',
    'Elle a été prise par une personne, sans outil automatisé.',
    decision.illegal
      ? 'Motif : le contenu en cause est illicite (loi française ou droit de l’Union européenne).'
      : 'Motif : le contenu en cause est contraire aux conditions générales d’utilisation de Codex (règles de conduite et du profil public).',
    '',
    `Tu peux contester cette décision en répondant à ${contact} : elle sera réexaminée par une personne. Tu peux aussi saisir le juge compétent.`,
    '',
    'L’équipe de Codex',
  ].join('\n')
}

async function inform(ctx: ModerationCtx, to: string, subject: string, text: string) {
  if (ctx.mailer) await ctx.mailer.send(to, subject, text)
  else console.info(`[e-mail non envoyé, SMTP absent : ${to}] ${subject}\n${text}`)
}

/** Closes the report and tells the reporter (DSA art. 16(5)). */
async function closeReport(
  ctx: ModerationCtx,
  reportId: string | undefined,
  status: 'actioned' | 'dismissed',
  decision: string,
) {
  if (!reportId) return
  const report = await getReport(ctx.db, reportId)
  if (!report) throw new Error(`Signalement introuvable : ${reportId}`)
  await ctx.db.query(
    'UPDATE reports SET status = $2, decision = $3, decided_at = $4 WHERE id = $1',
    [report.id, status, decision, new Date(ctx.now())],
  )
  if (!report.reporter_id) return
  const [reporter] = await ctx.db.query<{ email: string; display_name: string }>(
    'SELECT email, display_name FROM users WHERE id = $1',
    [report.reporter_id],
  )
  if (!reporter) return
  await inform(
    ctx,
    reporter.email,
    `Codex : décision sur ton signalement (${referenceOf(report.id)})`,
    [
      `Bonjour ${reporter.display_name},`,
      '',
      `Ton signalement (référence ${referenceOf(report.id)}) a été examiné par une personne.`,
      status === 'actioned'
        ? `Décision : des mesures ont été prises. ${decision}`
        : `Décision : aucune mesure n’a été prise. ${decision}`,
      '',
      `Si tu n’es pas d’accord, réponds à ${ctx.contact}.`,
    ].join('\n'),
  )
}

/** Removes the motto and pictures of a profile, optionally renames it, and locks them. */
export async function hideProfile(
  ctx: ModerationCtx,
  userId: string,
  decision: Decision & { rename?: string },
): Promise<void> {
  const user = await userOf(ctx.db, userId)
  await ctx.db.query(
    `UPDATE users SET bio = '', avatar = NULL, banner = NULL, profile_rev = profile_rev + 1,
       profile_hidden_at = $2, display_name = COALESCE($3, display_name) WHERE id = $1`,
    [user.id, new Date(ctx.now()), decision.rename ?? null],
  )
  await inform(
    ctx,
    user.email,
    'Codex : décision de modération sur ton profil',
    statement(user.display_name, 'profile', decision, ctx.contact),
  )
  await closeReport(ctx, decision.reportId, 'actioned', 'Le profil a été masqué.')
}

/** Lets the profile be edited again (after a successful appeal, for instance). */
export async function restoreProfile(ctx: ModerationCtx, userId: string): Promise<void> {
  const user = await userOf(ctx.db, userId)
  await ctx.db.query('UPDATE users SET profile_hidden_at = NULL WHERE id = $1', [user.id])
}

/** Suspends an account: no more sign-in, every session closed. */
export async function suspendAccount(
  ctx: ModerationCtx,
  userId: string,
  decision: Decision,
): Promise<void> {
  const user = await userOf(ctx.db, userId)
  await ctx.db.query('UPDATE users SET suspended_at = $2 WHERE id = $1', [
    user.id,
    new Date(ctx.now()),
  ])
  await ctx.db.query('DELETE FROM sessions WHERE user_id = $1', [user.id])
  await inform(
    ctx,
    user.email,
    'Codex : ton compte est suspendu',
    statement(user.display_name, 'suspension', decision, ctx.contact),
  )
  await closeReport(ctx, decision.reportId, 'actioned', 'Le compte a été suspendu.')
}

export async function unsuspendAccount(ctx: ModerationCtx, userId: string): Promise<void> {
  const user = await userOf(ctx.db, userId)
  await ctx.db.query('UPDATE users SET suspended_at = NULL WHERE id = $1', [user.id])
}

/** No action: the report is closed with the reason given to the reporter. */
export async function dismissReport(
  ctx: ModerationCtx,
  reportId: string,
  reason: string,
): Promise<void> {
  await closeReport(ctx, reportId, 'dismissed', reason)
}
