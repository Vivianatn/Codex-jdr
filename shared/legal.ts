// Shared by the app, the server and the public site (D-271): no imports, no TypeScript-only syntax.
/**
 * Legal texts and their versions. The server records which version of the
 * terms (CGU) an account accepted; when TERMS_VERSION changes, the app asks
 * again at the next sign-in. Change it whenever the CGU or the privacy notice
 * change in substance (and update `legalUpdated` in site/config.ts).
 */

export const TERMS_VERSION = '2026-10-17'

/** Age declared at sign-up: 15 or over, or under 15 with a parent's or guardian's agreement. */
export const AGE_DECLARATIONS = ['15+', 'parental']
export type AgeDeclaration = '15+' | 'parental'

export function isAgeDeclaration(value: unknown): value is AgeDeclaration {
  return typeof value === 'string' && AGE_DECLARATIONS.includes(value)
}

export interface TermsStatus {
  /** The version the user must accept. */
  current: string
  /** What the account accepted, or null. */
  accepted: { version: string; at: number; age: AgeDeclaration | null } | null
}

/**
 * Categories of a report (DSA art. 16): illegal content by type, plus content
 * that only breaks the terms. `childAbuse` reports may be sent without the
 * reporter's identity (art. 16(2)(c)).
 */
export const REPORT_CATEGORIES = [
  'hate',
  'harassment',
  'childAbuse',
  'terrorism',
  'privacy',
  'impersonation',
  'intellectualProperty',
  'scam',
  'otherIllegal',
  'terms',
]
export type ReportCategory =
  | 'hate'
  | 'harassment'
  | 'childAbuse'
  | 'terrorism'
  | 'privacy'
  | 'impersonation'
  | 'intellectualProperty'
  | 'scam'
  | 'otherIllegal'
  | 'terms'

export function isReportCategory(value: unknown): value is ReportCategory {
  return typeof value === 'string' && REPORT_CATEGORIES.includes(value)
}

export const REPORT_EXPLANATION_MIN = 10
export const REPORT_EXPLANATION_MAX = 2000
