import { describe, expect, it } from 'vitest'
import { clearLocalPreferences } from './useCampaignActions'

describe('clearLocalPreferences (GDPR erasure, D-240)', () => {
  it('removes every codex key and leaves the others', () => {
    localStorage.setItem('codex.settings', '{}')
    localStorage.setItem('codex.ui', '{}')
    localStorage.setItem('other-app', 'keep')
    clearLocalPreferences()
    expect(localStorage.getItem('codex.settings')).toBeNull()
    expect(localStorage.getItem('codex.ui')).toBeNull()
    expect(localStorage.getItem('other-app')).toBe('keep')
    localStorage.removeItem('other-app')
  })
})
