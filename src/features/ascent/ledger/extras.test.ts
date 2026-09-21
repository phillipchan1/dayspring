import { describe, expect, it } from 'vitest'
import type { Subject } from '@/features/pages/subjects'
import { newIn, onePerMonth, photosIn } from './extras'
import { seedMarkdown } from './write'

const H = 'a'.repeat(64)
const B = 'b'.repeat(64)
const pages = [
  { id: 'e1', created_at: '2026-03-14T12:00:00Z', body_markdown: 'Met Dr. Alvarez today. Kind eyes.\n\n![porch](attachment:' + H + '.jpg?size=f)' },
  { id: 'e2', created_at: '2026-03-20T12:00:00Z', body_markdown: 'Dr. Alvarez again.\n![](attachment:' + B + '.png)' },
  { id: 'e3', created_at: '2026-04-02T12:00:00Z', body_markdown: 'Coffee with God this morning. Nothing new.' },
]
const alvarez: Subject = { key: 'c:alvarez', label: 'Dr. Alvarez', terms: ['Dr. Alvarez', 'Alvarez'], kind: 'person', firstSeen: '2026-03-14' }
const god: Subject = { key: 'c:god', label: 'God', terms: ['God'], kind: 'person', firstSeen: '2026-04-02' }
const coffee: Subject = { key: 'c:coffee', label: 'coffee', terms: ['coffee'], kind: 'term', firstSeen: '2026-04-02' }
const old: Subject = { key: 'c:maya', label: 'Maya', terms: ['Maya'], kind: 'person', firstSeen: '2019-01-01' }

describe('photosIn', () => {
  it('finds every photo on the span’s pages, and one per month for a filmstrip', () => {
    const ps = photosIn(pages, '2026-03-01', '2026-03-31')
    expect(ps.map((p) => [p.entryId, p.ext])).toEqual([['e1', 'jpg'], ['e2', 'png']])
    expect([...onePerMonth(ps).values()].map((p) => p.entryId)).toEqual(['e1'])
    expect(photosIn(pages, '2026-04-01', '2026-04-30')).toEqual([])
  })
})

describe('newIn', () => {
  it('lists people whose first page is in the span, with the line they came in on', () => {
    const got = newIn([alvarez, god, coffee, old], pages, '2026-03-01', '2026-04-30')
    expect(got).toEqual([{ label: 'Dr. Alvarez', date: '2026-03-14', entryId: 'e1', line: 'Met Dr. Alvarez today. Kind eyes.' }])
  })
})

describe('seedMarkdown', () => {
  it('quotes the lines verbatim with dates, then the chosen question', () => {
    const md = seedMarkdown(
      { title: "Dad's diagnosis", groups: [{ label: "Dad's diagnosis", lines: [{ date: '2026-03-06', text: 'Dad called.' }, { date: '2026-09-16', text: 'Pray for Dad.' }] }] },
      'now',
    )
    expect(md).toBe(
      "## Dad's diagnosis\n\n> Dad called. — Mar 6\n>\n> Pray for Dad. — Sep 16\n\n*Reading these back — what do you see now that you couldn't see then?*\n\n",
    )
  })
})
