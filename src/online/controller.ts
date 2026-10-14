import { toast } from 'sonner'
import { HOST_ID } from '@/domain/turns'
import { getMessages } from '@/i18n'
import { accounts, type AccountSummary, type OnlineLink } from '@/security/accounts'
import {
  accountDatabase,
  enterRemoteDb,
  leaveRemoteDb,
  onLock,
  updateSessionAccount,
  useSessionStore,
} from '@/security/session'
import { useCampaignStore } from '@/stores/campaignStore'
import { useRollStore } from '@/stores/rollStore'
import type { CampaignSummary, PublicUser, ServerFrame } from '@shared/sync'
import { GuestSession, type Welcome } from './guestSession'
import { HostSession } from './hostSession'
import { relayLink, type RelayEnd } from './link'
import { selfParticipant, useOnlineStore } from './onlineStore'
import type { Intent } from './protocol'
import { ApiError, server } from './server/api'
import { initialServerState, useServerStore } from './server/serverStore'
import { ServerSocket } from './server/socket'
import { linkOf } from './server/signIn'
import { SyncEngine } from './server/sync'

/**
 * The online side of this device (D-262): the WebSocket to the server, the
 * sync engine of the online campaigns, and the live-game relay (serving the
 * players as operator, or playing in someone else's game). Locking Codex
 * disconnects everything.
 */

let socket: ServerSocket | null = null
let engine: SyncEngine | null = null
let stopOnLock: (() => void) | null = null

interface Host {
  campaignId: string
  session: HostSession
  links: Map<string, RelayEnd>
  serving: boolean
  retry: ReturnType<typeof setTimeout> | null
}
let host: Host | null = null

interface Guest {
  campaignId: string
  session: GuestSession
  end: RelayEnd
}
let guest: Guest | null = null
let entering: {
  campaignId: string
  resolve: () => void
  reject: (error: Error) => void
} | null = null

const t = () => getMessages()
const selfName = () => selfParticipant().name

// ---- connection --------------------------------------------------------------------

function toUser(link: OnlineLink): PublicUser {
  return { id: link.userId, email: link.email, displayName: link.displayName }
}

/** After unlocking: an account linked online connects to the server. */
export async function connectOnline(account: AccountSummary): Promise<void> {
  disconnectOnline()
  if (!account.online) return
  const user = toUser(account.online)
  useServerStore.setState({ ...initialServerState, user, status: 'connecting' })
  useOnlineStore.setState({ selfId: user.id })
  const sync = new SyncEngine({
    db: accountDatabase,
    api: {
      ...server,
      campaigns: async () => (await server.campaigns()).campaigns,
    },
    self: selfParticipant,
    onRefused: (reason, count) => toast.error(t().online.refused(reason, count)),
    onPending: (pending) => useServerStore.setState({ pending }),
    onSynced: (synced) => useServerStore.setState({ synced }),
    onOffline: () => {
      if (useServerStore.getState().status === 'online') socket?.retryNow()
    },
    onCampaigns: (campaigns) => {
      announceRequests(useServerStore.getState().campaigns, campaigns)
      useServerStore.setState({ campaigns })
    },
  })
  engine = sync
  await sync.start()
  if (engine !== sync) return
  socket = new ServerSocket({ onOpen, onFrame, onDown })
  socket.start()
  stopOnLock = onLock(disconnectOnline)
  window.addEventListener('online', retrySoon)
}

/** Stops everything online (lock, unlink). Local work goes on. */
export function disconnectOnline(): void {
  stopServing()
  void leaveGuest()
  engine?.stop()
  engine = null
  socket?.stop()
  socket = null
  stopOnLock?.()
  stopOnLock = null
  if (typeof window !== 'undefined') window.removeEventListener('online', retrySoon)
  useServerStore.setState(initialServerState)
  useOnlineStore.setState({ selfId: HOST_ID, peers: [] })
}

function retrySoon() {
  socket?.retryNow()
}

function onOpen() {
  useServerStore.setState({ status: 'online' })
  engine?.setOnline(true)
  void engine?.reconcile()
  void refreshRequests()
  void refreshSessions()
  void refreshSocial()
  if (host) socket?.send({ t: 'serve', campaignId: host.campaignId })
}

function onDown(reason: 'signedOut' | 'dropped') {
  useServerStore.setState({
    status: reason === 'signedOut' ? 'signedOut' : 'offline',
    presence: {},
  })
  engine?.setOnline(false)
  // The relay went with the socket.
  if (host) {
    host.serving = false
    for (const end of host.links.values()) end.end()
    host.links.clear()
  }
  guest?.end.end()
}

function onFrame(frame: ServerFrame) {
  switch (frame.t) {
    case 'changed':
      return engine?.pullSoon(frame.campaignId)
    case 'campaigns':
      void engine?.reconcile()
      void refreshRequests()
      void refreshSessions()
      // A game that just started may now be served.
      if (host && !host.serving) socket?.send({ t: 'serve', campaignId: host.campaignId })
      return
    case 'sessions':
      return void refreshSessions()
    case 'friends':
      return void refreshSocial()
    case 'presence':
      return useServerStore.setState((s) => ({
        presence: { ...s.presence, [frame.campaignId]: frame.users },
      }))
    case 'serving':
      return onServing(frame.campaignId, frame.ok)
    case 'peer': {
      if (host?.campaignId !== frame.campaignId) return
      const { campaignId, peerId } = frame
      host.links.get(peerId)?.end()
      const end = relayLink(
        (data) => socket?.send({ t: 'down', campaignId, peerId, data }),
        () => socket?.send({ t: 'kick', campaignId, peerId }),
      )
      host.links.set(peerId, end)
      host.session.admit({ id: peerId, name: frame.name, characterId: frame.characterId }, end.link)
      return
    }
    case 'up':
      if (host?.campaignId === frame.campaignId) host.links.get(frame.peerId)?.deliver(frame.data)
      return
    case 'peerGone':
      if (host?.campaignId !== frame.campaignId) return
      host.links.get(frame.peerId)?.end()
      host.links.delete(frame.peerId)
      return
    case 'entered':
      if (entering?.campaignId === frame.campaignId) entering.resolve()
      return
    case 'enterFailed':
      if (entering?.campaignId === frame.campaignId) entering.reject(new EnterError(frame.reason))
      return
    case 'down':
      return guest?.end.deliver(frame.data)
    case 'hostGone':
      return guest?.end.end()
  }
}

async function refreshRequests(): Promise<void> {
  try {
    const { requests } = await server.myRequests()
    useServerStore.setState({ requests })
  } catch {
    // Offline: the list stays as it was.
  }
}

async function refreshSessions(): Promise<void> {
  try {
    const { sessions } = await server.openSessions()
    useServerStore.setState({ sessions })
  } catch {
    // Offline: the catalogue stays as it was.
  }
}

/** Own profile and adventurers; a toast for each new request received (D-267). */
export async function refreshSocial(): Promise<void> {
  try {
    const [{ profile }, friends] = await Promise.all([server.profile(), server.friends()])
    const before = useServerStore.getState().friends
    if (before)
      for (const f of friends.incoming)
        if (!before.incoming.some((b) => b.id === f.id))
          toast(t().adventurers.newRequest(f.displayName))
    useServerStore.setState({ profile, friends })
  } catch {
    // Offline: the lists stay as they were.
  }
}

/** Saves the profile; a new name also goes to the local account. */
export async function saveProfile(
  patch: Parameters<typeof server.updateProfile>[0],
): Promise<void> {
  const { profile } = await server.updateProfile(patch)
  useServerStore.setState({ profile })
  const local = useSessionStore.getState().account
  const user = useServerStore.getState().user
  if (local?.online && user && user.displayName !== profile.displayName) {
    const renamed = { ...user, displayName: profile.displayName }
    const account = await accounts.setOnline(local.id, linkOf(renamed))
    updateSessionAccount({ online: account.online })
    useServerStore.setState({ user: renamed })
  }
}

/** A GM hears of a new join request even in the middle of a game. */
function announceRequests(before: CampaignSummary[], after: CampaignSummary[]): void {
  for (const c of after) {
    const was = before.find((b) => b.id === c.id)?.pendingRequests ?? 0
    if (c.pendingRequests > was) toast(t().online.newRequest(c.name))
  }
}

/** The server list of campaigns, now (after accepting someone, for instance). */
export function refreshOnline(): void {
  void engine?.reconcile()
  void refreshRequests()
  void refreshSessions()
}

/**
 * GDPR erasure (D-266): the GM's campaigns are deleted from the server, the
 * others are left; then this device stops following the server.
 */
export async function eraseOnline(): Promise<void> {
  const { campaigns } = await server.campaigns()
  for (const c of campaigns)
    await (c.role === 'owner' ? server.deleteCampaign(c.id) : server.leaveCampaign(c.id))
  disconnectOnline()
}

/** Is this campaign kept on the server by this device? */
export function isOnlineCampaign(campaignId: string): boolean {
  return engine?.isSynced(campaignId) ?? false
}

/** Puts a campaign online (the GM's « Mettre en ligne »). */
export function uploadCampaign(campaignId: string): Promise<void> {
  return engine?.upload(campaignId) ?? Promise.resolve()
}

// ---- linking accounts --------------------------------------------------------------

/** Links the unlocked local account to a new or existing online account, then connects. */
export async function linkAccount(
  input:
    | { mode: 'register'; email: string; password: string; displayName: string }
    | { mode: 'login'; email: string; password: string },
): Promise<void> {
  const local = useSessionStore.getState().account
  if (!local) throw new ApiError('unauthenticated')
  const { user } =
    input.mode === 'register'
      ? await server.register({
          email: input.email,
          displayName: input.displayName,
          password: input.password,
        })
      : await server.login(input.email, input.password)
  const other = await accounts.findOnline(user.id)
  if (other && other.id !== local.id) {
    await server.logout().catch(() => null)
    throw new LinkedElsewhereError(other.username)
  }
  const account = await accounts.setOnline(local.id, linkOf(user))
  // The session gate connects as soon as the account says it is linked.
  updateSessionAccount({ online: account.online })
}

/**
 * This device stops following the server: the campaigns stay, as local ones;
 * changes not sent yet are dropped (the account was unlinked or deleted).
 */
export async function forgetOnline(accountId: string): Promise<void> {
  disconnectOnline()
  const db = accountDatabase()
  await db.transaction('rw', db.syncState, db.outbox, async () => {
    await db.syncState.clear()
    await db.outbox.clear()
  })
  await accounts.setOnline(accountId, null)
  updateSessionAccount({ online: undefined })
}

/** Signs in again after the server closed the session (expired, new password elsewhere). */
export async function reconnect(password: string): Promise<void> {
  const local = useSessionStore.getState().account
  if (!local?.online) return
  const { user } = await server.login(local.online.email, password)
  if (user.id !== local.online.userId) {
    await server.logout().catch(() => null)
    throw new ApiError('wrongCredentials')
  }
  const account = await accounts.setOnline(local.id, linkOf(user))
  updateSessionAccount({ online: account.online })
  await connectOnline(account)
}

/** The display name changed on the server. */
export async function renameOnline(displayName: string): Promise<void> {
  const local = useSessionStore.getState().account
  if (!local?.online) return
  const { user } = await server.rename(displayName)
  const account = await accounts.setOnline(local.id, linkOf(user))
  updateSessionAccount({ online: account.online })
  useServerStore.setState({ user })
  void refreshSocial()
}

export class LinkedElsewhereError extends Error {
  constructor(readonly username: string) {
    super('Online account linked to another local account')
    this.name = 'LinkedElsewhereError'
  }
}

// ---- operator: serving the players -------------------------------------------------

function onServing(campaignId: string, ok: boolean) {
  if (host?.campaignId !== campaignId) return
  host.serving = ok
  if (ok || host.retry) return
  // The server may not know about the game yet (its record is on the way): try again.
  host.retry = setTimeout(() => {
    if (!host) return
    host.retry = null
    if (!host.serving) socket?.send({ t: 'serve', campaignId: host.campaignId })
  }, 2000)
}

/** The operator of a running online game serves its players while the campaign is open. */
export function serveCampaign(campaign: { id: string; name: string }): void {
  if (host?.campaignId === campaign.id) return
  stopServing()
  host = {
    campaignId: campaign.id,
    session: new HostSession({
      campaignId: campaign.id,
      campaignName: campaign.name,
      hostName: selfName(),
      t: t(),
      db: accountDatabase,
    }),
    links: new Map(),
    serving: false,
    retry: null,
  }
  useOnlineStore.setState({ role: 'host', campaignId: campaign.id, campaignName: campaign.name })
  socket?.send({ t: 'serve', campaignId: campaign.id })
}

export function stopServing(): void {
  if (!host) return
  const current = host
  host = null
  if (current.retry) clearTimeout(current.retry)
  socket?.send({ t: 'unserve', campaignId: current.campaignId })
  current.session.stop()
  useOnlineStore.setState({ role: 'offline', campaignId: null, campaignName: null, peers: [] })
}

export function servingCampaign(): string | null {
  return host?.campaignId ?? null
}

export function hostSession(): HostSession | null {
  return host?.session ?? null
}

// ---- player: in someone else's game ------------------------------------------------

export class EnterError extends Error {
  constructor(readonly reason: 'notLive' | 'forbidden' | 'offline' | 'timeout') {
    super(`Cannot enter: ${reason}`)
    this.name = 'EnterError'
  }
}

/** Enters the running game of a campaign as a player; resolves once its table is copied. */
export async function enterGame(campaignId: string): Promise<Welcome> {
  if (guest?.campaignId === campaignId) return guest.session.ready
  await leaveGuest()
  if (!socket?.send({ t: 'enter', campaignId })) throw new EnterError('offline')
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new EnterError('timeout')), 15_000)
    entering = {
      campaignId,
      resolve: () => {
        clearTimeout(timer)
        resolve()
      },
      reject: (error) => {
        clearTimeout(timer)
        reject(error)
      },
    }
  }).finally(() => (entering = null))

  const end = relayLink(
    (data) => socket?.send({ t: 'up', data }),
    () => socket?.send({ t: 'leave' }),
  )
  const session = new GuestSession(end.link, selfName(), {
    onPeers: (peers) => useOnlineStore.setState({ peers }),
    onRejected: (reason) => toast.error(t().online.rejected[reason]),
    onClosed: () => {
      if (guest?.session !== session) return
      toast(t().online.hostClosed)
      void leaveGuest()
    },
  })
  guest = { campaignId, session, end }
  const timeout = setTimeout(() => void session.leave(), 20_000)
  try {
    const welcome = await session.ready
    enterRemoteDb(session.copy)
    useOnlineStore.setState({
      role: 'guest',
      campaignId: welcome.campaignId,
      campaignName: welcome.campaignName,
      selfId: welcome.selfId,
      guestRole: welcome.role,
      hostName: welcome.hostName,
    })
    return welcome
  } catch {
    throw new EnterError('timeout')
  } finally {
    clearTimeout(timeout)
  }
}

/** Leaves the game: the copy is deleted, the account's data is back. */
export async function leaveGuest(): Promise<void> {
  const current = guest
  if (!current) return
  guest = null
  const wasIn = useOnlineStore.getState().role === 'guest'
  if (wasIn) {
    await useCampaignStore.getState().unload()
    useRollStore.setState({ campaignId: null, rolls: [] })
    leaveRemoteDb()
  }
  useOnlineStore.setState({
    role: 'offline',
    campaignId: null,
    campaignName: null,
    guestRole: null,
    hostName: null,
    peers: [],
    selfId: useServerStore.getState().user?.id ?? HOST_ID,
  })
  await current.session.leave()
}

/** Players' moves and rolls, checked and played by the operator. */
export function sendIntent(intent: Intent): void {
  guest?.session.intent(intent)
}

export function chooseCharacter(characterId: string | null): void {
  guest?.session.choose(characterId)
}
