import type { GuestRole } from './onlineStore'

/**
 * Connection codes (D-245). There is no server: the host and each guest swap
 * two codes by any channel they already share (Discord, SMS…). The code holds
 * the WebRTC session description, whose DTLS fingerprint authenticates the
 * other side: whoever pastes the code back is the one the connection trusts.
 */

export interface InviteCode {
  v: 1
  kind: 'invite'
  /** Participant id the host gives this guest. */
  peerId: string
  role: GuestRole
  campaignName: string
  hostName: string
  sdp: string
}

export interface ReplyCode {
  v: 1
  kind: 'reply'
  peerId: string
  name: string
  sdp: string
}

export class InvalidCodeError extends Error {
  constructor() {
    super('Invalid connection code')
    this.name = 'InvalidCodeError'
  }
}

const PREFIX = 'CODEX1.'
/** Codes are pasted by hand: anything bigger is not one of ours. */
const MAX_CODE_LENGTH = 32_000

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const out = new Response(bytes as BodyInit).body!.pipeThrough(stream)
  return new Uint8Array(await new Response(out).arrayBuffer())
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

export async function encodeCode(code: InviteCode | ReplyCode): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(code))
  return PREFIX + toBase64Url(await pipe(json, new CompressionStream('deflate-raw')))
}

const str = (v: unknown, max: number): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= max

/** Parses and validates a pasted code (spaces and line breaks from chat apps are ignored). */
export async function decodeCode(text: string): Promise<InviteCode | ReplyCode> {
  const clean = text.replace(/\s+/g, '')
  if (!clean.startsWith(PREFIX) || clean.length > MAX_CODE_LENGTH) throw new InvalidCodeError()
  let data: unknown
  try {
    const bytes = await pipe(
      fromBase64Url(clean.slice(PREFIX.length)),
      new DecompressionStream('deflate-raw'),
    )
    if (bytes.length > 64_000) throw new InvalidCodeError()
    data = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    throw new InvalidCodeError()
  }
  const c = data as Record<string, unknown>
  if (typeof c !== 'object' || c === null || c.v !== 1 || !str(c.peerId, 64) || !str(c.sdp, 16_000))
    throw new InvalidCodeError()
  if (
    c.kind === 'invite' &&
    (c.role === 'editor' || c.role === 'player') &&
    str(c.campaignName, 200) &&
    str(c.hostName, 80)
  )
    return {
      v: 1,
      kind: 'invite',
      peerId: c.peerId,
      role: c.role,
      campaignName: c.campaignName,
      hostName: c.hostName,
      sdp: c.sdp,
    }
  if (c.kind === 'reply' && str(c.name, 80))
    return { v: 1, kind: 'reply', peerId: c.peerId, name: c.name, sdp: c.sdp }
  throw new InvalidCodeError()
}
