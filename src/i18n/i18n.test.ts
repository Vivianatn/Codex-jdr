import { describe, expect, it } from 'vitest'
import { CampaignImportError } from '@/db/campaigns'
import { importErrorMessage } from '@/features/campaigns/useCampaignActions'
import { resolveTheme } from '@/stores/settingsStore'
import { formatRelativeTime, getMessages } from '.'

const t = getMessages('fr')

describe('formatRelativeTime', () => {
  const now = Date.UTC(2026, 9, 11, 12)

  it('says "à l’instant" under a minute', () => {
    expect(formatRelativeTime(now - 20_000, 'fr-FR', t.time.justNow, now)).toBe('à l’instant')
  })

  it('uses natural French wording', () => {
    expect(formatRelativeTime(now - 24 * 3600_000, 'fr-FR', t.time.justNow, now)).toBe('hier')
    expect(formatRelativeTime(now - 3 * 3600_000, 'fr-FR', t.time.justNow, now)).toBe(
      'il y a 3 heures',
    )
  })
})

describe('importErrorMessage', () => {
  it('maps every import error to a French message', () => {
    expect(importErrorMessage(t, new CampaignImportError('invalidJson'))).toBe(
      t.importErrors.invalidJson,
    )
    expect(importErrorMessage(t, new CampaignImportError('unsupportedVersion', 4))).toContain(
      'format 4',
    )
    expect(importErrorMessage(t, new Error('boom'))).toBe(t.errors.generic)
  })
})

describe('resolveTheme', () => {
  it('follows the system only in "system" mode', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('light', true)).toBe('light')
  })
})
