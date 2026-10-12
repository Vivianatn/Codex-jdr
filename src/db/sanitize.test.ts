import { describe, expect, it } from 'vitest'
import { createEntity } from '@/domain/entity'
import { defaultRules } from '@/rules'
import { parseExport } from './campaigns'
import { isSafeImageDataUrl, parseJsonSafely } from './sanitize'

const PNG = 'data:image/png;base64,iVBORw0KGgo='
const SVG = 'data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9ImFsZXJ0KDEpIi8+'

describe('import hardening (D-243)', () => {
  it('drops keys that could reach a prototype', () => {
    const parsed = parseJsonSafely(
      '{"a":1,"__proto__":{"polluted":true},"b":{"constructor":{"x":1}}}',
    )
    expect(parsed).toEqual({ a: 1, b: {} })
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    expect(Object.getPrototypeOf(parsed)).toBe(Object.prototype)
  })

  it.each([
    [PNG, true],
    ['data:image/webp;base64,UklGRg==', true],
    [SVG, false],
    ['javascript:alert(1)', false],
    ['https://example.com/x.png', false],
    ['data:image/png;base64,abc"onerror="x', false],
  ])('%s is a safe picture: %s', (url, safe) => {
    expect(isSafeImageDataUrl(url)).toBe(safe)
  })

  it('removes non-raster pictures from imported campaigns', () => {
    const entity = createEntity('player', 'c1', defaultRules())
    entity.identity.portrait = SVG
    entity.identity.body = PNG
    const file = {
      format: 'codex-campaign',
      version: 7,
      campaign: {
        id: 'c1',
        name: 'C',
        description: '',
        createdAt: 1,
        updatedAt: 1,
        lastOpenedAt: null,
      },
      entities: [entity],
      assets: [
        { id: 'a1', campaignId: 'c1', name: 'ok', data: PNG },
        { id: 'a2', campaignId: 'c1', name: 'bad', data: SVG },
      ],
    }
    const parsed = parseExport(JSON.stringify(file))
    expect(parsed.entities[0]!.identity.portrait).toBeNull()
    expect(parsed.entities[0]!.identity.body).toBe(PNG)
    expect(parsed.assets.map((a) => a.id)).toEqual(['a1'])
  })
})
