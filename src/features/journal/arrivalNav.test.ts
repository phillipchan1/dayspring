import { describe, expect, it } from 'vitest'
import { shouldAutoOpenLatest, shouldSkipEntryLoad } from './arrivalNav'

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

  // Leaving the editor for a surface nulls entryId but deliberately does NOT
  // clear isNewEntryMode. That combination used to be rare; now that ⌘1 is the
  // Pages wall, "start a new entry, step out to look something up, a sync lands
  // while you're away" is an ordinary Tuesday. The guard is what makes coming
  // back land on your own draft rather than on whatever synced most recently.
  it('holds while you are away from the editor on a surface', () => {
    expect(shouldAutoOpenLatest({ ...base, isNewEntry: true, editorBlank: true })).toBe(false)
    expect(shouldAutoOpenLatest({ ...base, isNewEntry: true, editorBlank: false })).toBe(false)
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

describe('shouldSkipEntryLoad', () => {
  it('skips a body already seeded for the exact destination', () => {
    expect(shouldSkipEntryLoad(true, 'entry-b', 'entry-b')).toBe(true)
  })

  it('reloads when Back targets a different entry despite a stale skip flag', () => {
    expect(shouldSkipEntryLoad(true, 'entry-b', 'entry-a')).toBe(false)
  })

  it('reloads when no programmatic seed was requested', () => {
    expect(shouldSkipEntryLoad(false, 'entry-a', 'entry-a')).toBe(false)
  })
})
