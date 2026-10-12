import * as Tooltip from '@radix-ui/react-tooltip'
import { MotionConfig } from 'framer-motion'
import type { ReactNode } from 'react'
import { createHashRouter, RouterProvider } from 'react-router'
import { Toaster } from 'sonner'
import { AnalyticsNotice } from '@/features/settings/AnalyticsNotice'
import { useSettingsStore } from '@/stores/settingsStore'
import { routes } from './routes'
import { useMediaQuery } from './useMediaQuery'
import { useApplyPreferences, useResolvedTheme } from './usePreferences'

// Hash routing keeps deep links working from file:// and inside the Tauri shell.
const router = createHashRouter(routes)

/** Global providers: theme/motion preferences, tooltips and toasts. */
export function AppProviders({ children }: { children: ReactNode }) {
  useApplyPreferences()
  const animations = useSettingsStore((s) => s.animations)
  const theme = useResolvedTheme()
  // In play, toasts sit at the bottom left of the board, clear of the groups
  // column and the zoom control (DA §8.11, §10.6).
  const playing = useSettingsStore((s) => s.surface === 'play')
  // The groups column only exists from the `lg` breakpoint: below it, no room to leave.
  const besideGroups = useMediaQuery('(min-width: 1024px)')

  return (
    <MotionConfig
      reducedMotion={animations === 'full' ? 'user' : 'always'}
      skipAnimations={animations === 'off'}
    >
      <Tooltip.Provider delayDuration={400} skipDelayDuration={200}>
        {children}
        <Toaster
          theme={theme}
          position={playing ? 'bottom-left' : 'bottom-right'}
          offset={playing && besideGroups ? { left: 296, bottom: 92 } : 20}
          closeButton
          toastOptions={{
            classNames: {
              toast: playing
                ? '!rounded-xl !border-[var(--codex-glass-line)] !bg-[var(--codex-surface-glass)] !backdrop-blur-[16px] !text-ink !shadow-lifted !font-sans'
                : '!rounded-xl !border-line !bg-surface-raised !text-ink !shadow-lifted !font-sans',
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
      <AnalyticsNotice />
    </AppProviders>
  )
}
