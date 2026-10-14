import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import { CodexDB, setActiveDb } from '@/db/db'
import { DEFAULT_AUTO_LOCK } from '@/security/accounts'
import { useSessionStore } from '@/security/session'
import type * as Controller from '@/online/controller'

// Accounts are online (D-266); component tests never reach a server.
vi.mock('@/online/controller', async (original) => ({
  ...(await original<typeof Controller>()),
  connectOnline: async () => {},
  serveCampaign: () => {},
}))

// Component tests run unlocked, on a plain database (encryption has its own tests).
setActiveDb(new CodexDB('codex-test'))
useSessionStore.setState({
  status: 'unlocked',
  delegated: false,
  account: {
    id: 'test-account',
    username: 'MJ',
    createdAt: 0,
    lastLoginAt: 0,
    autoLockMinutes: DEFAULT_AUTO_LOCK,
    online: { userId: 'test-user', email: 'mj@exemple.fr', displayName: 'MJ' },
  },
})

// Full-app renders (Dexie + router + motion) can take more than 1 s on slow machines.
configure({ asyncUtilTimeout: 4000 })

afterEach(() => {
  cleanup()
  localStorage.clear()
})

// jsdom does not implement matchMedia; components use it for the system theme.
if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}

// jsdom has no ResizeObserver; Radix measures tooltip arrows with it.
if (!('ResizeObserver' in window)) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  ;(window as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub
  ;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub
}
