import { toast } from 'sonner'
import { HOST_ID } from '@/domain/turns'
import { getMessages } from '@/i18n'
import { enterRemoteDb, leaveRemoteDb, onLock, useSessionStore } from '@/security/session'
import { useCampaignStore } from '@/stores/campaignStore'
import { useRollStore } from '@/stores/rollStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { GuestSession, type Welcome } from './guestSession'
import { HostSession } from './hostSession'
import { channelLink } from './link'
import { useOnlineStore, type GuestRole } from './onlineStore'
import type { Intent } from './protocol'
import { answerHostOffer, channelOpen, iceServers } from './rtc'
import { decodeCode, encodeCode, InvalidCodeError, type InviteCode } from './signaling'

/**
 * The one online session of this device (D-245): hosting the open campaign, or
 * a guest in someone else's. Locking Codex ends it.
 */

let host: HostSession | null = null
let guest: GuestSession | null = null
let stopOnLock: (() => void) | null = null

const servers = () => iceServers(useSettingsStore.getState().stunServer)
const selfName = () => useSessionStore.getState().account?.username ?? 'MJ'

function resetStore() {
  useOnlineStore.setState({
    role: 'offline',
    campaignId: null,
    selfId: HOST_ID,
    guestRole: null,
    hostName: null,
    campaignName: null,
    peers: [],
  })
}

function endOnLock(end: () => void) {
  stopOnLock?.()
  stopOnLock = onLock(end)
}

// ---- host ------------------------------------------------------------------

export function startHosting(campaign: { id: string; name: string }): HostSession {
  if (host) return host
  host = new HostSession({
    campaignId: campaign.id,
    campaignName: campaign.name,
    hostName: selfName(),
    t: getMessages(),
    servers: servers(),
  })
  useOnlineStore.setState({
    role: 'host',
    campaignId: campaign.id,
    campaignName: campaign.name,
    selfId: HOST_ID,
    hostName: selfName(),
  })
  endOnLock(stopHosting)
  return host
}

export function stopHosting(): void {
  if (!host) return
  host.stop()
  host = null
  stopOnLock?.()
  stopOnLock = null
  resetStore()
}

export function hostSession(): HostSession | null {
  return host
}

// ---- guest -----------------------------------------------------------------

export interface PendingJoin {
  invite: InviteCode
  /** Code to send back to the host. */
  replyCode: string
  /** Resolves once connected and the campaign copied. */
  joined: Promise<Welcome>
  cancel: () => void
}

/** First step of joining: reads the invitation and prepares the reply code. */
export async function prepareJoin(inviteText: string): Promise<PendingJoin> {
  const invite = await decodeCode(inviteText)
  if (invite.kind !== 'invite') throw new InvalidCodeError()
  const answer = await answerHostOffer(invite.sdp, servers())
  const replyCode = await encodeCode({
    v: 1,
    kind: 'reply',
    peerId: invite.peerId,
    name: selfName(),
    sdp: answer.sdp,
  })
  let cancelled = false
  const joined = (async () => {
    const channel = await channelOpen(await answer.channel, 10 * 60_000)
    if (cancelled) throw new Error('cancelled')
    const t = getMessages()
    const session = new GuestSession(channelLink(channel), selfName(), {
      onPeers: (peers) => useOnlineStore.setState({ peers }),
      onRejected: (reason) => toast.error(t.online.rejected[reason]),
      onClosed: () => {
        if (guest !== session) return
        toast(t.online.hostClosed)
        void leaveGuest()
      },
    })
    const welcome = await session.ready
    guest = session
    enterRemoteDb(session.copy)
    useOnlineStore.setState({
      role: 'guest',
      campaignId: welcome.campaignId,
      campaignName: welcome.campaignName,
      selfId: welcome.selfId,
      guestRole: welcome.role,
      hostName: welcome.hostName,
    })
    endOnLock(() => void leaveGuest())
    answer.pc.addEventListener('connectionstatechange', () => {
      if (answer.pc.connectionState === 'failed') void session.leave()
    })
    return welcome
  })()
  joined.catch(() => answer.pc.close())
  return {
    invite,
    replyCode,
    joined,
    cancel: () => {
      cancelled = true
      answer.pc.close()
    },
  }
}

/** Leaves the joined campaign: the copy is deleted, the account's data is back. */
export async function leaveGuest(): Promise<void> {
  const session = guest
  if (!session) return
  guest = null
  stopOnLock?.()
  stopOnLock = null
  await useCampaignStore.getState().unload()
  useRollStore.setState({ campaignId: null, rolls: [] })
  leaveRemoteDb()
  resetStore()
  await session.leave()
}

export function guestRole(): GuestRole | null {
  return guest?.role ?? null
}

/** Players' moves and rolls, checked and played by the host. */
export function sendIntent(intent: Intent): void {
  guest?.intent(intent)
}

export function chooseCharacter(characterId: string | null): void {
  guest?.choose(characterId)
}
