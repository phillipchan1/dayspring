// Declared-subject stop-list corpus.
//
// declared.ts groups recurring prayer subjects into threads. Three stop-lists
// keep the threads meaningful, and one of them is split by kind because half
// its words are also given names:
//
//   DIVINE_LABELS — the One being prayed TO is never a subject prayed FOR
//   VAGUE_LABELS  — "me", "this situation", "everything" cluster everything
//   ASK_LABELS    — "wisdom", "grace", "peace" as themes, but Grace as a person
//
// declared.test.ts already covers this at the unit level with synthetic tags.
// These entries make the same rules ride on prose a person would actually
// write, so the model's tagging is measured against them in Tier 2.

import type { CorpusEntry } from './types'

export const SUBJECT_ENTRIES: CorpusEntry[] = [
  {
    id: 'sub-stoplist-01',
    category: 'subject-stoplist',
    week: 0,
    day: 0,
    body: `Lord, be with me today. Be near. That's all I've got this morning.`,
    passages: [{ type: 'prayer', text: `Lord, be with me today. Be near. That's all I've got this morning.` }],
    subjects: [],
    note: 'A real prayer with no concrete subject. Genuine, and not a thread — "me" is a VAGUE_LABEL.',
  },
  {
    id: 'sub-stoplist-02',
    category: 'subject-stoplist',
    week: 4,
    day: 3,
    body: `God, give me wisdom for the decision on Friday. I keep asking for wisdom and I think what I want is a guarantee.`,
    passages: [
      {
        type: 'prayer',
        text: `God, give me wisdom for the decision on Friday. I keep asking for wisdom and I think what I want is a guarantee.`,
      },
    ],
    subjects: [],
    note: '"wisdom" is an ASK_LABEL — what is being asked for, not who is being prayed for.',
  },
  {
    id: 'sub-stoplist-03',
    category: 'subject-stoplist',
    week: 8,
    day: 4,
    body: `Jesus, I love you. That's it tonight. Nothing to ask for.`,
    passages: [{ type: 'prayer', text: `Jesus, I love you. That's it tonight. Nothing to ask for.` }],
    subjects: [],
    note: 'The One addressed is never the subject — DIVINE_LABELS drops "Jesus" even tagged as a person.',
  },
  {
    id: 'sub-stoplist-04',
    category: 'subject-stoplist',
    week: 11,
    day: 1,
    body: `Lord, this whole situation. You know. I'm not going to lay it out again.`,
    passages: [{ type: 'prayer', text: `Lord, this whole situation. You know. I'm not going to lay it out again.` }],
    subjects: [],
    note: '"this situation" is a VAGUE_LABEL — it would become a magnet thread that swallows everything.',
  },
  {
    id: 'sub-stoplist-05',
    category: 'subject-stoplist',
    week: 2,
    day: 1,
    body: `Praying for Grace tonight — she starts the new school on Monday and she has told exactly nobody that she's frightened.`,
    passages: [
      {
        type: 'prayer',
        text: `Praying for Grace tonight — she starts the new school on Monday and she has told exactly nobody that she's frightened.`,
      },
    ],
    subjects: [{ label: 'Grace', kind: 'person' }],
    entities: [{ kind: 'person', canonical: 'Grace', surfaceForms: ['Grace'] }],
    note: 'Grace is a girl. isSubjectLabel allows ASK_LABELS as a person, and this is why.',
  },
  {
    id: 'sub-stoplist-06',
    category: 'subject-stoplist',
    week: 9,
    day: 4,
    body: `Lord, I want more grace for the people at work than I currently have. Especially the ones who are right.`,
    passages: [
      {
        type: 'prayer',
        text: `Lord, I want more grace for the people at work than I currently have. Especially the ones who are right.`,
      },
    ],
    subjects: [],
    note: 'Same word, one week apart, and it must go the other way — grace the virtue is an ASK_LABEL.',
  },
]
