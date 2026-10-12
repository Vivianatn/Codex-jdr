import type { AccountSummary } from './accounts'
import { lockSession, sessionKey, startSession, useSessionStore } from './session'

/**
 * Hands the session to the players' window (D-241). The window opened on the
 * second screen cannot ask for the password in front of the players: it asks
 * the GM window, which answers only while unlocked, and it locks with it.
 * BroadcastChannel never leaves the browser and only reaches the same origin.
 */

export const SESSION_CHANNEL = 'codex-session'

type SessionMessage =
  | { type: 'request' }
  | { type: 'grant'; account: AccountSummary; key: Uint8Array }
  | { type: 'lock' }

function open(): BroadcastChannel | null {
  return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(SESSION_CHANNEL)
}

/** GM window: answers requests while unlocked. Returns the cleanup. */
export function serveSession(): () => void {
  const channel = open()
  if (!channel) return () => {}
  channel.onmessage = (event: MessageEvent<SessionMessage>) => {
    if (event.data?.type !== 'request') return
    const { status, account, delegated } = useSessionStore.getState()
    const key = sessionKey()
    if (status === 'unlocked' && !delegated && account && key)
      channel.postMessage({ type: 'grant', account, key: key.slice() } satisfies SessionMessage)
  }
  return () => channel.close()
}

/** GM window, when locking: the players' windows lock too. */
export function announceLock(): void {
  const channel = open()
  channel?.postMessage({ type: 'lock' } satisfies SessionMessage)
  channel?.close()
}

/** Players' window: asks until a GM window answers, then follows its lock. Returns the cleanup. */
export function followSession(retryMs = 2000): () => void {
  const channel = open()
  if (!channel) return () => {}
  const ask = () => {
    if (useSessionStore.getState().status === 'locked')
      channel.postMessage({ type: 'request' } satisfies SessionMessage)
  }
  channel.onmessage = (event: MessageEvent<SessionMessage>) => {
    const message = event.data
    const { status, delegated } = useSessionStore.getState()
    if (message?.type === 'grant' && status === 'locked') {
      useSessionStore.setState({ status: 'unlocking' })
      startSession(message.account, new Uint8Array(message.key), { delegated: true }).catch(() =>
        useSessionStore.setState({ status: 'locked' }),
      )
    } else if (message?.type === 'lock' && delegated) void lockSession()
  }
  ask()
  const timer = setInterval(ask, retryMs)
  return () => {
    clearInterval(timer)
    channel.close()
  }
}
