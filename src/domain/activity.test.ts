import { describe, expect, it } from 'vitest'
import {
  ACTIVITY_MERGE_MS,
  activityAuthors,
  isValidActivity,
  nextActivity,
  type ActivityRecord,
  type NewActivity,
} from './activity'

const gm = { id: 'host', name: 'Agathe' }
const lea = { id: 'peer-1', name: 'Léa' }

function action(overrides: Partial<NewActivity> = {}): NewActivity {
  return {
    campaignId: 'c1',
    author: gm,
    kind: 'do',
    label: 'Gobelin 2 déplacé',
    at: 1000,
    ...overrides,
  }
}

let ids = 0
const newId = () => `a${++ids}`

describe('nextActivity', () => {
  it('starts a new line', () => {
    expect(nextActivity(undefined, action(), newId)).toMatchObject({
      label: 'Gobelin 2 déplacé',
      author: gm,
      count: 1,
    })
  })

  it('merges the same action by the same author a moment later', () => {
    const first = nextActivity(undefined, action(), newId)
    const second = nextActivity(first, action({ at: 1000 + ACTIVITY_MERGE_MS }), newId)
    expect(second).toMatchObject({ id: first.id, count: 2, at: 1000 + ACTIVITY_MERGE_MS })
  })

  it('keeps separate lines for another author, action, kind or a later moment', () => {
    const first = nextActivity(undefined, action(), newId)
    for (const other of [
      action({ author: lea }),
      action({ label: 'Gorak −7 PV' }),
      action({ kind: 'undo' }),
      action({ at: 1001 + ACTIVITY_MERGE_MS }),
    ])
      expect(nextActivity(first, other, newId).id).not.toBe(first.id)
  })

  it('trims and caps the label', () => {
    expect(
      nextActivity(undefined, action({ label: `  ${'x'.repeat(500)} ` }), newId).label,
    ).toHaveLength(200)
  })
})

describe('activityAuthors', () => {
  it('lists each author once, most recent first', () => {
    const records = [
      { author: gm, at: 1 },
      { author: lea, at: 3 },
      { author: gm, at: 2 },
    ] as ActivityRecord[]
    expect(activityAuthors(records)).toEqual([lea, gm])
  })
})

describe('isValidActivity', () => {
  const line = { ...nextActivity(undefined, action({ author: lea }), newId) }

  it('accepts a line signed by its sender', () => {
    expect(isValidActivity({ ...line }, 'c1', lea)).toBe(true)
  })

  it('refuses a line signed by someone else, from another campaign or malformed', () => {
    expect(isValidActivity({ ...line }, 'c1', gm)).toBe(false)
    expect(isValidActivity({ ...line, author: { id: lea.id, name: 'MJ' } }, 'c1', lea)).toBe(false)
    expect(isValidActivity({ ...line }, 'c2', lea)).toBe(false)
    expect(isValidActivity({ ...line, label: 'x'.repeat(201) }, 'c1', lea)).toBe(false)
    expect(isValidActivity({ ...line, count: 0 }, 'c1', lea)).toBe(false)
    expect(isValidActivity({ ...line, kind: 'hack' }, 'c1', lea)).toBe(false)
  })
})
