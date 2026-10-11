import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useSettingsStore } from '@/stores/settingsStore'
import { useResolvedTheme } from './usePreferences'

afterEach(() => useSettingsStore.setState({ theme: 'light', playDark: true, surface: 'prep' }))

describe('resolved theme (DA §10.6, §10.8, D-235)', () => {
  it('follows the preparation theme outside play', () => {
    useSettingsStore.setState({ theme: 'light', surface: 'prep' })
    const { result } = renderHook(() => useResolvedTheme())
    expect(result.current).toBe('light')
  })

  it('turns the play screen dark by default, and the GM can lift it', () => {
    useSettingsStore.setState({ theme: 'light', surface: 'play', playDark: true })
    const { result } = renderHook(() => useResolvedTheme())
    expect(result.current).toBe('dark')
    act(() => useSettingsStore.getState().setPlayDark(false))
    expect(result.current).toBe('light')
  })

  it('keeps the players’ window dark whatever the settings', () => {
    useSettingsStore.setState({ theme: 'light', surface: 'players', playDark: false })
    const { result } = renderHook(() => useResolvedTheme())
    expect(result.current).toBe('dark')
  })
})
