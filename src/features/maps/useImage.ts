import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { activeDb } from '@/db/db'

const cache = new Map<string, HTMLImageElement>()

/** Decoded image for a data/http URL, cached; null while loading or without source. */
export function useImage(src: string | null | undefined): HTMLImageElement | null {
  const [loaded, setLoaded] = useState<{ src: string; img: HTMLImageElement } | null>(null)
  useEffect(() => {
    if (!src || cache.has(src)) return
    let cancelled = false
    const img = new Image()
    img.onload = () => {
      cache.set(src, img)
      if (!cancelled) setLoaded({ src, img })
    }
    img.src = src
    return () => {
      cancelled = true
    }
  }, [src])
  if (!src) return null
  return cache.get(src) ?? (loaded?.src === src ? loaded.img : null)
}

/** Picture stored in the asset table. */
export function useAssetImage(assetId: string | null | undefined): HTMLImageElement | null {
  const data = useLiveQuery(
    async () => (assetId ? ((await activeDb().assets.get(assetId))?.data ?? null) : null),
    [assetId],
  )
  return useImage(data)
}
