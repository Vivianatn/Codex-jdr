import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IDLE_PING, PONG_TIMEOUT, ServerSocket } from './socket'

/** A WebSocket the test opens, feeds and closes by hand. */
class FakeSocket {
  static made: FakeSocket[] = []
  readyState = 0
  sent: unknown[] = []
  private readonly listeners = new Map<string, ((event: unknown) => void)[]>()
  constructor() {
    FakeSocket.made.push(this)
  }
  addEventListener(type: string, listener: (event: unknown) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
  }
  emit(type: string, event: unknown = {}) {
    for (const l of this.listeners.get(type) ?? []) l(event)
  }
  open() {
    this.readyState = 1
    this.emit('open')
  }
  receive(frame: unknown) {
    this.emit('message', { data: JSON.stringify(frame) })
  }
  send(text: string) {
    this.sent.push(JSON.parse(text))
  }
  close(code = 1006) {
    if (this.readyState === 3) return
    this.readyState = 3
    this.emit('close', { code })
  }
}

const last = () => FakeSocket.made.at(-1)!

function connect(random = () => 1) {
  const events = { onFrame: vi.fn(), onOpen: vi.fn(), onDown: vi.fn() }
  const socket = new ServerSocket(
    events,
    'ws://test/api/ws',
    () => new FakeSocket() as unknown as WebSocket,
    random,
  )
  socket.start()
  return { socket, events }
}

beforeEach(() => {
  vi.useFakeTimers()
  FakeSocket.made = []
})
afterEach(() => vi.useRealTimers())

describe('staying connected (D-270)', () => {
  it('pings a silent connection, gives up on one that does not answer, and comes back fast', () => {
    const { socket, events } = connect()
    last().open()
    expect(events.onOpen).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(IDLE_PING + 1000)
    expect(last().sent).toEqual([{ t: 'ping' }])
    // The answer keeps it up.
    last().receive({ t: 'pong' })
    vi.advanceTimersByTime(PONG_TIMEOUT + 1000)
    expect(events.onDown).not.toHaveBeenCalled()
    expect(events.onFrame).not.toHaveBeenCalled()

    vi.advanceTimersByTime(IDLE_PING - PONG_TIMEOUT - 1000)
    expect(last().sent).toHaveLength(2)
    vi.advanceTimersByTime(PONG_TIMEOUT)
    expect(events.onDown).toHaveBeenCalledWith('dropped')
    expect(FakeSocket.made).toHaveLength(1)
    // First retry in a quarter of a second.
    vi.advanceTimersByTime(250)
    expect(FakeSocket.made).toHaveLength(2)
    last().open()
    expect(events.onOpen).toHaveBeenCalledTimes(2)
    socket.stop()
  })

  it('backs off with some randomness, and reconnects at once when asked', () => {
    const { socket } = connect(() => 0)
    last().close()
    // Half of 250 ms with the lowest draw.
    vi.advanceTimersByTime(125)
    expect(FakeSocket.made).toHaveLength(2)
    last().close()
    vi.advanceTimersByTime(249)
    expect(FakeSocket.made).toHaveLength(2)
    vi.advanceTimersByTime(1)
    expect(FakeSocket.made).toHaveLength(3)
    last().close()
    // The network came back: no waiting.
    socket.probe()
    expect(FakeSocket.made).toHaveLength(4)
    socket.stop()
  })

  it('checks an open connection on demand, and stops for good when the session ended', () => {
    const { socket, events } = connect()
    last().open()
    socket.probe()
    expect(last().sent).toEqual([{ t: 'ping' }])
    last().receive({ t: 'changed', campaignId: 'c1', rev: 3 })
    expect(events.onFrame).toHaveBeenCalledWith({ t: 'changed', campaignId: 'c1', rev: 3 })
    last().close(4001)
    expect(events.onDown).toHaveBeenCalledWith('signedOut')
    vi.advanceTimersByTime(60_000)
    expect(FakeSocket.made).toHaveLength(1)
    socket.stop()
  })
})
