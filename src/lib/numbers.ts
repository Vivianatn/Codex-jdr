/** "11,5" → 11.5; empty or invalid → null. */
export function parseNumber(text: string): number | null {
  const cleaned = text.trim().replace(',', '.').replace(/\s/g, '')
  if (!cleaned || !/^[-+]?\d*\.?\d+$/.test(cleaned)) return null
  return Number(cleaned)
}
