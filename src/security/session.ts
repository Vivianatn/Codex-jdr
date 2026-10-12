import { toast } from 'sonner'
import { create } from 'zustand'
import { accountDbName, CodexDB, setActiveDb } from '@/db/db'
import { getMessages } from '@/i18n'
import { useCampaignStore } from '@/stores/campaignStore'
import { useRollStore } from '@/stores/rollStore'
import type { AccountSummary } from './accounts'
import { wipe } from './crypto'

/**
 * The unlocked account (D-241). The data key lives only in memory, here and in
 * the database middleware: never in localStorage, sessionStorage or IndexedDB.
 * Reloading the page or locking forgets it.
 */

export type SessionStatus = 'locked' | 'unlocking' | 'unlocked'

interface SessionState {
  status: SessionStatus
  account: AccountSummary | null
  /** Players' window: unlocked by the GM window, and locked with it. */
  delegated: boolean
}

export const useSessionStore = create<SessionState>()(() => ({
  status: 'locked',
  account: null,
  delegated: false,
}))

let currentKey: Uint8Array | null = null

const onLockListeners = new Set<() => void>()

/** Called when the GM locks (not the players' window). Returns the unsubscribe. */
export function onLock(listener: () => void): () => void {
  onLockListeners.add(listener)
  return () => onLockListeners.delete(listener)
}

/** Data key of the open session, for the players' window hand-off only. */
export function sessionKey(): Uint8Array | null {
  return currentKey
}

function reportCorrupt() {
  toast.error(getMessages().account.corruptRecord, { id: 'codex-corrupt-record' })
}

/** Opens the account's encrypted database and makes it the active one. Takes ownership of `key`. */
export async function startSession(
  account: AccountSummary,
  key: Uint8Array,
  { delegated = false }: { delegated?: boolean } = {},
): Promise<CodexDB> {
  const db = new CodexDB(accountDbName(account.id), { key, onCorrupt: reportCorrupt })
  await db.open()
  setActiveDb(db)
  if (currentKey && currentKey !== key) wipe(currentKey)
  currentKey = key
  // Ask the browser not to evict the data under storage pressure.
  void navigator.storage?.persist?.().catch(() => false)
  if (import.meta.env.DEV) (window as unknown as { __codexDb?: CodexDB }).__codexDb = db
  useSessionStore.setState({ status: 'unlocked', account, delegated })
  return db
}

export function updateSessionAccount(patch: Partial<AccountSummary>): void {
  const { account } = useSessionStore.getState()
  if (account) useSessionStore.setState({ account: { ...account, ...patch } })
}

/** Saves what is pending, forgets every decrypted copy and the key. */
export async function lockSession(): Promise<void> {
  const { status, delegated } = useSessionStore.getState()
  if (status !== 'unlocked') return
  if (!delegated) onLockListeners.forEach((listener) => listener())
  try {
    await useCampaignStore.getState().unload()
  } finally {
    useRollStore.setState({ campaignId: null, rolls: [] })
    setActiveDb(null)
    wipe(currentKey)
    currentKey = null
    if (import.meta.env.DEV) delete (window as unknown as { __codexDb?: CodexDB }).__codexDb
    useSessionStore.setState({ status: 'locked', account: null, delegated: false })
  }
}
