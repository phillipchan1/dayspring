import { describe, expect, it } from 'vitest'
import {
  DEFAULT_APP_HISTORY,
  appHistoryEqual,
  entryReturnFromState,
  entryReturnLabel,
  keyboardHistoryAction,
  mergeAppHistory,
  mouseHistoryAction,
  mouseHistoryNeedsFallback,
  normalizeAppHistory,
  type EntryReturnContext,
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

describe('pagesVolume', () => {
  it('keeps the shelf or an open volume on the frame, and on the ticket out of it', () => {
    const at = normalizeAppHistory({ ...DEFAULT_APP_HISTORY, surface: 'pages', pagesVolume: 7, pagesVolumeFrom: 'shelf' })
    expect(at.pagesVolume).toBe(7)
    expect(at.pagesVolumeFrom).toBe('shelf')
    expect(entryReturnFromState(at)?.pagesVolume).toBe(7)
    expect(normalizeAppHistory({ ...DEFAULT_APP_HISTORY, pagesVolume: -1 as number, pagesVolumeFrom: 'x' as 'wall' }).pagesVolume).toBeNull()
  })
})

/** A key event as the browser hands it over — the bare chord unless said otherwise. */
const chord = (over: Partial<Parameters<typeof keyboardHistoryAction>[0]>) => ({
  key: '[',
  code: 'BracketLeft',
  metaKey: true,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...over,
})

describe('keyboardHistoryAction', () => {
  it('reads ⌘[ as Back and ⌘] as Forward', () => {
    expect(keyboardHistoryAction(chord({}))).toBe('back')
    expect(keyboardHistoryAction(chord({ key: ']', code: 'BracketRight' }))).toBe('forward')
  })

  it('finds the bracket by position when the layout types something else', () => {
    expect(keyboardHistoryAction(chord({ key: 'ü', code: 'BracketLeft' }))).toBe('back')
  })

  it('leaves every other chord alone', () => {
    expect(keyboardHistoryAction(chord({ metaKey: false }))).toBeNull() // a typed "["
    expect(keyboardHistoryAction(chord({ shiftKey: true }))).toBeNull() // ⇧⌘[ — previous tab
    expect(keyboardHistoryAction(chord({ altKey: true }))).toBeNull()
    expect(keyboardHistoryAction(chord({ ctrlKey: true }))).toBeNull()
    expect(keyboardHistoryAction(chord({ key: 'k', code: 'KeyK' }))).toBeNull()
  })
})

describe('the Ascent keeps the period on its frame', () => {
  const ascent = (over: Partial<typeof DEFAULT_APP_HISTORY>) =>
    mergeAppHistory(DEFAULT_APP_HISTORY, { surface: 'reflections', ascentAltitude: 1, ...over })

  it('puts how far back the reader stepped on the return ticket', () => {
    const october = ascent({ ascentOffset: 1 })
    expect(entryReturnFromState(october)).toMatchObject({
      surface: 'reflections',
      ascentAltitude: 1,
      ascentOffset: 1,
    })
  })

  it('opens an entry from October with October on its ticket, and the seat on the frame beneath', () => {
    // The stack the real app builds: the Ascent's frame, then the entry's on top.
    // Back is a pop, so what it lands on is whatever the frame underneath holds —
    // which is why the period and the seat have to be written onto it BEFORE the push.
    const october = ascent({ ascentOffset: 1, ascentSeat: { top: 640, entryId: 'e1', nth: 1 } })
    const entry = mergeAppHistory(october, {
      surface: 'journal',
      entryId: 'e1',
      entryReturn: entryReturnFromState(october),
    })
    expect(entry.entryReturn?.ascentOffset).toBe(1)
    expect(entry.entryReturn?.ascentAltitude).toBe(1)
    expect(october.ascentOffset).toBe(1)
    expect(october.ascentSeat).toEqual({ top: 640, entryId: 'e1', nth: 1 })
  })

  it('treats a step to another period as a different place, and the same step as none', () => {
    const october = ascent({ ascentOffset: 1 })
    expect(appHistoryEqual(october, ascent({ ascentOffset: 2 }))).toBe(false)
    expect(appHistoryEqual(october, ascent({ ascentOffset: 1 }))).toBe(true)
    expect(appHistoryEqual(october, ascent({ ascentOffset: 1, ascentSeat: { top: 1, entryId: null, nth: 0 } }))).toBe(false)
  })

  it('fills a frame saved before the period existed with "now"', () => {
    const { ascentOffset: _o, ascentSeat: _s, ...old } = ascent({})
    const healed = normalizeAppHistory(old as typeof DEFAULT_APP_HISTORY)
    expect(healed.ascentOffset).toBe(0)
    expect(healed.ascentSeat).toBeNull()
  })

  it('refuses a period or seat no reader could have produced', () => {
    const bad = (offset: unknown, seat: unknown) =>
      normalizeAppHistory({ ...DEFAULT_APP_HISTORY, ascentOffset: offset as number, ascentSeat: seat as never })
    expect(bad(-3, null).ascentOffset).toBe(0)
    expect(bad(Number.NaN, null).ascentOffset).toBe(0)
    expect(bad(2.9, null).ascentOffset).toBe(2)
    expect(bad(9e9, null).ascentOffset).toBe(1000)
    expect(bad(0, { top: -1, entryId: 'x' }).ascentSeat).toBeNull()
    expect(bad(0, { top: 'high' }).ascentSeat).toBeNull()
    expect(bad(0, { top: 12.6, entryId: 7 }).ascentSeat).toEqual({ top: 13, entryId: null, nth: 0 })
    expect(bad(0, { top: 5, entryId: 'e', nth: -2 }).ascentSeat?.nth).toBe(0)
    expect(bad(0, { top: 5, entryId: 'e', nth: 1 }).ascentSeat?.nth).toBe(1)
  })
})

describe('entryReturnLabel', () => {
  const NOW = new Date('2026-11-01T12:00:00.000Z')
  const ticket = (over: Partial<EntryReturnContext>): EntryReturnContext => ({
    surface: 'reflections',
    scriptureBook: null,
    scriptureVerse: null,
    ascentAltitude: 1,
    ascentDrill: null,
    pagesSubject: null,
    pagesSpreadId: null,
    ...over,
  })

  it('says only "Ascent" when the reader was looking at now', () => {
    expect(entryReturnLabel(ticket({}), NOW)).toBe('Ascent')
    expect(entryReturnLabel(ticket({ ascentOffset: 0 }), NOW)).toBe('Ascent')
  })

  it('names the period Back will land on, at every height', () => {
    expect(entryReturnLabel(ticket({ ascentOffset: 1 }), NOW)).toBe('Ascent · October 2026')
    expect(entryReturnLabel(ticket({ ascentAltitude: 0, ascentOffset: 2 }), NOW)).toBe('Ascent · Oct 12 – 18')
    expect(entryReturnLabel(ticket({ ascentAltitude: 2, ascentOffset: 1 }), NOW)).toBe('Ascent · Summer 2026')
    expect(entryReturnLabel(ticket({ ascentAltitude: 3, ascentOffset: 1 }), NOW)).toBe('Ascent · 2025')
  })

  it('leaves the other rooms their own names', () => {
    expect(entryReturnLabel(ticket({ surface: 'scripture' }), NOW)).toBe('Lamp')
    expect(entryReturnLabel(ticket({ surface: 'altar' }), NOW)).toBe('Altar')
    expect(entryReturnLabel(ticket({ surface: 'pages', ascentOffset: 3 }), NOW)).toBe('Pages')
  })
})
