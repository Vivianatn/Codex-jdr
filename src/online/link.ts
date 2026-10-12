/**
 * A two-way message pipe between the host and one guest (D-245): a WebRTC
 * data channel in the app, an in-memory pair in tests.
 */
export interface Link {
  send(message: unknown): void
  onMessage(handler: (message: unknown) => void): void
  onClose(handler: () => void): void
  close(): void
}

/** Data channels deliver up to 256 KiB per message: bigger ones go in chunks. */
const CHUNK = 16 * 1024
/** A guest sending more than this in one message is cut off. */
const MAX_MESSAGE = 64 * 1024 * 1024
const HIGH_WATER = 4 * 1024 * 1024

interface Chunk {
  c: string
  i: number
  n: number
  d: string
}

export function channelLink(channel: RTCDataChannel): Link {
  const handlers: ((m: unknown) => void)[] = []
  const closers: (() => void)[] = []
  const partial = new Map<string, { parts: string[]; size: number }>()
  let closed = false
  let queue: Promise<void> = Promise.resolve()
  channel.bufferedAmountLowThreshold = 1024 * 1024

  const drained = () =>
    channel.bufferedAmount < HIGH_WATER
      ? Promise.resolve()
      : new Promise<void>((resolve) =>
          channel.addEventListener('bufferedamountlow', () => resolve(), { once: true }),
        )

  const finish = () => {
    if (closed) return
    closed = true
    closers.forEach((c) => c())
  }
  channel.addEventListener('close', finish)
  channel.addEventListener('error', finish)

  channel.addEventListener('message', (event: MessageEvent) => {
    if (typeof event.data !== 'string') return
    let data: unknown
    try {
      data = JSON.parse(event.data)
    } catch {
      return
    }
    const chunk = data as Partial<Chunk>
    if (typeof chunk.c === 'string' && typeof chunk.i === 'number' && typeof chunk.d === 'string') {
      const entry = partial.get(chunk.c) ?? { parts: [], size: 0 }
      entry.parts[chunk.i] = chunk.d
      entry.size += chunk.d.length
      if (entry.size > MAX_MESSAGE) {
        channel.close()
        return
      }
      partial.set(chunk.c, entry)
      if (entry.parts.filter((p) => p !== undefined).length === chunk.n) {
        partial.delete(chunk.c)
        try {
          const whole: unknown = JSON.parse(entry.parts.join(''))
          handlers.forEach((h) => h(whole))
        } catch {
          // A broken message is dropped.
        }
      }
      return
    }
    handlers.forEach((h) => h(data))
  })

  return {
    send(message) {
      if (closed) return
      const text = JSON.stringify(message)
      queue = queue.then(async () => {
        if (closed || channel.readyState !== 'open') return
        if (text.length <= CHUNK) {
          channel.send(text)
          return
        }
        const id = crypto.randomUUID()
        const n = Math.ceil(text.length / CHUNK)
        for (let i = 0; i < n; i++) {
          await drained()
          if (channel.readyState !== 'open') return
          channel.send(JSON.stringify({ c: id, i, n, d: text.slice(i * CHUNK, (i + 1) * CHUNK) }))
        }
      })
    },
    onMessage: (h) => void handlers.push(h),
    onClose: (h) => void closers.push(h),
    close() {
      channel.close()
      finish()
    },
  }
}

/** Two linked ends delivering asynchronously, with a JSON round trip like the real thing. */
export function memoryLinkPair(): [Link, Link] {
  const make = () => ({
    handlers: [] as ((m: unknown) => void)[],
    closers: [] as (() => void)[],
    closed: false,
  })
  const a = make()
  const b = make()
  const end = (self: ReturnType<typeof make>, other: ReturnType<typeof make>): Link => ({
    send(message) {
      if (self.closed) return
      const text = JSON.stringify(message)
      setTimeout(() => !other.closed && other.handlers.forEach((h) => h(JSON.parse(text))), 0)
    },
    onMessage: (h) => void self.handlers.push(h),
    onClose: (h) => void self.closers.push(h),
    close() {
      for (const side of [self, other])
        if (!side.closed) {
          side.closed = true
          side.closers.forEach((c) => c())
        }
    },
  })
  return [end(a, b), end(b, a)]
}
