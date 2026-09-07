import { describe, expect, it } from 'vitest'
import { statusLine, timeAgo, type SyncSnapshot } from './statusLine'

const CLEAR: SyncSnapshot = { online: true, pending: 0, blocked: 0, pulling: false }
const NOW = 1_700_000_000_000
const SAVED_AT = NOW - 120_000 // two minutes ago

const line = (over: Partial<Parameters<typeof statusLine>[0]> = {}) =>
  statusLine({
    save: 'saved',
    lastSavedAt: SAVED_AT,
    saveError: null,
    sync: CLEAR,
    now: NOW,
    ...over,
  })

describe('the nominal line', () => {
  it('spends one word when everything is well', () => {
    const s = line()
    expect(s.label).toBe('Saved')
    expect(s.tone).toBe('quiet')
    expect(s.busy).toBe(false)
  })

  it('keeps the timestamp and the sync state on hover, not on the page', () => {
    expect(line().detail).toBe('Saved 2m ago · Synced')
  })

  it('says so plainly before anything has been written', () => {
    expect(line({ lastSavedAt: null, save: 'idle' }).label).toBe('Not saved yet')
  })

  it('never adds words for work that clears on its own', () => {
    // Syncing is busy, not noteworthy: the dot carries it, the label does not.
    const s = line({ sync: { ...CLEAR, pending: 3 } })
    expect(s.label).toBe('Saved')
    expect(s.busy).toBe(true)
    expect(s.detail).toBe('Saved 2m ago · Syncing 3')
  })

  it('marks a save in flight as busy without changing its tone', () => {
    const s = line({ save: 'saving' })
    expect(s.label).toBe('Saving…')
    expect(s.tone).toBe('quiet')
    expect(s.busy).toBe(true)
  })
})

describe('when something needs the writer', () => {
  it('brings the words back when the connection is gone', () => {
    const s = line({ sync: { ...CLEAR, online: false } })
    expect(s.label).toBe('Saved · Offline')
    expect(s.tone).toBe('attention')
  })

  it('counts what is waiting, in the detail', () => {
    expect(line({ sync: { ...CLEAR, online: false, pending: 2 } }).detail).toBe(
      'Saved 2m ago · Offline · 2 waiting',
    )
  })

  it('says a blocked queue outright — it will not clear on its own', () => {
    const s = line({ sync: { ...CLEAR, blocked: 3 } })
    expect(s.label).toBe("3 didn't sync")
    expect(s.tone).toBe('attention')
  })

  it('puts a failed save above every other rung', () => {
    const s = line({ save: 'error', saveError: 'disk full', sync: { ...CLEAR, blocked: 3, online: false } })
    expect(s.label).toBe('Save failed')
    expect(s.tone).toBe('error')
    expect(s.detail).toContain('disk full')
  })

  it('ranks a blocked queue above merely being offline', () => {
    expect(line({ sync: { ...CLEAR, online: false, blocked: 1 } }).label).toBe("1 didn't sync")
  })
})

describe('timeAgo', () => {
  it('reads as a person would say it', () => {
    expect(timeAgo(NOW - 2_000, NOW)).toBe('just now')
    expect(timeAgo(NOW - 30_000, NOW)).toBe('30s ago')
    expect(timeAgo(NOW - 300_000, NOW)).toBe('5m ago')
    expect(timeAgo(NOW - 7_200_000, NOW)).toBe('2h ago')
  })
})
