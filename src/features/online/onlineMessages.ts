import type { Messages } from '@/i18n/locales/fr'
import { ApiError } from '@/online/server/api'

/** The French message of a server error. */
export function onlineErrorMessage(t: Messages, error: unknown): string {
  if (error instanceof ApiError) return t.online.errors[error.code] ?? t.online.errors.server
  return t.online.errors.server
}

/** Invitation link of a code: opens the app on the join page. */
export function inviteUrl(code: string): string {
  return `${location.origin}/app/#/rejoindre/${code}`
}

/** The invitation code inside a pasted link (…/app/#/rejoindre/CODE), or the code itself. */
export function inviteCodeOf(text: string): string {
  const clean = text.trim()
  const match = /rejoindre\/([A-Za-z0-9_-]+)/.exec(clean)
  return match ? match[1]! : clean
}
