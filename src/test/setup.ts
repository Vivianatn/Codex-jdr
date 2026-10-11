import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

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
