import { describe, expect, it } from 'vitest'
import { isTypingTarget } from './dom'
import { isRecord } from './guards'
import { clamp } from './numbers'
import { compareText } from './text'

describe('shared helpers', () => {
  it('clamp bounds a value', () => {
    expect(clamp(5, 0, 3)).toBe(3)
    expect(clamp(-1, 0, 3)).toBe(0)
    expect(clamp(2, 0, 3)).toBe(2)
  })

  it('compareText sorts in French order, accents included', () => {
    expect(['Zoé', 'élan', 'Arbre', 'Éole'].sort(compareText)).toEqual([
      'Arbre',
      'élan',
      'Éole',
      'Zoé',
    ])
  })

  it('isRecord accepts plain objects only', () => {
    expect(isRecord({})).toBe(true)
    expect(isRecord([])).toBe(false)
    expect(isRecord(null)).toBe(false)
    expect(isRecord('x')).toBe(false)
  })

  it('isTypingTarget detects text fields', () => {
    expect(isTypingTarget(document.createElement('input'))).toBe(true)
    expect(isTypingTarget(document.createElement('button'))).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })
})
