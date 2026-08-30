// Subject × marking — the axis the corpus did not have.
//
// Every other file here annotates ONE thing: a scripture ref, a prayer span, an
// entity. That was right while each builder was being measured on its own, and
// it left a hole exactly where the interesting question is. Checked before
// these entries were written: of 130 entries, 36 carried a named subject and 52
// carried a scripture reference, and **none carried both**. The corpus could
// not test "what scripture did I reach for when I was writing about her",
// because nothing in it ever wrote about her and cited anything.
//
// These entries pair the two on purpose, at known distances, so the join can be
// scored rather than admired. Three of them encode defects found in a real
// 3,048-entry archive rather than imagined at a desk.
//
// Everything here is synthetic. Naomi, Bristol and Frontier are the corpus's
// existing cast, reused so the Concordance sees them recur.

import type { CorpusEntry } from './types'

export const JOIN_ENTRIES: CorpusEntry[] = [
  // ── the plain case the whole feature exists for ───────────────────────────
  {
    id: 'join-near-01',
    category: 'join-subject-scripture',
    week: 30,
    day: 1,
    body: `Long call with Naomi about her mother.
God, hold her mother tonight, and hold Naomi while she carries this.

Psalm 34:18 kept coming back to me while we talked — the Lord is near to the
brokenhearted. I read it to her at the end.

Separately: the car needs new tyres before winter.`,
    refs: [{ osis: 'Ps.34.18' }],
    passages: [
      {
        type: 'prayer',
        text: 'God, hold her mother tonight, and hold Naomi while she carries this.',
      },
    ],
    entities: [{ kind: 'person', canonical: 'Naomi', surfaceForms: ['Naomi'] }],
    subjects: [{ label: 'Naomi', kind: 'person' }],
    note: 'The verse sits two lines from her name. This is the join working.',
  },

  // ── same page, nowhere near each other ────────────────────────────────────
  {
    id: 'join-far-01',
    category: 'join-subject-scripture',
    week: 30,
    day: 3,
    body: `Naomi came by early and we sorted the garage out. Good morning, easy work.

Then errands, then lunch, then a long stretch of nothing much at all. Some
admin I had been putting off for a fortnight. Paid the water bill.

Much later, after everyone had gone to bed, I sat with Romans 8:28 for a while.
Not about anything in particular. Just sat with it.`,
    refs: [{ osis: 'Rom.8.28' }],
    entities: [{ kind: 'person', canonical: 'Naomi', surfaceForms: ['Naomi'] }],
    subjects: [{ label: 'Naomi', kind: 'person' }],
    note: 'Both on the page, six lines apart. Page-level co-occurrence says yes; the join must say no.',
  },

  // ── a person whose name is a book of the Bible ────────────────────────────
  // Found in the real archive: every single book-of-Esther reference in 3,048
  // entries was this, not a citation.
  {
    id: 'join-booknamed-person-01',
    category: 'join-subject-scripture',
    week: 31,
    day: 1,
    body: `Took the boys out so Esther 2 could have the house quiet for once — she has
been up since five most days this month.

Read Esther 4:14 on the train. For such a time as this.`,
    refs: [{ osis: 'Esth.4.14' }],
    entities: [{ kind: 'person', canonical: 'Esther', surfaceForms: ['Esther'] }],
    subjects: [{ label: 'Esther', kind: 'person' }],
    currentRefs: ['Esth.2', 'Esth.4.14'],
    defect: 'book-name-is-a-person',
    note: 'The first "Esther 2" is her name and a numbered list. Only the second is scripture.',
  },

  // ── the weather footer ────────────────────────────────────────────────────
  // An imported journal ended every entry with one, and a paragraph closing on
  // a name fused with it: "Esther\n\n\n57.2°F" became Esth.10.2 at status
  // confirmed. The parser's \s* spans blank lines, which is what made it reach.
  {
    id: 'join-measurement-01',
    category: 'join-subject-scripture',
    week: 31,
    day: 3,
    body: `A hard evening. I did not have much left for anyone by the time I got in, and
I want to do better than that by Esther


57.2°F ☁️,  [Service Rd]`,
    refs: [],
    entities: [{ kind: 'person', canonical: 'Esther', surfaceForms: ['Esther'] }],
    subjects: [{ label: 'Esther', kind: 'person' }],
    note: 'A temperature is not a chapter. This must yield no reference at all.',
  },

  // ── a matter, which no name-finder can reach ──────────────────────────────
  {
    id: 'join-matter-01',
    category: 'join-subject-scripture',
    week: 32,
    day: 2,
    body: `Dry again. I have been going through the motions for weeks and I know it.
Lord, I would rather be thirsty than comfortable. Make me thirsty again.

Isaiah 55:1 — everyone who thirsts, come to the waters. I do not feel thirsty,
which is its own kind of answer.`,
    refs: [{ osis: 'Isa.55.1' }],
    passages: [
      {
        type: 'prayer',
        text: 'Lord, I would rather be thirsty than comfortable. Make me thirsty again.',
      },
    ],
    subjects: [{ label: 'spiritual dryness', kind: 'theme' }],
    note: 'Nobody writes the words "spiritual dryness". A matter joins through its lines, never its name.',
  },
]
