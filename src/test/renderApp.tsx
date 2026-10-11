import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { AppProviders } from '@/app/App'
import { routes } from '@/app/routes'
import { useSettingsStore } from '@/stores/settingsStore'

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
