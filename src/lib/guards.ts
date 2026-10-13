/** Plain object (not null, not an array): the first check when validating untrusted data. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
