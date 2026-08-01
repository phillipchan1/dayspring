// Concordance recognition corpus.
//
// The Concordance charter (api/_lib/concordance.ts) asks one question of every
// candidate: does this help REPRODUCE the user, or CONCLUDE something about
// them? Names, spellings, and shorthand reproduce. Moods, traits and struggles
// conclude, and are refused.
//
// So there are two failure modes worth measuring, and they are not symmetric:
// missing "Es" for Esther costs fidelity, but letting "anxious about the move"
// through as a descriptor breaks the promise that Dayspring never renders a
// verdict on someone's interior life.
//
// `surfaceForms` are verbatim substrings of `body` (asserted in corpus.test.ts)
// — concordance.ts's gateCandidate drops any surface form that isn't.

import type { CorpusEntry } from './types'

export const ENTITY_ENTRIES: CorpusEntry[] = [
  // ── Q. Alias graphs, recurring so machineConfidence climbs ────────────────
  {
    id: 'ent-alias-01',
    category: 'entity-alias',
    week: 0,
    day: 3,
    body: `Esther is doing the thing where she reorganises the kitchen when she's got something to say. Twelve years and I still wait for her to start.`,
    entities: [
      { kind: 'person', canonical: 'Esther', surfaceForms: ['Esther'], descriptor: 'my wife' },
    ],
  },
  {
    id: 'ent-alias-02',
    category: 'entity-alias',
    week: 1,
    day: 1,
    body: `Es booked the tickets without telling me, which is her way of making sure we actually go.`,
    entities: [{ kind: 'person', canonical: 'Esther', surfaceForms: ['Es'] }],
    note: 'The writer\'s own shorthand. "Es" must land on the Esther row, not open a second one.',
  },
  {
    id: 'ent-alias-03',
    category: 'entity-alias',
    week: 3,
    day: 3,
    body: `Long walk with Es after dinner. She said the thing about my hours that she's been not-saying since January.`,
    entities: [{ kind: 'person', canonical: 'Esther', surfaceForms: ['Es'] }],
  },
  {
    id: 'ent-alias-04',
    category: 'entity-alias',
    week: 4,
    day: 0,
    body: `Frontier had a good morning. Two hundred and something in, which for a February is unusual.`,
    entities: [{ kind: 'org', canonical: 'Frontier', surfaceForms: ['Frontier'] }],
  },
  {
    id: 'ent-alias-05',
    category: 'entity-alias',
    week: 6,
    day: 1,
    body: `NQ closed down twelve points and I watched every one of them. Should have walked away at lunch.`,
    entities: [
      { kind: 'term', canonical: 'NQ', surfaceForms: ['NQ'], descriptor: 'futures ticker' },
    ],
    note: 'Domain shorthand. Reproducing it is the point — a transcript that writes "Nasdaq" gets the person wrong.',
  },
  {
    id: 'ent-alias-06',
    category: 'entity-alias',
    week: 8,
    day: 1,
    body: `NQ again. Flat day, which after last week I will take.`,
    entities: [{ kind: 'term', canonical: 'NQ', surfaceForms: ['NQ'] }],
  },
  {
    id: 'ent-alias-07',
    category: 'entity-alias',
    week: 9,
    day: 1,
    body: `Esther and Es are the same person and I've written it both ways in the same week, which I only noticed reading back.`,
    entities: [
      { kind: 'person', canonical: 'Esther', surfaceForms: ['Esther', 'Es'] },
    ],
    note: 'Both spellings in one body — the merge has to happen inside a single entry, not just across them.',
  },
  {
    id: 'ent-alias-08',
    category: 'entity-alias',
    week: 10,
    day: 0,
    body: `Started on the loft. Calling it the loft project because "converting the loft" makes it sound like it has a deadline.`,
    entities: [{ kind: 'project', canonical: 'the loft project', surfaceForms: ['the loft project'] }],
  },
  {
    id: 'ent-alias-09',
    category: 'entity-alias',
    week: 12,
    day: 0,
    body: `Loft project stalled on the joists. The builder says six weeks, which means twelve.`,
    entities: [{ kind: 'project', canonical: 'the loft project', surfaceForms: ['Loft project'] }],
  },
  {
    id: 'ent-alias-10',
    category: 'entity-alias',
    week: 14,
    day: 0,
    body: `Drove up to Whitby with Es for the day. Cold, empty, exactly right.`,
    entities: [
      { kind: 'place', canonical: 'Whitby', surfaceForms: ['Whitby'] },
      { kind: 'person', canonical: 'Esther', surfaceForms: ['Es'] },
    ],
  },

  // ── R. Descriptor bait — keep the entity, drop the verdict ────────────────
  {
    id: 'ent-descriptor-01',
    category: 'entity-descriptor-bait',
    week: 2,
    day: 4,
    body: `Es is anxious about the move and won't say it in those words, so we're having the conversation sideways.`,
    entities: [{ kind: 'person', canonical: 'Esther', surfaceForms: ['Es'], descriptor: '' }],
    note: 'EVALUATIVE_DESCRIPTOR must strip "anxious about the move". The person stays; the diagnosis does not.',
  },
  {
    id: 'ent-descriptor-02',
    category: 'entity-descriptor-bait',
    week: 5,
    day: 2,
    body: `Dan seems lonely since the split and I don't know whether saying so would help or just make it a fact.`,
    entities: [{ kind: 'person', canonical: 'Dan', surfaceForms: ['Dan'], descriptor: '' }],
    note: 'A conclusion about a third party is exactly what the Concordance must not store.',
  },
  {
    id: 'ent-descriptor-03',
    category: 'entity-descriptor-bait',
    week: 7,
    day: 3,
    body: `Frontier is a church that's been struggling with the same thing for three years and keeps calling it a season.`,
    entities: [{ kind: 'org', canonical: 'Frontier', surfaceForms: ['Frontier'], descriptor: '' }],
    note: '"a church" alone would be a fine identity descriptor; "struggling" poisons it and the whole descriptor is dropped.',
  },
  {
    id: 'ent-descriptor-04',
    category: 'entity-descriptor-bait',
    week: 13,
    day: 0,
    body: `Ada is my daughter and she is seven and she is currently the most confident person in this house.`,
    entities: [
      { kind: 'person', canonical: 'Ada', surfaceForms: ['Ada'], descriptor: 'my daughter' },
    ],
    note: 'Control: a clean identity descriptor survives. Not everything with a person in it is a verdict.',
  },

  // ── S. Generic-noun controls ──────────────────────────────────────────────
  {
    id: 'ent-generic-01',
    category: 'entity-generic-control',
    week: 1,
    day: 0,
    body: `The car needs doing before the winter. The gutters need doing before the winter. The winter does not care.`,
    entities: [],
  },
  {
    id: 'ent-generic-02',
    category: 'entity-generic-control',
    week: 6,
    day: 4,
    body: `Spent the morning on the accounts and the afternoon regretting the morning.`,
    entities: [],
  },
  {
    id: 'ent-generic-03',
    category: 'entity-generic-control',
    week: 10,
    day: 3,
    body: `Mark said the quiet part out loud in the meeting and everyone pretended he hadn't.`,
    entities: [{ kind: 'person', canonical: 'Mark', surfaceForms: ['Mark'] }],
    refs: [],
    note: 'A person named Mark. He is an entity and must NOT be a scripture reference — no digit follows, so the parser stays quiet.',
  },
  {
    id: 'ent-generic-04',
    category: 'entity-generic-control',
    week: 15,
    day: 1,
    body: `Hosea texted after two years, out of nowhere, asking if I still play. I do not still play.`,
    entities: [{ kind: 'person', canonical: 'Hosea', surfaceForms: ['Hosea'] }],
    refs: [],
    note: 'Someone actually named Hosea. The map must not light the book.',
  },
]
