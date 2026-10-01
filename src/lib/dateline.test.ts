import { describe, expect, it } from 'vitest'
import { formatDateline } from './dateline'

describe('formatDateline', () => {
  const now = new Date(2026, 9, 1, 9) // Thu 1 Oct 2026, local

  it('is the weekday and the date, joined by a middle dot', () => {
    const s = formatDateline(new Date(2026, 9, 1, 6, 40).toISOString(), now)
    expect(s).toContain(' · ')
    expect(s).not.toMatch(/2026/)
  })

  it('names the year only when it is not this one', () => {
    expect(formatDateline(new Date(2025, 4, 12).toISOString(), now)).toMatch(/2025/)
  })

  it('is empty for a date it cannot read, rather than "Invalid Date"', () => {
    expect(formatDateline('not a date', now)).toBe('')
  })
})
