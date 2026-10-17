import { LockKeyhole } from 'lucide-react'
import { lazy, Suspense, useEffect } from 'react'
import { Outlet } from 'react-router'
import { CandleOrnament } from '@/components/Brand'
import { preloadScreens } from '@/app/screens'
import { useIdle } from '@/app/useIdle'
import { useSurface } from '@/app/useSurface'
import { backupService } from '@/db/backups'
import { useT } from '@/i18n'
import { whenIdle } from '@/lib/dom'
import { lockSession, onLock, useSessionStore } from '@/security/session'
import { announceLock, followSession, serveSession } from '@/security/sessionChannel'
import { TermsGate } from '@/features/legal/TermsGate'
import { LockScreen } from './LockScreen'

// Loaded on demand: it pulls the online code, kept out of the lock screen (D-255).
const LinkRequired = lazy(() => import('./LinkRequired').then((m) => ({ default: m.LinkRequired })))

/** GM screens: shown only once an account is unlocked (D-241). */
export function RequireSession() {
  const unlocked = useSessionStore((s) => s.status === 'unlocked' && !s.delegated)
  // Fetch the first screens once the lock screen is up, while the password is typed.
  useEffect(() => (unlocked ? undefined : whenIdle(preloadScreens)), [unlocked])
  return unlocked ? <UnlockedApp /> : <LockScreen />
}

/** Each connection the effect below starts; only the latest one may be stopped. */
let connections = 0

function UnlockedApp() {
  const accountId = useSessionStore((s) => s.account?.id)
  const onlineUser = useSessionStore((s) => s.account?.online?.userId)
  const minutes = useSessionStore((s) => s.account?.autoLockMinutes ?? 0)
  const idle = useIdle(minutes * 60_000, minutes > 0)

  // The players' window gets the session from here, and locks with it.
  useEffect(() => {
    const stopServing = serveSession()
    const stopAnnouncing = onLock(announceLock)
    return () => {
      stopServing()
      stopAnnouncing()
    }
  }, [])

  useEffect(() => {
    if (idle) void lockSession()
  }, [idle])

  // An account linked online connects to the server (D-262). Loaded on demand: the
  // online code stays out of what the lock screen downloads (D-255).
  useEffect(() => {
    if (!onlineUser) return
    const run = ++connections
    void import('@/online/controller').then((online) => {
      const account = useSessionStore.getState().account
      if (run === connections && account?.online) void online.connectOnline(account)
    })
    return () => {
      // The import resolves later: a newer connection (remount, Strict Mode) must not be cut.
      void import('@/online/controller').then((online) => {
        if (run === connections) online.disconnectOnline()
      })
    }
  }, [accountId, onlineUser])

  // One automatic snapshot a day, at unlock (D-242), once the first screen is up.
  useEffect(() => {
    if (!accountId) return
    return whenIdle(() => {
      backupService.autoBackupIfDue().catch((e) => console.error('Backup failed', e))
    })
  }, [accountId])

  // Codex is online only (D-266): an account of this device alone must be linked first.
  if (!onlineUser)
    return (
      <Suspense fallback={null}>
        <LinkRequired />
      </Suspense>
    )
  // The current terms, accepted once per version (D-271).
  return (
    <TermsGate userId={onlineUser}>
      <Outlet />
    </TermsGate>
  )
}

/** Players' window: never asks for the password in front of the players. */
export function RequirePlayersSession() {
  const unlocked = useSessionStore((s) => s.status === 'unlocked')
  useEffect(() => followSession(), [])
  return unlocked ? <Outlet /> : <WaitingForGm />
}

function WaitingForGm() {
  const t = useT()
  useSurface('players')
  return (
    <main
      id="main"
      className="flex h-full flex-col items-center justify-center gap-4 bg-bg p-8 text-center"
      data-testid="players-waiting"
    >
      <CandleOrnament className="h-24" />
      <h1 className="flex items-center gap-3 type-screen-title text-ink">
        <LockKeyhole className="size-7 text-gold-text" aria-hidden />
        {t.account.viewWaiting}
      </h1>
      <p className="max-w-md text-ink-muted">{t.account.viewWaitingHint}</p>
    </main>
  )
}
