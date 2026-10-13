/** Runs `task` once the browser is idle (after first paint); returns the cancel. */
export function whenIdle(task: () => void, timeout = 2000): () => void {
  if (typeof requestIdleCallback === 'function') {
    const id = requestIdleCallback(task, { timeout })
    return () => cancelIdleCallback(id)
  }
  const id = setTimeout(task, 200)
  return () => clearTimeout(id)
}

/** True when a keyboard event comes from a text field, so global shortcuts must not fire. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}
