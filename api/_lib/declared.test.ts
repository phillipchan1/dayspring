// Grouping invariants for declared (prayer/sense) threads.
//
// The bug these guard against: the previous builder clustered prayer TEXT by
// embedding similarity, so a heap's centroid drifted into generic devotional space
// and swallowed unrelated praying, while its label kept describing the first few
// members. Every test here is about the properties that failure violated —
// subject fidelity, the recurrence gate, determinism, and honest counts.
//
// `embed` is stubbed with a deterministic bag-of-words vector so the tests never
// hit the network: identical labels are identical vectors, different words are
// near-orthogonal. That's enough to exercise the merge/gate/dedupe logic, which is
// where the failures live.

import { describe, expect, it, vi } from 'vitest'

vi.mock('./embeddings.js', async () => {
  const actual = await vi.importActual<typeof import('./embeddings.js')>('./embeddings.js')
  return {
    ...actual,
    // One dimension per distinct token, so "trading" and "esther" are orthogonal
    // and "trading"/"trading discipline" overlap.
    embed: async (texts: string[]) => {
      const vocab = new Map<string, number>()
      for (const t of texts) {
        for (const w of t.toLowerCase().split(/\W+/).filter(Boolean)) {
          if (!vocab.has(w)) vocab.set(w, vocab.size)
        }
      }
      return texts.map((t) => {
        const v = new Array(Math.max(1, vocab.size)).fill(0)
        for (const w of t.toLowerCase().split(/\W+/).filter(Boolean)) v[vocab.get(w)!] = 1
        return v
      })
    },
  }
})

const { groupTagged, MIN_TOUCHES, MIN_WEEKS } = await import('./declared.js')

type Tag = { label: string; kind: 'person' | 'place' | 'theme' }

/** A tagged line on a given day (day 0 = 2026-01-05, a Monday). */
function line(id: string, dayOffset: number, tags: Tag[], content = `prayer ${id}`) {
  const d = new Date(Date.UTC(2026, 0, 5) + dayOffset * 86_400_000)
  return { id, type: 'prayer' as const, date: d.toISOString(), tags, content }
}

const trading: Tag = { label: 'trading', kind: 'theme' }
const esther: Tag = { label: 'esther', kind: 'person' }

describe('groupTagged', () => {
  it('keeps distinct subjects apart', async () => {
    const plan = await groupTagged([
      line('a1', 0, [trading]), line('a2', 7, [trading]), line('a3', 14, [trading]),
      line('b1', 0, [esther]), line('b2', 7, [esther]), line('b3', 14, [esther]),
    ])
    expect(plan.subjects).toHaveLength(2)
    const labels = plan.subjects.map((s) => s.label).sort()
    expect(labels).toEqual(['esther', 'trading'])
    // No cross-contamination: each thread holds only its own lines.
    for (const s of plan.subjects) {
      const prefix = s.label === 'trading' ? 'a' : 'b'
      expect(s.itemIds.every((id) => id.startsWith(prefix))).toBe(true)
    }
  })

  it('keeps a person named Grace while dropping grace-the-virtue', async () => {
    // Half the virtue vocabulary is also given as a NAME (Grace, Joy, Hope, Faith).
    // The virtue is the ASK and must not become a cairn; the person must not be
    // erased from her own family's Altar.
    const plan = await groupTagged([
      line('p1', 0, [{ label: 'Grace', kind: 'person' }]),
      line('p2', 7, [{ label: 'Grace', kind: 'person' }]),
      line('p3', 14, [{ label: 'Grace', kind: 'person' }]),
      line('t1', 0, [{ label: 'grace', kind: 'theme' }]),
      line('t2', 7, [{ label: 'grace', kind: 'theme' }]),
      line('t3', 14, [{ label: 'grace', kind: 'theme' }]),
    ])
    expect(plan.subjects).toHaveLength(1)
    expect(plan.subjects[0]!.subjectKind).toBe('person')
    expect(plan.subjects[0]!.itemIds).toEqual(['p1', 'p2', 'p3'])
  })

  it('never merges a person into a theme of the same name', async () => {
    const plan = await groupTagged([
      line('p1', 0, [{ label: 'Faith', kind: 'person' }]),
      line('p2', 7, [{ label: 'Faith', kind: 'person' }]),
      line('p3', 14, [{ label: 'Faith', kind: 'person' }]),
      line('t1', 0, [{ label: 'parenting', kind: 'theme' }]),
      line('t2', 7, [{ label: 'parenting', kind: 'theme' }]),
      line('t3', 14, [{ label: 'parenting', kind: 'theme' }]),
    ])
    expect(plan.subjects).toHaveLength(2)
    expect(plan.subjects.map((s) => s.subjectKind).sort()).toEqual(['person', 'theme'])
    for (const s of plan.subjects) {
      const prefix = s.subjectKind === 'person' ? 'p' : 't'
      expect(s.itemIds.every((id) => id.startsWith(prefix))).toBe(true)
    }
  })

  it('unites one word the model called a theme once and a place another time', async () => {
    // The model is inconsistent about theme-vs-place for the same word; that
    // taxonomy wobble must not split a subject into two threads.
    const plan = await groupTagged([
      line('w1', 0, [{ label: 'trading', kind: 'theme' }]),
      line('w2', 7, [{ label: 'trading', kind: 'place' }]),
      line('w3', 14, [{ label: 'trading', kind: 'theme' }]),
    ])
    expect(plan.subjects).toHaveLength(1)
    expect(plan.subjects[0]!.subjectKind).toBe('theme') // the majority vote
    expect(plan.subjects[0]!.itemIds).toEqual(['w1', 'w2', 'w3'])
  })

  it('drops the One being prayed to, even tagged as a person', async () => {
    const plan = await groupTagged([
      line('j1', 0, [{ label: 'Jesus', kind: 'person' }]),
      line('j2', 7, [{ label: 'Jesus', kind: 'person' }]),
      line('j3', 14, [{ label: 'the Lord', kind: 'person' }]),
    ])
    expect(plan.subjects).toHaveLength(0)
  })

  it('drops a subject prayed about in too few weeks (a burst is not a return)', async () => {
    // MIN_TOUCHES met, MIN_WEEKS not: five prayers inside one week.
    const burst = [0, 1, 2, 3, 4].map((d, i) => line(`x${i}`, d, [trading]))
    const plan = await groupTagged(burst)
    expect(burst.length).toBeGreaterThanOrEqual(MIN_TOUCHES)
    expect(plan.subjects).toHaveLength(0)
    expect(plan.belowGate).toBe(1)
  })

  it('drops a subject touched fewer than MIN_TOUCHES times', async () => {
    const plan = await groupTagged([line('y1', 0, [trading]), line('y2', 7, [trading])])
    expect(MIN_TOUCHES).toBeGreaterThan(2)
    expect(plan.subjects).toHaveLength(0)
  })

  it('admits a subject returned to across weeks', async () => {
    const plan = await groupTagged([
      line('z1', 0, [trading]), line('z2', 7, [trading]), line('z3', 21, [trading]),
    ])
    expect(plan.subjects).toHaveLength(1)
    expect(plan.subjects[0]!.weeks).toBeGreaterThanOrEqual(MIN_WEEKS)
    expect(plan.subjects[0]!.itemIds).toEqual(['z1', 'z2', 'z3'])
  })

  it('collapses the same prayer stored twice on one day, but not the same words months apart', async () => {
    const dup = 'lord help me with the same words'
    const plan = await groupTagged([
      line('d1', 0, [trading], dup),
      line('d2', 0, [trading], dup),   // duplicate ENTRY — one praying, not two
      line('d3', 7, [trading], dup),
      line('d4', 40, [trading], dup),  // months later — a genuine return
    ])
    expect(plan.subjects).toHaveLength(1)
    expect(plan.subjects[0]!.itemIds).toEqual(['d1', 'd3', 'd4'])
  })

  it('is deterministic: equal-frequency labels do not reshuffle between runs', async () => {
    // Two labels with identical counts — without a tiebreak, canonical naming (and
    // therefore thread identity, and therefore the encounter attached to it) would
    // depend on map iteration order.
    const items = [
      line('m1', 0, [{ label: 'alpha', kind: 'theme' }]),
      line('m2', 7, [{ label: 'alpha', kind: 'theme' }]),
      line('m3', 14, [{ label: 'alpha', kind: 'theme' }]),
      line('n1', 0, [{ label: 'zulu', kind: 'theme' }]),
      line('n2', 7, [{ label: 'zulu', kind: 'theme' }]),
      line('n3', 14, [{ label: 'zulu', kind: 'theme' }]),
    ]
    const a = await groupTagged(items)
    const b = await groupTagged([...items].reverse())
    expect(a.subjects.map((s) => `${s.label}:${s.itemIds.join(',')}`))
      .toEqual(b.subjects.map((s) => `${s.label}:${s.itemIds.join(',')}`))
  })

  it('splits prayer and sense about the same subject into separate threads', async () => {
    const senses = [0, 7, 14].map((d, i) => ({ ...line(`s${i}`, d, [trading]), type: 'sense' as const }))
    const prayers = [0, 7, 14].map((d, i) => line(`p${i}`, d, [trading]))
    const plan = await groupTagged([...senses, ...prayers])
    expect(plan.subjects).toHaveLength(2)
    expect(plan.subjects.map((s) => s.type).sort()).toEqual(['prayer', 'sense'])
  })

  it('ignores lines the model kept nothing for, and stop-label-only tags', async () => {
    const plan = await groupTagged([
      line('k1', 0, []),                                        // keep=false
      line('k2', 7, [{ label: 'wisdom', kind: 'theme' }]),       // the ASK, not a subject
      line('k3', 14, [{ label: 'Jesus', kind: 'person' }]),      // the One addressed
    ])
    expect(plan.keptItems).toBe(0)
    expect(plan.subjects).toHaveLength(0)
  })

  it('counts a subject once even when tagged with two labels that canonicalize together', async () => {
    // Multi-subject membership is intended, but a line must not inflate one
    // thread's heft by arriving through two of its own aliases.
    const both: Tag[] = [{ label: 'trading', kind: 'theme' }, { label: 'trading', kind: 'theme' }]
    const plan = await groupTagged([
      line('c1', 0, both), line('c2', 7, both), line('c3', 14, both),
    ])
    expect(plan.subjects).toHaveLength(1)
    expect(plan.subjects[0]!.itemIds).toEqual(['c1', 'c2', 'c3'])
  })

  it('seeds each thread with its earliest line and spans first to last', async () => {
    const plan = await groupTagged([
      line('late', 21, [trading]), line('first', 0, [trading]), line('mid', 7, [trading]),
    ])
    const s = plan.subjects[0]!
    expect(s.seedItemId).toBe('first')
    expect(s.spanStart < s.spanEnd).toBe(true)
    expect(s.itemIds).toEqual(['first', 'mid', 'late'])
  })
})

// ── stop-lists ───────────────────────────────────────────────────────────────
// groupTagged's behavior above depends on isSubjectLabel, which is where the
// three stop-lists actually bite. Testing it directly means a change to the
// lists fails here, at the rule, rather than three tests away at a symptom.

const { isSubjectLabel } = await import('./declared.js')

describe('isSubjectLabel', () => {
  it('never lets the One being prayed TO become a subject prayed FOR', () => {
    for (const label of ['God', 'Jesus', 'the Lord', 'Holy Spirit', 'Abba', 'the Father']) {
      for (const kind of ['person', 'place', 'theme'] as const) {
        expect(isSubjectLabel(label, kind), `${label} as ${kind}`).toBe(false)
      }
    }
  })

  it('rejects labels so vague they would swallow every other thread', () => {
    for (const label of ['me', 'this situation', 'everything', 'today', 'them']) {
      for (const kind of ['person', 'place', 'theme'] as const) {
        expect(isSubjectLabel(label, kind), `${label} as ${kind}`).toBe(false)
      }
    }
  })

  it('rejects what is being ASKED FOR as a theme or a place', () => {
    for (const label of ['wisdom', 'peace', 'breakthrough', 'protection']) {
      expect(isSubjectLabel(label, 'theme'), label).toBe(false)
      expect(isSubjectLabel(label, 'place'), label).toBe(false)
    }
  })

  it('allows those same words as a PERSON, because they are also given names', () => {
    // This asymmetry is the whole reason ASK_LABELS is split out from the other
    // two lists: praying for grace is not a subject, praying for Grace is.
    for (const label of ['Grace', 'Faith', 'Joy', 'Hope', 'Mercy', 'Patience']) {
      expect(isSubjectLabel(label, 'person'), label).toBe(true)
      expect(isSubjectLabel(label, 'theme'), label).toBe(false)
    }
  })

  it('admits an ordinary recurring subject', () => {
    expect(isSubjectLabel('Naomi', 'person')).toBe(true)
    expect(isSubjectLabel('Frontier', 'place')).toBe(true)
    expect(isSubjectLabel('anxiety', 'theme')).toBe(true)
  })

  it('normalizes case and surrounding whitespace before deciding', () => {
    expect(isSubjectLabel('  THE LORD  ', 'person')).toBe(false)
    expect(isSubjectLabel('  Wisdom  ', 'theme')).toBe(false)
    expect(isSubjectLabel('', 'theme')).toBe(false)
    expect(isSubjectLabel('   ', 'theme')).toBe(false)
  })
})

// ── the same rules, riding on real prose ─────────────────────────────────────
// Everything above uses synthetic tags, which is right for isolating the
// grouping logic. This one runs the hand-labeled subjects from the shared
// recognition corpus (src/lib/recognition/) through the same gates, so the
// designed threads and the designed near-misses are asserted against prose a
// person would actually write — the shape an import really arrives in.

const { CORPUS, DESIGNED_THREADS } = await import('../../src/lib/recognition/corpus/index.js')

describe('groupTagged over the recognition corpus', () => {
  const items = CORPUS.filter((e) => (e.subjects ?? []).length > 0).map((e) => ({
    id: e.id,
    type: 'prayer' as const,
    date: e.created_at,
    tags: (e.subjects ?? []).map((s) => ({ label: s.label, kind: s.kind })),
    content: e.body,
  }))

  it('forms a thread for every subject genuinely returned to', async () => {
    const plan = await groupTagged(items)
    const labels = plan.subjects.map((s) => s.label.toLowerCase())
    for (const designed of DESIGNED_THREADS.forms) {
      expect(labels, `${designed} should have formed a thread`).toContain(designed.toLowerCase())
    }
  })

  it('forms no thread for a subject that only looks recurring', async () => {
    // A pipeline that forms every thread it sees is as broken as one that forms
    // none: the Altar is meant to show what someone keeps coming back to, not
    // everything they once mentioned twice.
    const plan = await groupTagged(items)
    const labels = plan.subjects.map((s) => s.label.toLowerCase())
    for (const { label, fails } of DESIGNED_THREADS.nearMisses) {
      expect(labels, `${label} should have been held back — ${fails}`).not.toContain(
        label.toLowerCase(),
      )
    }
  })

  it('holds back the stop-listed subjects even with real prayers behind them', async () => {
    const plan = await groupTagged(items)
    const labels = plan.subjects.map((s) => s.label.toLowerCase())
    // Prayed for a girl named Grace once; asked for grace-the-virtue once.
    // Neither recurs enough to be a thread, and the virtue could not be one
    // at any count.
    expect(labels).not.toContain('wisdom')
    expect(labels).not.toContain('jesus')
    expect(labels).not.toContain('this situation')
  })
})
