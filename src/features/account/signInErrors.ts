import type { Messages } from '@/i18n/locales/fr'
import { ApiError } from '@/online/server/api'
import { AccountError } from '@/security/accounts'
import { accountErrorMessage } from './accountErrors'

/** The French message of an error met while signing in online (D-262). */
export function signInErrorMessage(t: Messages, error: unknown): string {
  if (error instanceof AccountError) return accountErrorMessage(t, error)
  if (error instanceof ApiError) {
    if (error.code === 'weakPassword' && typeof error.extra.problem === 'string')
      return t.account.errors[error.extra.problem as keyof Messages['account']['errors']] as string
    return t.online.errors[error.code] ?? t.online.errors.server
  }
  return t.account.errors.generic
}
