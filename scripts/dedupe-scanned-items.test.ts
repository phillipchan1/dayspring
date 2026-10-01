// Which copy of a twice-planted prayer survives. The rule is about what the Altar
// would lose, so it is tested on its own, away from the database.

import { describe, expect, it } from 'vitest'
import { planDedupe, type ScannedRow } from './dedupe-scanned-items.ts'

const row = (id: string, over: Partial<ScannedRow> = {}): ScannedRow => ({
  id,
  owner: 'o',
  entry_id: 'e1',
  type: 'prayer',
  content: 'Lord, keep her safe tonight.',
  thread_id: null,
  subject_tagged_at: null,
  resolved_at: null,
  ...over,
})

describe('planDedupe', () => {
  it('leaves a prayer planted once alone', () => {
    expect(planDedupe([row('a'), row('b', { content: 'Father, give me patience.' })])).toEqual([])
  })

  it('keeps the copy that is threaded over the one that is not, whatever the id order', () => {
    const [p] = planDedupe([row('a'), row('b', { thread_id: 't', subject_tagged_at: '2026-08-01' })])
    expect(p?.keep.id).toBe('b')
    expect(p?.drop.map((r) => r.id)).toEqual(['a'])
  })

  it('keeps a copy someone marked resolved over a merely threaded one', () => {
    const [p] = planDedupe([
      row('a', { thread_id: 't', subject_tagged_at: '2026-08-01' }),
      row('b', { resolved_at: '2026-09-01' }),
    ])
    expect(p?.keep.id).toBe('b')
  })

  it('breaks a tie by the lowest id, and drops every other copy', () => {
    const [p] = planDedupe([row('c'), row('a'), row('b')])
    expect(p?.keep.id).toBe('a')
    expect(p?.drop.map((r) => r.id)).toEqual(['b', 'c'])
  })

  it('never pairs the same words on different pages, as different types, or for different owners', () => {
    expect(
      planDedupe([
        row('a'),
        row('b', { entry_id: 'e2' }),
        row('c', { type: 'sense' }),
        row('d', { owner: 'someone-else' }),
      ]),
    ).toEqual([])
  })

  it('ignores a row whose page is gone', () => {
    expect(planDedupe([row('a', { entry_id: null }), row('b', { entry_id: null })])).toEqual([])
  })
})
