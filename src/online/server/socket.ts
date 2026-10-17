import { parseServerFrame, type ClientFrame, type ServerFrame } from '@shared/sync'

/**
 * The app's WebSocket to the server (D-262). The session cookie goes with the
 * connection request, like any other request to /api.
 *
 * Staying connected (D-270): a connection that stays silent is checked with a
 * ping, and one that does not answer is given up at once instead of waiting
 * for the browser to notice (a phone that slept, a Wi-Fi that changed). It
 * reconnects by itself, quickly at first (about 0.25 s, 0.5 s, 1 s…) then
 * less and less often, up to 30 s, with some randomness so that a whole table
 * does not come back in the same instant.
 */

export interface SocketEvents {
  onFrame(frame: ServerFrame): void
  onOpen(): void
  /** `signedOut` when the server closed the session; otherwise the connection dropped. */
  onDown(reason: 'signedOut' | 'dropped'): void
}

const FIRST_DELAY = 250
const MAX_DELAY = 30_000
/** Silence after which the connection is checked. */
export const IDLE_PING = 15_000
/** How long a ping may stay unanswered. */
export const PONG_TIMEOUT = 5_000
/** Server close code: the session ended (logout, new password, account deleted). */
const SESSION_ENDED = 4001
const OPEN = 1

export class ServerSocket {
  private ws: WebSocket | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private watch: ReturnType<typeof setInterval> | null = null
  private attempt = 0
  private running = false
  /** Last frame received, and when the pending ping was sent (null: none). */
  private heard = 0
  private pinged: number | null = null

  constructor(
    private readonly events: SocketEvents,
    private readonly url = defaultUrl(),
    private readonly make: (url: string) => WebSocket = (u) => new WebSocket(u),
    private readonly random: () => number = Math.random,
  ) {}

  start(): void {
    if (this.running) return
    this.running = true
    this.connect()
  }

  stop(): void {
    this.running = false
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.unwatch()
    const ws = this.ws
    this.ws = null
    ws?.close()
  }

  get open(): boolean {
    return this.ws?.readyState === OPEN
  }

  send(frame: ClientFrame): boolean {
    if (!this.open) return false
    this.ws!.send(JSON.stringify(frame))
    return true
  }

  /** Reconnects now instead of waiting for the next attempt (the network came back). */
  retryNow(): void {
    if (!this.running || this.ws) return
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.connect()
  }

  /** Reconnects now if down; if up, checks at once that the server still answers. */
  probe(): void {
    if (!this.running) return
    if (!this.ws) return this.retryNow()
    if (this.open && this.pinged === null) this.ping()
  }

  private ping(): void {
    this.pinged = Date.now()
    this.send({ t: 'ping' })
  }

  private connect(): void {
    const ws = this.make(this.url)
    this.ws = ws
    ws.addEventListener('open', () => {
      if (this.ws !== ws) return
      this.attempt = 0
      this.heard = Date.now()
      this.pinged = null
      this.watchOver(ws)
      this.events.onOpen()
    })
    ws.addEventListener('message', (event: MessageEvent) => {
      if (this.ws !== ws) return
      // Any frame proves the connection alive.
      this.heard = Date.now()
      this.pinged = null
      if (typeof event.data !== 'string') return
      let frame: ServerFrame | null = null
      try {
        frame = parseServerFrame(JSON.parse(event.data))
      } catch {
        frame = null
      }
      if (frame && frame.t !== 'pong') this.events.onFrame(frame)
    })
    ws.addEventListener('close', (event: CloseEvent) => {
      if (this.ws !== ws) return
      if (event.code === SESSION_ENDED) {
        this.ws = null
        this.unwatch()
        this.running = false
        this.events.onDown('signedOut')
        return
      }
      this.lost(ws)
    })
  }

  /** The connection is gone (closed, or silent too long): tell, then come back. */
  private lost(ws: WebSocket): void {
    if (this.ws !== ws) return
    this.ws = null
    this.unwatch()
    this.events.onDown('dropped')
    if (!this.running) return
    const ceiling = Math.min(MAX_DELAY, FIRST_DELAY * 2 ** this.attempt++)
    const delay = Math.round(ceiling * (0.5 + this.random() / 2))
    this.timer = setTimeout(() => {
      this.timer = null
      if (this.running) this.connect()
    }, delay)
  }

  private watchOver(ws: WebSocket): void {
    this.unwatch()
    this.watch = setInterval(() => {
      if (this.ws !== ws) return
      const now = Date.now()
      if (this.pinged !== null) {
        if (now - this.pinged >= PONG_TIMEOUT) {
          // A dead connection: do not wait for the browser to time out.
          this.lost(ws)
          ws.close()
        }
      } else if (now - this.heard >= IDLE_PING) this.ping()
    }, 1000)
  }

  private unwatch(): void {
    if (this.watch) clearInterval(this.watch)
    this.watch = null
  }
}

function defaultUrl(): string {
  if (typeof location === 'undefined') return 'ws://localhost/api/ws'
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/ws`
}
