import { describe, expect, it } from 'vitest'
import { shouldAutoOpenLatest } from './arrivalNav'

const base = { wantedId: null, hasEntries: true, editorBlank: true, isNewEntry: false }

describe('shouldAutoOpenLatest', () => {
  it('opens the newest entry on an uninitialized blank editor', () => {
    expect(shouldAutoOpenLatest(base)).toBe(true)
  })

  it('does NOT hijack a deliberate new entry — the data-loss guard', () => {
    // A New entry is null-id + blank, exactly like an uninitialized editor. A
    // background sync must leave it alone, or the user's next keystrokes append
    // to the auto-opened entry instead of starting a fresh row.
    expect(shouldAutoOpenLatest({ ...base, isNewEntry: true })).toBe(false)
  })

  it('never overrides an entry that is already open', () => {
    expect(shouldAutoOpenLatest({ ...base, wantedId: 'abc' })).toBe(false)
  })

  it('does not open when the editor already holds text', () => {
    expect(shouldAutoOpenLatest({ ...base, editorBlank: false })).toBe(false)
  })

  it('does nothing when there are no entries to open', () => {
    expect(shouldAutoOpenLatest({ ...base, hasEntries: false })).toBe(false)
  })
})
