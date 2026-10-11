import { useEffect, useState } from 'react'

/** True after `ms` without pointer or keyboard activity in the window. */
export function useIdle(ms: number, enabled = true) {
  const [idle, setIdle] = useState(false)
  useEffect(() => {
    if (!enabled) return
    let timer = window.setTimeout(() => setIdle(true), ms)
    const reset = () => {
      setIdle(false)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setIdle(true), ms)
    }
    const events = ['pointerdown', 'keydown', 'wheel'] as const
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    return () => {
      window.clearTimeout(timer)
      events.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [ms, enabled])
  return enabled && idle
}
