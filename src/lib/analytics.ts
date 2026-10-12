/**
 * Audience measurement (D-248): self-hosted Umami, without cookies, on our own
 * server. Exempt from consent under the CNIL rules (anonymous, first-party,
 * audience only) — but the visitor is told once and can refuse at any time.
 * Off when Do Not Track / Global Privacy Control is set, and when the build
 * has no Umami website id (development, tests, desktop shell).
 */

export type AnalyticsChoice = 'accepted' | 'refused'

const KEY = 'codex.analytics'
const SCRIPT_ID = 'codex-analytics'

/** Website id of the Umami instance, given at build time. */
export const ANALYTICS_WEBSITE_ID: string = import.meta.env.VITE_UMAMI_WEBSITE_ID ?? ''
/** Same-origin path the server proxies to Umami (deploy/Caddyfile). */
export const ANALYTICS_PATH = '/stats'

export function analyticsChoice(): AnalyticsChoice | null {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'accepted' || value === 'refused' ? value : null
  } catch {
    return null
  }
}

export function browserRefusesTracking(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean }
  return nav.doNotTrack === '1' || nav.globalPrivacyControl === true
}

/** The notice is shown until the visitor answers, unless measurement is off anyway. */
export function shouldAskAnalytics(): boolean {
  return Boolean(ANALYTICS_WEBSITE_ID) && !browserRefusesTracking() && analyticsChoice() === null
}

export function setAnalyticsChoice(choice: AnalyticsChoice): void {
  try {
    localStorage.setItem(KEY, choice)
  } catch {
    // Private mode: the choice lasts for this page only.
  }
  if (choice === 'refused') return stopAnalytics()
  try {
    localStorage.removeItem('umami.disabled')
  } catch {
    // ignore
  }
  startAnalytics()
}

/** Loads the tracker unless refused (silence counts as no objection, see above). */
export function startAnalytics(): void {
  if (!ANALYTICS_WEBSITE_ID || browserRefusesTracking() || analyticsChoice() === 'refused') return
  if (document.getElementById(SCRIPT_ID)) return
  const script = document.createElement('script')
  script.id = SCRIPT_ID
  script.defer = true
  script.src = `${ANALYTICS_PATH}/script.js`
  script.dataset.websiteId = ANALYTICS_WEBSITE_ID
  script.dataset.hostUrl = ANALYTICS_PATH
  script.dataset.doNotTrack = 'true'
  // Hash routes of the app carry campaign ids: never send them.
  script.dataset.excludeHash = 'true'
  script.dataset.excludeSearch = 'true'
  document.head.appendChild(script)
}

function stopAnalytics(): void {
  document.getElementById(SCRIPT_ID)?.remove()
  // Umami's own opt-out flag, read by an already loaded tracker.
  try {
    localStorage.setItem('umami.disabled', '1')
  } catch {
    // ignore
  }
}
