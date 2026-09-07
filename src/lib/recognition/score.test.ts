// Guards the scorer.
//
// A scorer with a bug quietly reports whatever you were hoping for, and every
// number in Tier 1's floors and Tier 2's report inherits it. So the scorer is
// tested against stub inputs with known answers rather than trusted.
//
// The case that matters most is the tri-state one: an entry that omits an axis
// must contribute nothing to that axis — no true positive, no false positive,
// and crucially no denominator. Get that wrong and recall silently improves
// every time someone adds an unannotated entry.

import { describe, expect, it } from 'vitest'
import {
  passagesOverlap,
  scoreEntities,
  scoreOrdinaryProse,
  scorePassages,
  scoreScripture,
  summarize,
} from './score'
import { corpusFor } from './corpus'

describe('summarize', () => {
  it('computes precision, recall and F1 from the counts', () => {
    const s = summarize(6, 2, 2, [])
    expect(s.precision).toBeCloseTo(0.75)
    expect(s.recall).toBeCloseTo(0.75)
    expect(s.f1).toBeCloseTo(0.75)
  })

  it('treats an empty denominator as perfect rather than zero', () => {
    // Nothing expected and nothing produced is a pass, not a 0/0 failure —
    // otherwise every false-positive control entry would drag the score down
    // for being correct.
    const s = summarize(0, 0, 0, [])
    expect(s.precision).toBe(1)
    expect(s.recall).toBe(1)
  })

  it('separates missed entries from spurious ones', () => {
    const s = summarize(0, 1, 1, [
      { entryId: 'a', kind: 'fn', detail: 'x' },
      { entryId: 'b', kind: 'fp', detail: 'y' },
    ])
    expect(s.missedIn).toEqual(['a'])
    expect(s.spuriousIn).toEqual(['b'])
  })
})

describe('scoreScripture', () => {
  it('is perfect against a parser that returns exactly the expectation', () => {
    const oracle = (text: string) => {
      const e = corpusFor('refs').find((x) => x.body === text)
      return (e?.refs ?? [])
        .filter((r) => r.status !== 'suggested')
        .map((r) => ({ osis_ref: r.osis }))
    }
    const s = scoreScripture(oracle)
    expect(s.explicit.fp).toBe(0)
    expect(s.explicit.fn).toBe(0)
    expect(s.explicit.recall).toBe(1)
  })

  it('scores allusions on their own axis, never folded into the headline', () => {
    const s = scoreScripture(() => [])
    // A parser that finds nothing scores 0 recall on explicit refs…
    expect(s.explicit.tp).toBe(0)
    // …and the allusion tally is reported separately, not averaged in.
    expect(s.allusions.total).toBeGreaterThan(0)
    expect(s.allusions.detected).toBe(0)
  })

  it('counts a repeated reference twice', () => {
    // Deduping is scan.ts's job, not the parser's. Folding the boundary away
    // here would hide which side of it a bug is on.
    const twice = (text: string) => {
      const e = corpusFor('refs').find((x) => x.body === text)
      const dense = e?.id === 'scr-dense-01'
      if (!dense) return []
      return (e?.refs ?? []).map((r) => ({ osis_ref: r.osis }))
    }
    const s = scoreScripture(twice)
    // scr-dense-01 cites Isaiah 55:1-3 at the top and again at the end.
    expect(s.explicit.tp).toBe(5)
  })

  it('ignores entries that omit the refs axis entirely', () => {
    const omitted = corpusFor('refs').length
    const noisy = () => [{ osis_ref: 'Rev.13.18' }]
    const s = scoreScripture(noisy)
    // One spurious ref per ANNOTATED entry, and not one more — unannotated
    // entries contribute no denominator.
    expect(s.explicit.spuriousIn.length).toBe(omitted)
  })
})

describe('scoreOrdinaryProse', () => {
  it('reports every reference found in prose that must yield nothing', () => {
    const noisy = () => [{ osis_ref: 'Amos.3' }]
    const { spurious } = scoreOrdinaryProse(noisy)
    expect(spurious.length).toBeGreaterThan(0)
    expect(spurious.every((m) => m.kind === 'fp')).toBe(true)
  })

  it('is silent for a parser that finds nothing', () => {
    expect(scoreOrdinaryProse(() => []).spurious).toEqual([])
  })
})

describe('passagesOverlap', () => {
  it('accepts a tighter or looser span than the annotation', () => {
    expect(passagesOverlap('Lord, take the fear off me.', 'take the fear off me')).toBe(true)
    expect(passagesOverlap('take the fear off me', 'Lord, take the fear off me.')).toBe(true)
  })

  it('is whitespace- and case-tolerant', () => {
    expect(passagesOverlap('God,\n\nbe patient with me.', 'god, be patient with me.')).toBe(true)
  })

  it('rejects spans that share nothing', () => {
    expect(passagesOverlap('Lord, be near her tonight', 'the boiler is making the noise')).toBe(false)
    expect(passagesOverlap('anything', '')).toBe(false)
  })
})

describe('scorePassages', () => {
  it('scores type agreement separately from span agreement', () => {
    const annotated = corpusFor('passages').filter((e) => (e.passages ?? []).length > 0)
    const first = annotated[0]!
    const expectedPassage = first.passages![0]!
    // Right span, wrong type.
    const s = scorePassages([
      {
        entryId: first.id,
        type: expectedPassage.type === 'prayer' ? 'sense' : 'prayer',
        text: expectedPassage.text,
      },
    ])
    expect(s.span.tp).toBe(1) // the boundary was found…
    expect(s.typeAgreement.agreed).toBe(0) // …and is not masked by the type miss
    expect(s.typeAgreement.matched).toBe(1)
  })

  it('counts an extraction from a must-yield-nothing entry as a false positive', () => {
    const control = corpusFor('passages').find((e) => (e.passages ?? []).length === 0)!
    const s = scorePassages([{ entryId: control.id, type: 'prayer', text: 'anything at all' }])
    expect(s.span.fp).toBe(1)
    expect(s.span.spuriousIn).toEqual([control.id])
  })

  it('does not let one model span satisfy two expected spans', () => {
    const both = corpusFor('passages').find((e) => (e.passages ?? []).length === 2)!
    const s = scorePassages([
      { entryId: both.id, type: both.passages![0]!.type, text: both.passages![0]!.text },
    ])
    expect(s.span.tp).toBe(1)
    // The second expected span is a miss on THIS entry — s.span.fn counts the
    // whole corpus, so scope the assertion to the entry under test.
    const here = s.misses.filter((m) => m.entryId === both.id)
    expect(here).toHaveLength(1)
    expect(here[0]!.kind).toBe('fn')
  })
})

describe('scoreEntities', () => {
  it('accepts an alias as identifying the canonical entity', () => {
    // "Es" is Esther. A pipeline that reports the writer's own shorthand is
    // right, not wrong.
    const alias = corpusFor('entities').find((e) => e.id === 'ent-alias-02')!
    const s = scoreEntities([
      { entryId: alias.id, kind: 'person', canonical: 'Es', surfaceForm: 'Es' },
    ])
    expect(s.identity.tp).toBe(1)
    expect(s.identity.fp).toBe(0)
  })

  it('scores kind agreement separately from identity', () => {
    const alias = corpusFor('entities').find((e) => e.id === 'ent-alias-02')!
    const s = scoreEntities([
      { entryId: alias.id, kind: 'term', canonical: 'Esther', surfaceForm: 'Es' },
    ])
    expect(s.identity.tp).toBe(1)
    expect(s.kindAgreement.agreed).toBe(0)
  })

  it("counts a stripped descriptor as kept when the annotation expects ''", () => {
    // ent-descriptor-01 baits "anxious about the move"; the gate must drop it.
    const bait = corpusFor('entities').find((e) => e.id === 'ent-descriptor-01')!
    const stripped = scoreEntities([
      { entryId: bait.id, kind: 'person', canonical: 'Esther', surfaceForm: 'Es', descriptor: '' },
    ])
    expect(stripped.descriptors).toEqual({ kept: 1, proposed: 1 })

    const survived = scoreEntities([
      {
        entryId: bait.id,
        kind: 'person',
        canonical: 'Esther',
        surfaceForm: 'Es',
        descriptor: 'anxious about the move',
      },
    ])
    expect(survived.descriptors).toEqual({ kept: 0, proposed: 1 })
  })

  it('counts an entity in a generic-noun control as a false positive', () => {
    const control = corpusFor('entities').find((e) => e.id === 'ent-generic-01')!
    const s = scoreEntities([
      { entryId: control.id, kind: 'term', canonical: 'the winter', surfaceForm: 'winter' },
    ])
    expect(s.identity.fp).toBe(1)
  })
})

describe('scoping a run to a subset of the corpus', () => {
  // scripts/recognition-eval.ts --limit=N sends only part of the corpus to the
  // model. Entries it never sent must leave the DENOMINATOR too, not be counted
  // as misses — otherwise a cheap partial run reports as a catastrophe and the
  // cost-control lever becomes unusable.
  it('drops unsent entries from the denominator rather than scoring them as misses', () => {
    const annotated = corpusFor('refs')
    const subset = new Set(annotated.slice(0, 5).map((e) => e.id))

    const whole = scoreScripture(() => [])
    const scoped = scoreScripture(() => [], subset)

    expect(scoped.explicit.fn).toBeLessThan(whole.explicit.fn)
    expect(scoped.explicit.missedIn.every((id) => subset.has(id))).toBe(true)
  })

  it('scopes the prayer and entity scorers the same way', () => {
    const onePrayer = corpusFor('passages').find((e) => (e.passages ?? []).length > 0)!
    const scoped = scorePassages([], new Set([onePrayer.id]))
    expect(scoped.span.fn).toBe(onePrayer.passages!.length)

    const oneEntity = corpusFor('entities').find((e) => (e.entities ?? []).length > 0)!
    const e = scoreEntities([], new Set([oneEntity.id]))
    expect(e.identity.fn).toBe(oneEntity.entities!.length)
  })

  it('scores the whole corpus when no scope is given', () => {
    expect(scorePassages([]).span.fn).toBeGreaterThan(scorePassages([], new Set()).span.fn)
  })
})
