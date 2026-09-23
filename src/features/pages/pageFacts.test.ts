import { describe, expect, it } from 'vitest'
import { pageFacts } from './pageFacts'

const base = {
  created_at: '2026-09-23T13:58:00',
  updated_at: '2026-09-23T14:20:00',
  word_count: 412,
  source: 'native' as const,
}

describe('pageFacts', () => {
  it('gives the length of the page in the writer’s own words', () => {
    expect(pageFacts(base)).toEqual(['412 words'])
    expect(pageFacts({ ...base, word_count: 1 })).toEqual(['1 word'])
  })

  it('says nothing about an empty page', () => {
    expect(pageFacts({ ...base, word_count: 0 })).toEqual([])
  })

  it('does not call the same morning’s autosaves an edit', () => {
    expect(pageFacts(base).some((f) => f.startsWith('edited'))).toBe(false)
  })

  it('says when the page was returned to on a later day', () => {
    const facts = pageFacts({ ...base, updated_at: '2026-09-25T09:00:00' })
    expect(facts[1]).toMatch(/^edited /)
    expect(facts[1]).toContain('25')
    expect(facts[1]).not.toContain('2026')
  })

  it('names the year when the edit was in a different one', () => {
    expect(pageFacts({ ...base, updated_at: '2027-01-02T09:00:00' })[1]).toContain('2027')
  })

  // An imported page's updated_at is the day of the import, not an edit.
  it('never says "edited" on an imported page', () => {
    expect(pageFacts({ ...base, source: 'diarly', updated_at: '2026-10-01T09:00:00' })).toEqual([
      '412 words',
    ])
  })
})
