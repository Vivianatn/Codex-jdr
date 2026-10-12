/**
 * Hardening of imported files (D-243). Pictures typed in Codex are always
 * re-encoded through a canvas; imported files are not, so they are checked here.
 */

/** Largest import file read into memory. */
export const MAX_IMPORT_BYTES = 256 * 1024 * 1024

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

/** JSON.parse without the keys that could reach an object's prototype. */
export function parseJsonSafely(text: string): unknown {
  return JSON.parse(text, (key, value: unknown) => (FORBIDDEN_KEYS.has(key) ? undefined : value))
}

// Raster formats only: an SVG can carry scripts and external references.
const SAFE_IMAGE = /^data:image\/(?:png|jpeg|webp|gif|avif);base64,[A-Za-z0-9+/]*={0,2}$/

export function isSafeImageDataUrl(value: unknown): value is string {
  return typeof value === 'string' && SAFE_IMAGE.test(value)
}

/** The picture if it is a raster data URL, otherwise null. */
export function safeImage(value: unknown): string | null {
  return isSafeImageDataUrl(value) ? value : null
}
