import { describe, expect, it } from 'vitest'
import { slugify } from './files'

describe('slugify', () => {
  it('strips accents and punctuation', () => {
    expect(slugify('La Crypte des Murmures !')).toBe('la-crypte-des-murmures')
    expect(slugify("L'Épée d'Ébène")).toBe('l-epee-d-ebene')
  })

  it('falls back when nothing is left', () => {
    expect(slugify('!!!')).toBe('campagne')
  })
})
