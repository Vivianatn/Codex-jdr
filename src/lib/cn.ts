import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Teach tailwind-merge about our custom theme tokens so e.g. `shadow-soft`
// and `shadow-lifted` are treated as conflicting shadow utilities.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      shadow: ['soft', 'lifted', 'overlay'],
      radius: ['sm', 'md', 'lg', 'xl'],
    },
  },
})

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
