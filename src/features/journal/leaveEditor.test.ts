import { describe, expect, it } from 'vitest'
import { DEFAULT_APP_HISTORY, mergeAppHistory, newEntryReturn } from '@/lib/appHistory'
import { editorUpDestination } from './leaveEditor'

const pagesTicket = {
  surface: 'pages' as const,
  scriptureBook: null,
  scriptureVerse: null,
  ascentAltitude: 0,
  ascentDrill: null,
  pagesSubject: 'word:grace',
  pagesSpreadId: null as string | null,
}

const lampTicket = {
  surface: 'scripture' as const,
  scriptureBook: 'John',
  scriptureVerse: null,
  ascentAltitude: 0,
  ascentDrill: null,
  pagesSubject: null,
  pagesSpreadId: null,
}

describe('newEntryReturn', () => {
  it('snapshots Pages so New from the wall can come back to the wall', () => {
    const pages = mergeAppHistory(DEFAULT_APP_HISTORY, { surface: 'pages' })
    expect(newEntryReturn(pages)).toEqual({
      ...pagesTicket,
      pagesSubject: null,
      pagesSpreadId: null,
    })
  })

  it('keeps the open reader when New is pressed while reading', () => {
    const reading = mergeAppHistory(DEFAULT_APP_HISTORY, {
      surface: 'pages',
      pagesSpreadId: 'page-x',
      pagesSubject: 'word:grace',
    })
    expect(newEntryReturn(reading).pagesSpreadId).toBe('page-x')
    expect(newEntryReturn(reading).pagesSubject).toBe('word:grace')
  })

  it('keeps an existing ticket when New is pressed from the editor', () => {
    const writing = mergeAppHistory(DEFAULT_APP_HISTORY, {
      surface: 'journal',
      entryId: 'old',
      entryReturn: pagesTicket,
    })
    expect(newEntryReturn(writing)).toEqual(pagesTicket)
  })

  it('does not invent a ticket on a cold-start editor — Escape goes to Pages by replace, not back()', () => {
    const home = mergeAppHistory(DEFAULT_APP_HISTORY, { surface: 'journal', entryId: 'today' })
    expect(newEntryReturn(home)).toBeNull()
  })
})

describe('editorUpDestination', () => {
  it('returns to Lamp / Altar / Ascent even after the draft is saved', () => {
    expect(
      editorUpDestination({
        entryId: 'new-1',
        entryReturn: lampTicket,
        pagesSubject: null,
      }),
    ).toEqual({ action: 'origin' })
  })

  it('opens the new page when New started from the wall and the draft saved', () => {
    expect(
      editorUpDestination({
        entryId: 'new-1',
        entryReturn: pagesTicket,
        pagesSubject: 'word:grace',
      }),
    ).toEqual({ action: 'pages', spreadId: 'new-1', subject: 'word:grace' })
  })

  it('pops home when New from the wall is still blank', () => {
    expect(
      editorUpDestination({
        entryId: null,
        entryReturn: pagesTicket,
        pagesSubject: 'word:grace',
      }),
    ).toEqual({ action: 'origin' })
  })

  it('returns to the reader you wrote from', () => {
    expect(
      editorUpDestination({
        entryId: 'page-x',
        entryReturn: { ...pagesTicket, pagesSpreadId: 'page-x' },
        pagesSubject: 'word:grace',
      }),
    ).toEqual({ action: 'origin' })
  })

  it('opens the new page when New started from a different reader', () => {
    expect(
      editorUpDestination({
        entryId: 'new-1',
        entryReturn: { ...pagesTicket, pagesSpreadId: 'page-x' },
        pagesSubject: 'word:grace',
      }),
    ).toEqual({ action: 'pages', spreadId: 'new-1', subject: 'word:grace' })
  })

  it('opens this page when there is no ticket (cold start, then stop writing)', () => {
    expect(
      editorUpDestination({
        entryId: 'today',
        entryReturn: null,
        pagesSubject: null,
      }),
    ).toEqual({ action: 'pages', spreadId: 'today', subject: null })
  })

  it('goes to the wall when a blank editor has no ticket', () => {
    expect(
      editorUpDestination({
        entryId: null,
        entryReturn: null,
        pagesSubject: null,
      }),
    ).toEqual({ action: 'pages', spreadId: null, subject: null })
  })
})
