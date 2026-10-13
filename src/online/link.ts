/**
 * A two-way message pipe between the operator's device and one player (D-245):
 * the server's relay in the app (D-262), an in-memory pair in tests.
 */
export interface Link {
  send(message: unknown): void
  onMessage(handler: (message: unknown) => void): void
  onClose(handler: () => void): void
  close(): void
}

/** One end of a relayed link: what arrives is `deliver`ed, `end` when the other side left. */
export interface RelayEnd {
  link: Link
  deliver(message: unknown): void
  end(): void
}

/**
 * A link carried by the server's WebSocket. `send` puts a message on the
 * socket; `onLocalClose` tells the server this side leaves.
 */
export function relayLink(send: (message: unknown) => void, onLocalClose: () => void): RelayEnd {
  const handlers: ((m: unknown) => void)[] = []
  const closers: (() => void)[] = []
  let closed = false
  const finish = () => {
    if (closed) return
    closed = true
    closers.forEach((c) => c())
  }
  return {
    link: {
      send: (message) => !closed && send(message),
      onMessage: (h) => void handlers.push(h),
      onClose: (h) => void closers.push(h),
      close() {
        if (closed) return
        onLocalClose()
        finish()
      },
    },
    deliver: (message) => !closed && handlers.forEach((h) => h(message)),
    end: finish,
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
