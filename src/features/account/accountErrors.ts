import { AccountError } from '@/security/accounts'
import type { Messages } from '@/i18n/locales/fr'

/** French message for any error thrown by the account service. */
export function accountErrorMessage(t: Messages, error: unknown, intlLocale = 'fr-FR'): string {
  if (!(error instanceof AccountError)) return t.account.errors.generic
  if (error.code === 'throttled' || (error.code === 'wrongPassword' && error.retryAt)) {
    const time = new Date(error.retryAt ?? Date.now()).toLocaleTimeString(intlLocale)
    return error.code === 'throttled'
      ? t.account.errors.throttled(time)
      : `${t.account.errors.wrongPassword} ${t.account.errors.throttled(time)}`
  }
  if (error.code === 'wrongRecoveryCode' && error.retryAt)
    return `${t.account.errors.wrongRecoveryCode} ${t.account.errors.throttled(
      new Date(error.retryAt).toLocaleTimeString(intlLocale),
    )}`
  return t.account.errors[error.code]
}
