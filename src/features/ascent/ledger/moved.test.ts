import { describe, expect, it } from 'vitest'
import type { LedgerThread, RangeLedger } from './build'
import { whatMoved } from './moved'

function thread(id: string, dates: string[]): LedgerThread {
  return {
    id,
    label: id,
    kind: 'matter',
    perMonth: [],
    lines: dates.map((date) => ({ entryId: `${id}${date}`, date, month: 0, text: `${id} on ${date}`, kind: 'story', flag: null, refs: [], with: [] })),
    events: [],
    markedMonths: [],
    returned: false,
    score: 1,
    facts: { months: 1, mentions: dates.length, returns: 0, movement: 0, marked: 0, prior: 0 },
  }
}
function ledger(threads: LedgerThread[]): RangeLedger {
  return { from: '', to: '', months: [], threads, stones: [] }
}

describe('whatMoved', () => {
  const summer = ledger([thread('dad', ['2026-06-11']), thread('firm', ['2026-08-19']), thread('ps131', ['2026-06-17'])])
  const fall = ledger([thread('dad', ['2026-09-16']), thread('tom', ['2026-09-14']), thread('group', ['2026-09-07', '2026-09-17'])])
  const moved = whatMoved(fall, summer, new Set(['tom', 'ps131']))
  const ids = (xs: { thread: LedgerThread }[]) => xs.map((x) => x.thread.id)

  it('sorts a season into began, came back, carried through, and quiet', () => {
    expect(ids(moved.began)).toEqual(['group'])
    expect(ids(moved.cameBack)).toEqual(['tom'])
    expect(ids(moved.carried)).toEqual(['dad'])
    expect(ids(moved.quiet)).toEqual(['firm', 'ps131'])
  })

  it('shows the first line of something new and the last line of something that went quiet', () => {
    expect(moved.began[0]!.line!.date).toBe('2026-09-07')
    expect(moved.quiet[0]!.line!.date).toBe('2026-08-19')
  })
})
