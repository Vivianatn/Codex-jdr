import * as Tooltip from '@radix-ui/react-tooltip'
import { MotionConfig } from 'framer-motion'
import type { ReactNode } from 'react'
import { createHashRouter, RouterProvider } from 'react-router'
import { Toaster } from 'sonner'
import { useSettingsStore } from '@/stores/settingsStore'
import { routes } from './routes'
import { useApplyPreferences, useResolvedTheme } from './usePreferences'

// Hash routing keeps deep links working from file:// and inside the Tauri shell.
const router = createHashRouter(routes)

/** Global providers: theme/motion preferences, tooltips and toasts. */
export function AppProviders({ children }: { children: ReactNode }) {
  useApplyPreferences()
  const animations = useSettingsStore((s) => s.animations)
  const theme = useResolvedTheme()

  return (
    <MotionConfig
      reducedMotion={animations === 'full' ? 'user' : 'always'}
      skipAnimations={animations === 'off'}
    >
      <Tooltip.Provider delayDuration={400} skipDelayDuration={200}>
        {children}
        <Toaster
          theme={theme}
          position="bottom-right"
          closeButton
          toastOptions={{
            classNames: {
              toast: '!rounded-md !border-line !bg-surface !text-ink !shadow-lifted !font-sans',
              description: '!text-ink-muted',
            },
          }}
        />
      </Tooltip.Provider>
    </MotionConfig>
  )
}

export function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  )
}
