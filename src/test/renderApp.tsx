import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { AppProviders } from '@/app/App'
import { routes } from '@/app/routes'
import * as screens from '@/app/screens'
import { useSettingsStore } from '@/stores/settingsStore'

// Screens load on demand (D-255): import them all up front so tests don't wait on the transform.
await Promise.all(Object.values(screens).flatMap((s) => ('preload' in s ? [s.preload()] : [])))

/** Renders the full app (real routes, real Dexie on fake-indexeddb) at `path`. */
export function renderApp(path = '/') {
  useSettingsStore.setState({ animations: 'off' })
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const user = userEvent.setup()
  const utils = render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return { ...utils, user, router }
}
