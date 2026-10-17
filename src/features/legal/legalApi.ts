import { downloadJson } from '@/lib/files'
import { api } from '@/online/server/api'
import {
  TERMS_VERSION,
  type AgeDeclaration,
  type ReportCategory,
  type TermsStatus,
} from '@shared/legal'

/**
 * Legal calls of the online server (D-271): terms and age, data export,
 * reports. Kept apart from `online/server/api.ts`, which they only use.
 */
export const legalApi = {
  terms: () => api<TermsStatus>('GET', '/account/terms'),
  acceptTerms: (age: AgeDeclaration) =>
    api<TermsStatus>('POST', '/account/terms', { version: TERMS_VERSION, age }),
  exportData: () => api<Record<string, unknown>>('GET', '/account/export'),
  report: (input: {
    targetId: string
    category: ReportCategory
    explanation: string
    anonymous: boolean
  }) =>
    api<{ id: string; reference: string; receivedAt: number }>('POST', '/reports', {
      targetType: 'profile',
      goodFaith: true,
      ...input,
    }),
}

/** True when the account still has to accept the current terms. */
export const needsTerms = (status: TermsStatus) => status.accepted?.version !== status.current

/** « Télécharger mes données »: the server's export saved as a JSON file. */
export async function downloadAccountData(): Promise<void> {
  const data = await legalApi.exportData()
  downloadJson(`codex-mes-donnees-${new Date().toISOString().slice(0, 10)}.json`, data)
}

/** The sign-up answers (TermsConsent): terms accepted, age declared. */
export interface ConsentValue {
  accepted: boolean
  age: AgeDeclaration | null
}

/** Both answers are given. */
export const consentComplete = (
  value: ConsentValue,
): value is { accepted: true; age: AgeDeclaration } => value.accepted && value.age !== null
