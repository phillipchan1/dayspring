import { describe, expect, it } from 'vitest'
import { ritualBackTo, ritualLanding } from './ritualEntryNav'
import type { EntryReturnContext } from '@/lib/appHistory'

const ret = (over: Partial<EntryReturnContext>): EntryReturnContext => ({
  surface: 'pages',
  scriptureBook: null,
  scriptureVerse: null,
  ascentAltitude: 0,
  ascentDrill: null,
  pagesSubject: null,
  pagesSpreadId: null,
  ...over,
})

describe('ritualBackTo', () => {
  it('goes back to the journal from a blank page or the wall', () => {
    expect(ritualBackTo(null)).toEqual({ backTo: 'your journal', backShort: 'Journal' })
    expect(ritualBackTo(ret({}))).toEqual({ backTo: 'your journal', backShort: 'Journal' })
  })

  it('goes back to the page it was opened from', () => {
    expect(ritualBackTo(ret({ pagesSpreadId: 'e1' }))).toEqual({ backTo: 'the page', backShort: 'Page' })
  })

  it('names any other surface it came from', () => {
    expect(ritualBackTo(ret({ surface: 'altar' }))).toEqual({ backTo: 'the Altar', backShort: 'Altar' })
  })
})

describe('ritualLanding', () => {
  it('says where the ritual will begin', () => {
    expect(ritualLanding(false)).toBe('Begins on this page.')
    expect(ritualLanding(true)).toBe('Begins on a new page. This entry stays as it is.')
  })
})
