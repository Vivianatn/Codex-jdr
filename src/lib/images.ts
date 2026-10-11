export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/**
 * Shrinks an image to fit `maxWidth × maxHeight` (never enlarges) and encodes
 * it as WebP, transparency kept. Keeps exports small and self-contained.
 */
export function fitImage(img: HTMLImageElement, maxWidth: number, maxHeight: number): string {
  const scale = Math.min(1, maxWidth / img.naturalWidth, maxHeight / img.naturalHeight)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
  canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/webp', 0.9)
}

/** Reads an image file; rejects anything that is not a readable image. */
export async function imageFromFile(file: File): Promise<HTMLImageElement> {
  if (!file.type.startsWith('image/')) throw new Error('not an image')
  return loadImage(await readFileAsDataUrl(file))
}
