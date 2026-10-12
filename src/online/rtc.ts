/**
 * WebRTC without a signalling server (D-245). Candidates are gathered before
 * the description is turned into a code, so one code each way is enough.
 * Encryption (DTLS) is built into WebRTC; the codes carry the fingerprints.
 */

/** STUN lets two devices on different networks find each other; empty = same network only. */
export function iceServers(stun: string): RTCIceServer[] {
  const url = stun.trim()
  return url ? [{ urls: url }] : []
}

const CHANNEL = 'codex'

function waitForCandidates(pc: RTCPeerConnection, timeoutMs = 5000): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => {
      pc.removeEventListener('icegatheringstatechange', check)
      clearTimeout(timer)
      resolve()
    }
    const check = () => pc.iceGatheringState === 'complete' && done()
    // Slow STUN answers: go with the candidates found so far.
    const timer = setTimeout(done, timeoutMs)
    pc.addEventListener('icegatheringstatechange', check)
  })
}

export interface HostOffer {
  pc: RTCPeerConnection
  channel: RTCDataChannel
  sdp: string
}

export async function createHostOffer(servers: RTCIceServer[]): Promise<HostOffer> {
  const pc = new RTCPeerConnection({ iceServers: servers })
  const channel = pc.createDataChannel(CHANNEL, { ordered: true })
  await pc.setLocalDescription(await pc.createOffer())
  await waitForCandidates(pc)
  return { pc, channel, sdp: pc.localDescription!.sdp }
}

export async function acceptGuestAnswer(pc: RTCPeerConnection, sdp: string): Promise<void> {
  await pc.setRemoteDescription({ type: 'answer', sdp })
}

export interface GuestAnswer {
  pc: RTCPeerConnection
  sdp: string
  channel: Promise<RTCDataChannel>
}

export async function answerHostOffer(
  offerSdp: string,
  servers: RTCIceServer[],
): Promise<GuestAnswer> {
  const pc = new RTCPeerConnection({ iceServers: servers })
  const channel = new Promise<RTCDataChannel>((resolve) =>
    pc.addEventListener('datachannel', (e) => resolve(e.channel), { once: true }),
  )
  await pc.setRemoteDescription({ type: 'offer', sdp: offerSdp })
  await pc.setLocalDescription(await pc.createAnswer())
  await waitForCandidates(pc)
  return { pc, sdp: pc.localDescription!.sdp, channel }
}

/** Resolves once the data channel can carry messages. */
export function channelOpen(channel: RTCDataChannel, timeoutMs = 60_000): Promise<RTCDataChannel> {
  if (channel.readyState === 'open') return Promise.resolve(channel)
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Connection timed out')), timeoutMs)
    channel.addEventListener(
      'open',
      () => {
        clearTimeout(timer)
        resolve(channel)
      },
      { once: true },
    )
  })
}
