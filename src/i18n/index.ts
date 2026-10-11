import { useSettingsStore } from '@/stores/settingsStore'
import { fr, type Messages } from './locales/fr'

export type Locale = 'fr'

export const LOCALES: Record<Locale, { messages: Messages; intl: string }> = {
  fr: { messages: fr, intl: 'fr-FR' },
}

export const DEFAULT_LOCALE: Locale = 'fr'

export function getMessages(locale: Locale = DEFAULT_LOCALE): Messages {
  return LOCALES[locale].messages
}

/** Typed UI strings for the current locale: `const t = useT(); t.nav.players`. */
export function useT(): Messages {
  const locale = useSettingsStore((s) => s.locale)
  return getMessages(locale)
}

export function useIntlLocale(): string {
  const locale = useSettingsStore((s) => s.locale)
  return LOCALES[locale].intl
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
]

/** "il y a 3 jours", "hier"… Falls back to the locale's "just now" under a minute. */
export function formatRelativeTime(
  timestamp: number,
  intlLocale: string,
  justNow: string,
  now: number = Date.now(),
): string {
  const seconds = Math.round((timestamp - now) / 1000)
  const rtf = new Intl.RelativeTimeFormat(intlLocale, { numeric: 'auto' })
  for (const [unit, size] of RELATIVE_UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit)
  }
  return justNow
}
