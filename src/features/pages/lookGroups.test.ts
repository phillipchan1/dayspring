import { describe, expect, it } from 'vitest'
import { aboveFloor, aliveIn, groupSubjects, sectionOf } from './lookGroups'
import type { Subject } from './subjects'

const s = (over: Partial<Subject> & { key: string }): Subject => ({
  label: over.key,
  terms: [over.key],
  kind: 'term',
  ...over,
})

describe('sectionOf', () => {
  it('puts a Concordance kind where the Life Map puts it', () => {
    expect(sectionOf(s({ key: 'c:vera', kind: 'person' }))).toBe('person')
    expect(sectionOf(s({ key: 'c:riverside', kind: 'place' }))).toBe('place')
    expect(sectionOf(s({ key: 'c:hope', kind: 'term' }))).toBe('matter')
  })

  // The one union the Life Map makes: a fidelity record cares whether Frontier
  // is a church or a codebase; a person reading their own life does not.
  it('unions org and project into Domains, exactly as sectionFor does', () => {
    expect(sectionOf(s({ key: 'c:frontier', kind: 'org' }))).toBe('domain')
    expect(sectionOf(s({ key: 'c:dayspring', kind: 'project' }))).toBe('domain')
  })

  // The writer typed this word; there is no kind to read, and Matters is where
  // the Life Map files a typed subject too.
  it('files a typed word under Matters', () => {
    expect(sectionOf(s({ key: 'word:marriage', kind: 'word' }))).toBe('matter')
  })

  /*
   * THE GUARD. `kept_subjects.kind` is the box the writer typed a name into on
   * the Life Map, and the extractor's guess about the same word must not
   * override it — on the real archive 52 names live under two or more kinds, so
   * without this a name filed under People reappears here under Matters and the
   * two surfaces contradict each other about the same row.
   */
  it("lets the writer's own filing beat the extractor's kind", () => {
    const kept = { ...s({ key: 'word:frontier', kind: 'term' }), section: 'domain' }
    expect(sectionOf(kept)).toBe('domain')
  })

  // A row kept before the column existed has a null kind. It must still land
  // somewhere: a subject may never vanish because a column arrived late.
  it('falls to Matters on an unfiled row rather than dropping it', () => {
    expect(sectionOf({ ...s({ key: 'word:rest', kind: 'word' }), section: null })).toBe('matter')
  })
})

describe('aboveFloor', () => {
  it('offers what recurs and holds back what does not', () => {
    const out = aboveFloor(
      [s({ key: 'a', occurrences: 30 }), s({ key: 'b', occurrences: 2 })],
      12,
    )
    expect(out.map((x) => x.key)).toEqual(['a'])
  })

  // An unknown count is not evidence of absence. Dropping a name because a
  // field was missing is the exact failure this surface exists to avoid.
  it('lets a subject with no stored count through', () => {
    expect(aboveFloor([s({ key: 'typed' })], 30).map((x) => x.key)).toEqual(['typed'])
  })

  // A FLOOR IS FILTERING; A CAP WOULD BE RANKING. Everything at or above the
  // line comes through, however many that is — the list is never trimmed to a
  // number, because a number would have to be chosen by significance.
  it('never shortens to a count', () => {
    const many = Array.from({ length: 40 }, (_, i) => s({ key: `k${i}`, occurrences: 50 }))
    expect(aboveFloor(many, 30)).toHaveLength(40)
  })
})

describe('aliveIn', () => {
  const WINTER = { start: '2019-11-01T00:00:00.000Z', end: '2020-03-01T00:00:00.000Z' }
  const lived = (key: string, firstSeen: string, lastSeen: string) =>
    s({ key, firstSeen, lastSeen })

  it('keeps a subject whose stretch overlaps the bracket', () => {
    const out = aliveIn(
      [
        lived('during', '2019-12-01T00:00:00Z', '2020-01-04T00:00:00Z'),
        lived('spanning', '2015-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
        lived('ends-inside', '2011-01-01T00:00:00Z', '2019-11-20T00:00:00Z'),
        lived('starts-inside', '2020-02-20T00:00:00Z', '2026-01-01T00:00:00Z'),
      ],
      WINTER,
    )
    expect(out.map((x) => x.key)).toEqual(['during', 'spanning', 'ends-inside', 'starts-inside'])
  })

  it('drops a subject that had finished, or had not started', () => {
    const out = aliveIn(
      [
        lived('over', '2012-01-01T00:00:00Z', '2019-10-31T00:00:00Z'),
        lived('later', '2020-03-01T00:00:00Z', '2021-01-01T00:00:00Z'),
      ],
      WINTER,
    )
    expect(out).toEqual([])
  })

  /*
   * HALF-OPEN, so nothing falls through on the 31st. `end` is the first instant
   * of the month after the bracket (see `spanBounds`), and a subject last seen
   * inside the final month must still be alive.
   */
  it('holds the boundaries half-open', () => {
    const out = aliveIn(
      [
        lived('last-instant', '2011-01-01T00:00:00Z', '2020-02-29T23:59:59Z'),
        lived('first-instant', '2019-11-01T00:00:00Z', '2026-01-01T00:00:00Z'),
      ],
      WINTER,
    )
    expect(out).toHaveLength(2)
  })

  // An unknown date is not evidence of absence — the same honest default
  // `aboveFloor` takes, and the literal re-count downstream is what actually
  // removes a name.
  it('lets a subject with no dates through', () => {
    expect(aliveIn([s({ key: 'undated' })], WINTER).map((x) => x.key)).toEqual(['undated'])
  })

  /*
   * DELIBERATELY COARSE. A subject alive across the whole archive passes for
   * every bracket, silent months included — being generous in the cheap stage
   * and strict in the counted one is the right way round, because the cheap
   * stage must never be the thing that removes a name.
   */
  it('passes a subject that spans the bracket without appearing in it', () => {
    const out = aliveIn([lived('bracketing', '2011-01-01T00:00:00Z', '2026-01-01T00:00:00Z')], WINTER)
    expect(out).toHaveLength(1)
  })
})

describe('groupSubjects', () => {
  it('returns the four in the Life Map order, empties dropped', () => {
    const groups = groupSubjects(
      [s({ key: 'word:rest', kind: 'word' })],
      [s({ key: 'c:vera', kind: 'person' }), s({ key: 'c:frontier', kind: 'org' })],
    )
    expect(groups.map((g) => g.id)).toEqual(['person', 'domain', 'matter'])
    expect(groups.map((g) => g.label)).toEqual(['People', 'Domains', 'Matters'])
  })

  it('keeps what the writer answered apart from what the journal offered', () => {
    const [people] = groupSubjects(
      [s({ key: 'c:vera', kind: 'person' })],
      [s({ key: 'c:judy', kind: 'person' })],
    )
    expect(people!.mine.map((x) => x.key)).toEqual(['c:vera'])
    expect(people!.found.map((x) => x.key)).toEqual(['c:judy'])
  })

  /*
   * NEVER BY PAGE COUNT. Grouping is the only thing this does; the order inside
   * each list is the order it arrived in — kept order for the writer's own,
   * first-appearance for what was offered. A ranking of the people in someone's
   * life is a verdict rendered in a sort (D-016).
   */
  it('carries each list through in the order it arrived', () => {
    const [people] = groupSubjects(
      [],
      [
        s({ key: 'c:small', kind: 'person', occurrences: 4 }),
        s({ key: 'c:huge', kind: 'person', occurrences: 900 }),
        s({ key: 'c:middling', kind: 'person', occurrences: 60 }),
      ],
    )
    expect(people!.found.map((x) => x.key)).toEqual(['c:small', 'c:huge', 'c:middling'])
  })
})
