// Guards the corpus itself.
//
// Hand-authored corpora don't rot through code changes, they rot through
// annotation typos — an expected prayer span that drifts a character out of
// sync with the body it's supposed to quote, a surface form that was edited in
// the prose but not in the label. Both failures are silent and both make every
// downstream score a confident lie: altar.ts and concordance.ts drop anything
// that isn't a verbatim substring, so a mistyped annotation scores the model as
// wrong for being right.
//
// This file is the cheapest high-value test in the battery. It should stay that
// way — assertions here are about the corpus's internal consistency, never
// about what the pipeline does with it.

import { describe, expect, it } from 'vitest'
import { CORPUS, DEFECTS, DESIGNED_THREADS, EPOCH_MS, asEntryRows, corpusFor } from './corpus'
import type { DefectId } from './corpus/types'

const nz = (s: string) => s.replace(/\s+/g, ' ').trim()
/** Mirrors the whitespace-tolerant substring gate in altar.ts / concordance.ts. */
const isVerbatim = (body: string, text: string) =>
  body.includes(text) || nz(body).includes(nz(text))

describe('CORPUS', () => {
  it('has unique, stable entry ids', () => {
    const ids = CORPUS.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('quotes every expected prayer span verbatim from its own body', () => {
    const broken = CORPUS.flatMap((e) =>
      (e.passages ?? [])
        .filter((p) => !isVerbatim(e.body, p.text))
        .map((p) => `${e.id}: ${JSON.stringify(p.text.slice(0, 60))}`),
    )
    // If this fails, altar.ts's isVerbatim gate would drop the model's correct
    // extraction and the prayer score would be measuring the annotation, not
    // the pipeline.
    expect(broken).toEqual([])
  })

  it('quotes every expected surface form verbatim from its own body', () => {
    const broken = CORPUS.flatMap((e) =>
      (e.entities ?? []).flatMap((ent) =>
        ent.surfaceForms
          .filter((s) => !isVerbatim(e.body, s))
          .map((s) => `${e.id}: ${JSON.stringify(s)} not in body`),
      ),
    )
    expect(broken).toEqual([])
  })

  it('pairs every frozen currentRefs with the defect it demonstrates', () => {
    const unlabelled = CORPUS.filter((e) => e.currentRefs !== undefined && !e.defect).map((e) => e.id)
    expect(unlabelled).toEqual([])
  })

  it('demonstrates every declared defect on at least one entry', () => {
    const empty = (Object.entries(DEFECTS) as [DefectId, { entryIds: string[] }][])
      .filter(([, v]) => v.entryIds.length === 0)
      .map(([k]) => k)
    // A DefectId with no entry is a defect we stopped measuring without noticing.
    expect(empty).toEqual([])
  })

  it('resolves yieldsNothing into an explicit empty expectation on all four axes', () => {
    for (const e of CORPUS.filter((x) => x.yieldsNothing)) {
      expect([e.id, e.refs, e.passages, e.entities, e.subjects]).toEqual([e.id, [], [], [], []])
    }
  })

  it('keeps the omitted-vs-empty distinction intact', () => {
    // Omitted means "not annotated on this axis"; [] means "must yield nothing".
    // Collapsing the two would invent both a denominator and a false positive.
    const annotatedForRefs = corpusFor('refs').length
    expect(annotatedForRefs).toBeGreaterThan(0)
    expect(annotatedForRefs).toBeLessThan(CORPUS.length)
  })

  it('spans enough weeks for declared.ts recurrence gates to be exercised', () => {
    const weeks = new Set(CORPUS.map((e) => e.isoWeek))
    // MIN_WEEKS is 3; a corpus that can't hold a near-miss can't test the gate.
    expect(weeks.size).toBeGreaterThanOrEqual(12)
  })

  it('starts on the Monday declared.test.ts anchors to', () => {
    expect(new Date(EPOCH_MS).toISOString()).toBe('2026-01-05T00:00:00.000Z')
    expect(new Date(EPOCH_MS).getUTCDay()).toBe(1)
  })

  it('gives the designed recurring subjects three touches across three ISO weeks', () => {
    for (const label of DESIGNED_THREADS.forms) {
      const touches = CORPUS.filter((e) => (e.subjects ?? []).some((s) => s.label === label))
      const weeks = new Set(touches.map((e) => e.isoWeek))
      expect(touches.length, `${label} touches`).toBeGreaterThanOrEqual(3)
      expect(weeks.size, `${label} distinct ISO weeks`).toBeGreaterThanOrEqual(3)
    }
  })

  it('keeps each near-miss subject below exactly one gate', () => {
    const byLabel = (label: string) =>
      CORPUS.filter((e) => (e.subjects ?? []).some((s) => s.label === label))

    const burst = byLabel('the move')
    expect(burst.length).toBeGreaterThanOrEqual(3) // clears MIN_TOUCHES…
    expect(new Set(burst.map((e) => e.isoWeek)).size).toBeLessThan(3) // …fails MIN_WEEKS

    const sparse = byLabel('Bristol')
    expect(sparse.length).toBeLessThan(3) // fails MIN_TOUCHES…
    expect(new Set(sparse.map((e) => e.isoWeek)).size).toBeGreaterThanOrEqual(2) // …on weeks alone it would pass
  })

  it('emits rows in the shape the builders select from Supabase', () => {
    const rows = asEntryRows()
    expect(rows).toHaveLength(CORPUS.length)
    expect(Object.keys(rows[0]!).sort()).toEqual(['body_markdown', 'created_at', 'id'])
    // Oldest first — the order an import lands in.
    const dates = rows.map((r) => r.created_at)
    expect([...dates].sort()).toEqual(dates)
  })

  it('is large enough to say something', () => {
    expect(CORPUS.length).toBeGreaterThanOrEqual(80)
  })
})
