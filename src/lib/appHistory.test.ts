import { describe, expect, it } from 'vitest'
import {
  DEFAULT_APP_HISTORY,
  appHistoryEqual,
  entryReturnFromState,
  mergeAppHistory,
  mouseHistoryAction,
  mouseHistoryNeedsFallback,
  normalizeAppHistory,
} from './appHistory'

describe('mouseHistoryAction', () => {
  it('maps X1 / X2 to back and forward', () => {
    expect(mouseHistoryAction(3)).toBe('back')
    expect(mouseHistoryAction(4)).toBe('forward')
  })

  it('ignores the buttons a click already uses', () => {
    expect(mouseHistoryAction(0)).toBeNull()
    expect(mouseHistoryAction(1)).toBeNull()
    expect(mouseHistoryAction(2)).toBeNull()
  })
})

describe('mouseHistoryNeedsFallback', () => {
  it('drives history when the host left the stack untouched', () => {
    const frame = { tag: 'dayspring' }
    expect(mouseHistoryNeedsFallback(frame, frame)).toBe(true)
  })

  it('stays quiet when the host already popped', () => {
    expect(mouseHistoryNeedsFallback({ a: 1 }, { b: 2 })).toBe(false)
  })
})

describe('entryReturnFromState', () => {
  it('remembers Pages so Back from an entry returns to the wall', () => {
    const pages = mergeAppHistory(DEFAULT_APP_HISTORY, {
      surface: 'pages',
      pagesSpreadId: 'entry-1',
      pagesSubject: 'word:grace',
    })
    expect(entryReturnFromState(pages)).toEqual({
      surface: 'pages',
      scriptureBook: null,
      scriptureVerse: null,
      ascentAltitude: 0,
      ascentDrill: null,
      pagesSubject: 'word:grace',
      pagesSpreadId: 'entry-1',
    })
  })
})

describe('appHistoryEqual', () => {
  it('treats opening a Pages spread as a new frame', () => {
    const wall = normalizeAppHistory({ ...DEFAULT_APP_HISTORY, surface: 'pages' })
    const spread = mergeAppHistory(wall, { pagesSpreadId: 'e1' })
    expect(appHistoryEqual(wall, spread)).toBe(false)
  })
})
