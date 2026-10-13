import { parseServerFrame, type ClientFrame, type ServerFrame } from '@shared/sync'

/**
 * The app's WebSocket to the server (D-262), reconnecting by itself with a
 * growing delay (1 s, 2 s, 4 s… up to 30 s). The session cookie goes with the
 * connection request, like any other request to /api.
 */

export interface SocketEvents {
  onFrame(frame: ServerFrame): void
  onOpen(): void
  /** `signedOut` when the server closed the session; otherwise the connection dropped. */
  onDown(reason: 'signedOut' | 'dropped'): void
}

const MAX_DELAY = 30_000
/** Server close code: the session ended (logout, new password, account deleted). */
const SESSION_ENDED = 4001

export class ServerSocket {
  private ws: WebSocket | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private attempt = 0
  private running = false

  constructor(
    private readonly events: SocketEvents,
    private readonly url = defaultUrl(),
    private readonly make: (url: string) => WebSocket = (u) => new WebSocket(u),
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
    const ws = this.ws
    this.ws = null
    ws?.close()
  }

  get open(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
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

  private connect(): void {
    const ws = this.make(this.url)
    this.ws = ws
    ws.addEventListener('open', () => {
      if (this.ws !== ws) return
      this.attempt = 0
      this.events.onOpen()
    })
    ws.addEventListener('message', (event: MessageEvent) => {
      if (this.ws !== ws || typeof event.data !== 'string') return
      let frame: ServerFrame | null = null
      try {
        frame = parseServerFrame(JSON.parse(event.data))
      } catch {
        frame = null
      }
      if (frame) this.events.onFrame(frame)
    })
    ws.addEventListener('close', (event: CloseEvent) => {
      if (this.ws !== ws) return
      this.ws = null
      if (event.code === SESSION_ENDED) {
        this.running = false
        this.events.onDown('signedOut')
        return
      }
      this.events.onDown('dropped')
      if (!this.running) return
      const delay = Math.min(MAX_DELAY, 1000 * 2 ** this.attempt++)
      this.timer = setTimeout(() => {
        this.timer = null
        if (this.running) this.connect()
      }, delay)
    })
  }
}

function defaultUrl(): string {
  if (typeof location === 'undefined') return 'ws://localhost/api/ws'
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/ws`
}
