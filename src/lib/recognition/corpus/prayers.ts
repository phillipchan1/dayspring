// Prayer / Altar recognition corpus.
//
// Two things are measured here and they pull against each other:
//
//   RECALL  — altar.ts's HARVEST_CUE regex decides which entries reach the
//             model at all. An entry it misses is a prayer that can never land
//             on the Altar, no matter how good the model is. Category
//             'prayer-cue-blind' is that ceiling, written out.
//   PRECISION — the Altar is a place of remembrance. A resolution, a sermon
//             summary, or someone else's prayer showing up there is worse than
//             a gap. Categories 'prayer-cue-false-positive' and
//             'prayer-distractor' are the guard.
//
// `passages` are verbatim substrings of `body` (asserted in corpus.test.ts) —
// if they weren't, altar.ts's isVerbatim gate would drop the model's correct
// answer and the score would be a lie about the wrong thing.
//
// Three subjects are designed to recur across ≥3 ISO weeks so declared.ts's
// MIN_TOUCHES/MIN_WEEKS gates form threads: Naomi (person), Frontier (place),
// anxiety (theme). Two are designed to fall just short. See DESIGNED_THREADS
// in ./index.ts.
//
// FINDING (surfaced by scripts/recognition-eval.ts, 2026-07-31):
// none of the three threads form on a real run, and the grouping logic is not
// at fault — api/_lib/declared.test.ts forms all three from the same corpus
// when the tags are supplied by hand. The cause is upstream and structural:
// tagSubjects reads `spiritual_items.content`, which is the extracted prayer
// SPAN, while the subject's name almost always sits in the narration AROUND it.
//
//     entry:  "Naomi called and it was not good. She's not sleeping…"
//     span:   "God, be near her tonight in the way she actually needs…"
//                             ^^^ the tagger sees "her", never "Naomi"
//
// Deliberately left un-annotated as a defect, because it is not a bug in any
// one function — it is a consequence of where the pipeline draws the boundary.
// Fixing it means giving the tagger the surrounding entry as context, which is
// a design decision with its own cost. The corpus measures it either way.

import type { CorpusEntry } from './types'

export const PRAYER_ENTRIES: CorpusEntry[] = [
  // ── L. Clear prayers and senses the cue catches ───────────────────────────
  {
    id: 'pra-clear-01',
    category: 'prayer-clear',
    week: 0,
    day: 2,
    body: `Long day. The anxiety thing again around 3pm, out of nowhere, no reason I can point at.

Lord, I am tired of being afraid of a day that hasn't happened yet. Take the fear of tomorrow off me.

Made dinner. Went to bed early.`,
    passages: [
      {
        type: 'prayer',
        text: `Lord, I am tired of being afraid of a day that hasn't happened yet. Take the fear of tomorrow off me.`,
      },
    ],
    subjects: [{ label: 'anxiety', kind: 'theme' }],
  },
  {
    id: 'pra-clear-02',
    category: 'prayer-clear',
    week: 1,
    day: 3,
    body: `Naomi called and it was not good. She's not sleeping and she's not telling her mum.

God, be near her tonight in the way she actually needs, not the way I'd design it. Give her one night of real sleep.`,
    passages: [
      {
        type: 'prayer',
        text: `God, be near her tonight in the way she actually needs, not the way I'd design it. Give her one night of real sleep.`,
      },
    ],
    subjects: [{ label: 'Naomi', kind: 'person' }],
    entities: [{ kind: 'person', canonical: 'Naomi', surfaceForms: ['Naomi'] }],
  },
  {
    id: 'pra-clear-03',
    category: 'prayer-clear',
    week: 2,
    day: 2,
    body: `Frontier meeting ran two hours over. Everyone is tired and nobody will say so.

Father, I don't know how to lead this well. Show me what to put down. I keep picking up things you never handed me.`,
    passages: [
      {
        type: 'prayer',
        text: `Father, I don't know how to lead this well. Show me what to put down. I keep picking up things you never handed me.`,
      },
    ],
    subjects: [{ label: 'Frontier', kind: 'place' }],
    entities: [
      { kind: 'org', canonical: 'Frontier', surfaceForms: ['Frontier'], descriptor: 'my church' },
    ],
    note: "FIXED: HARVEST_CUE listed 'holy spirit' but no term for 'father', so a prayer opening \"Father,\" — one of the commonest forms there is — was marked scanned and never read.",
  },
  {
    id: 'pra-clear-04',
    category: 'prayer-clear',
    week: 4,
    day: 1,
    body: `Woke up at 4 with my chest tight. Same anxiety, same hour.

I sense that the thing being asked of me is not to fix it but to stop treating it as proof of something.

Lord, I hand you the 4am hour. It's yours before it's mine.`,
    passages: [
      {
        type: 'sense',
        text: `I sense that the thing being asked of me is not to fix it but to stop treating it as proof of something.`,
      },
      { type: 'prayer', text: `Lord, I hand you the 4am hour. It's yours before it's mine.` },
    ],
    subjects: [{ label: 'anxiety', kind: 'theme' }],
    note: 'A prayer and a sense in one entry — they must become two items, and later two separate threads.',
  },
  {
    id: 'pra-clear-05',
    category: 'prayer-clear',
    week: 5,
    day: 4,
    body: `Naomi again. Two months of this now.

Jesus, I have asked for the same thing so many times that the asking has gone thin. Ask it for me. I'm still here.`,
    passages: [
      {
        type: 'prayer',
        text: `Jesus, I have asked for the same thing so many times that the asking has gone thin. Ask it for me. I'm still here.`,
      },
    ],
    subjects: [{ label: 'Naomi', kind: 'person' }],
    entities: [{ kind: 'person', canonical: 'Naomi', surfaceForms: ['Naomi'] }],
  },
  {
    id: 'pra-clear-06',
    category: 'prayer-clear',
    week: 6,
    day: 3,
    body: `Frontier budget review. Numbers are worse than we said out loud.

Lord, if this closes, let it close cleanly and let no one be lied to on the way down. And if it doesn't, keep me from pretending I saved it.`,
    passages: [
      {
        type: 'prayer',
        text: `Lord, if this closes, let it close cleanly and let no one be lied to on the way down. And if it doesn't, keep me from pretending I saved it.`,
      },
    ],
    subjects: [{ label: 'Frontier', kind: 'place' }],
    entities: [{ kind: 'org', canonical: 'Frontier', surfaceForms: ['Frontier'] }],
  },
  {
    id: 'pra-clear-07',
    category: 'prayer-clear',
    week: 8,
    day: 2,
    body: `Better week. The anxiety was there but it was background, not weather.

Thank you, God, for a week where it was only background. I noticed. I want you to know I noticed.`,
    passages: [
      {
        type: 'prayer',
        text: `Thank you, God, for a week where it was only background. I noticed. I want you to know I noticed.`,
      },
    ],
    subjects: [{ label: 'anxiety', kind: 'theme' }],
  },
  {
    id: 'pra-clear-08',
    category: 'prayer-clear',
    week: 11,
    day: 2,
    body: `Frontier again. Third quarter in a row of this conversation.

Lord, give me the nerve to say the thing in the room instead of in the car afterwards.`,
    passages: [
      {
        type: 'prayer',
        text: `Lord, give me the nerve to say the thing in the room instead of in the car afterwards.`,
      },
    ],
    subjects: [{ label: 'Frontier', kind: 'place' }],
    entities: [{ kind: 'org', canonical: 'Frontier', surfaceForms: ['Frontier'] }],
  },

  // ── M. Genuine prayers HARVEST_CUE cannot see ─────────────────────────────
  // Every one of these is a real prayer containing none of the cue terms, so
  // the entry is marked scanned and never reaches the model. This is the
  // recall ceiling — the money the prefilter saves, priced in prayers lost.
  {
    id: 'pra-cue-blind-01',
    category: 'prayer-cue-blind',
    week: 9,
    day: 3,
    body: `Hospital again. They won't say anything until the morning.

Please just let her be okay tonight. I can't carry this one. I'm not being brave about it, I just can't.`,
    passages: [
      {
        type: 'prayer',
        text: `Please just let her be okay tonight. I can't carry this one. I'm not being brave about it, I just can't.`,
      },
    ],
    defect: 'cue-blind-prayer',
    note: 'The most desperate prayer in the corpus, and the prefilter never opens the entry.',
  },
  {
    id: 'pra-cue-blind-02',
    category: 'prayer-cue-blind',
    week: 10,
    day: 2,
    body: `You already know what I need before I say it. So I'm not going to explain it again tonight. You know.`,
    passages: [
      {
        type: 'prayer',
        text: `You already know what I need before I say it. So I'm not going to explain it again tonight. You know.`,
      },
    ],
    defect: 'cue-blind-prayer',
  },
  {
    id: 'pra-cue-blind-03',
    category: 'prayer-cue-blind',
    week: 10,
    day: 5,
    body: `Take it. I don't want it anymore and I've stopped pretending I can put it down on my own.`,
    passages: [
      {
        type: 'prayer',
        text: `Take it. I don't want it anymore and I've stopped pretending I can put it down on my own.`,
      },
    ],
    defect: 'cue-blind-prayer',
  },
  {
    id: 'pra-clear-11',
    category: 'prayer-clear',
    week: 12,
    day: 2,
    body: `Ada asked me tonight why I was quiet at dinner and I lied to her.

Make me the kind of father she won't have to recover from. That's it. That's the whole ask.`,
    passages: [
      {
        type: 'prayer',
        text: `Make me the kind of father she won't have to recover from. That's it. That's the whole ask.`,
      },
    ],
    entities: [{ kind: 'person', canonical: 'Ada', surfaceForms: ['Ada'], descriptor: 'my daughter' }],
    note: 'Was cue-blind until \'father\' joined HARVEST_CUE — and it only qualifies because the writer happens to use the word about himself. A near miss, not a solved case.',
  },
  {
    id: 'pra-cue-blind-05',
    category: 'prayer-cue-blind',
    week: 13,
    day: 4,
    body: `Same as last week. Same as the week before that.

I'm asking again. I don't have a new way to say it and I don't think you need one.`,
    passages: [
      {
        type: 'prayer',
        text: `I'm asking again. I don't have a new way to say it and I don't think you need one.`,
      },
    ],
    defect: 'cue-blind-prayer',
  },
  {
    id: 'pra-cue-blind-06',
    category: 'prayer-cue-blind',
    week: 14,
    day: 5,
    body: `If you're there — and most days I think you are — then do something about Thursday. Anything. I'll take a small thing.`,
    passages: [
      {
        type: 'prayer',
        text: `If you're there — and most days I think you are — then do something about Thursday. Anything. I'll take a small thing.`,
      },
    ],
    defect: 'cue-blind-prayer',
  },

  // ── N. Cue fires, but there is no prayer ──────────────────────────────────
  // The prefilter is allowed to be generous — these cost a model call. What
  // must not happen is a passage landing on the Altar.
  {
    id: 'pra-cue-fp-01',
    category: 'prayer-cue-false-positive',
    week: 0,
    day: 5,
    body: `Sermon was on grace. It was fine. Went long. The illustration about the car didn't work but he committed to it, which I respected.`,
    passages: [],
  },
  {
    id: 'pra-cue-fp-02',
    category: 'prayer-cue-false-positive',
    week: 2,
    day: 0,
    body: `Worship set ran forty minutes over and we missed the lunch booking. Nobody's fault. Rebooked for Tuesday.`,
    passages: [],
  },
  {
    id: 'pra-cue-fp-03',
    category: 'prayer-cue-false-positive',
    week: 4,
    day: 4,
    body: `Read an article about how the word "faith" gets used in politics and how little it means by the time it gets there. Sent it to Dan. He'll hate it.`,
    passages: [],
  },
  {
    id: 'pra-cue-fp-04',
    category: 'prayer-cue-false-positive',
    week: 7,
    day: 2,
    body: `Booked the venue for the blessing of the house thing. Caterer confirmed. Forty-two people, which is more than I wanted and fewer than she wanted.`,
    passages: [],
  },
  {
    id: 'pra-cue-fp-05',
    category: 'prayer-cue-false-positive',
    week: 11,
    day: 5,
    body: `The prayer meeting has moved to Wednesdays. Emailed everyone. Two replies so far, both saying Wednesday doesn't work.`,
    passages: [],
  },
  {
    id: 'pra-cue-fp-06',
    category: 'prayer-cue-false-positive',
    week: 14,
    day: 2,
    body: `Scripture memorisation app deleted. Four months, eleven verses, and I couldn't tell you one of them now. The app was not the problem.`,
    passages: [],
  },

  // ── O. Distractors the prompt explicitly excludes ─────────────────────────
  {
    id: 'pra-distractor-01',
    category: 'prayer-distractor',
    week: 1,
    day: 6,
    body: `Dan prayed at the end and it was the realest thing said all evening. He said "God, we are not okay and we're tired of saying we are." Everyone went quiet.`,
    passages: [],
    entities: [{ kind: 'person', canonical: 'Dan', surfaceForms: ['Dan'] }],
    note: "Someone else's prayer. Verbatim and moving — and not the writer's, so not theirs to remember.",
  },
  {
    id: 'pra-distractor-02',
    category: 'prayer-distractor',
    week: 3,
    day: 2,
    body: `Right. New rule. No phone before 8am, ten minutes of prayer instead, no email after 8pm, and I'm going to be a person who reads at night instead of scrolling. Starting Monday. I mean it this time.`,
    passages: [],
    note: 'A resolution, not addressed to God. The Altar is not a habit tracker.',
  },
  {
    id: 'pra-distractor-03',
    category: 'prayer-distractor',
    week: 5,
    day: 0,
    body: `The last song in the worship set was the one that goes "I will praise you in this storm" and half the room had their hands up and I was thinking about the parking meter.`,
    passages: [],
    note: 'Quoted worship lyric. Not the writer speaking to God.',
  },
  {
    id: 'pra-distractor-04',
    category: 'prayer-distractor',
    week: 8,
    day: 5,
    body: `God is clearly doing something with the young families at Frontier. Four new ones this month and none of them came because of anything we planned.`,
    passages: [],
    entities: [{ kind: 'org', canonical: 'Frontier', surfaceForms: ['Frontier'] }],
    note: 'Third-person narration about God — an observation, not a prayer or a personal sense.',
  },
  {
    id: 'pra-distractor-05',
    category: 'prayer-distractor',
    week: 12,
    day: 5,
    body: `Mum said she's been praying for us every morning since March and I didn't know what to do with that so I said thanks and changed the subject.`,
    passages: [],
    note: "Another person's praying, reported. Not the writer's own words to God.",
  },

  // ── P. Paraphrase traps ───────────────────────────────────────────────────
  // The natural summary of these entries is not a contiguous span. A model
  // that reaches for the summary trips isVerbatim and produces nothing; the
  // correct answer is the awkward literal span.
  {
    id: 'pra-paraphrase-01',
    category: 'prayer-paraphrase-trap',
    week: 7,
    day: 5,
    body: `Lord — and I know how this sounds, and I know I said the opposite in March, and I know I'll probably say the opposite again — I don't want the job.`,
    passages: [
      {
        type: 'prayer',
        text: `Lord — and I know how this sounds, and I know I said the opposite in March, and I know I'll probably say the opposite again — I don't want the job.`,
      },
    ],
    note: 'The obvious summary ("Lord, I don\'t want the job") is not a contiguous span and must be rejected by isVerbatim.',
  },
  {
    id: 'pra-paraphrase-02',
    category: 'prayer-paraphrase-trap',
    week: 9,
    day: 6,
    body: `God,

be patient with me.

I'm slow.

That's the prayer.`,
    passages: [{ type: 'prayer', text: `God,\n\nbe patient with me.\n\nI'm slow.` }],
    note: 'Line breaks inside the span — isVerbatim is whitespace-tolerant, which is why this can pass.',
  },
  {
    id: 'pra-paraphrase-03',
    category: 'prayer-paraphrase-trap',
    week: 13,
    day: 1,
    body: `Wrote out the whole thing, read it back, deleted it, and what was left was: forgive me for the way I talked to her on Tuesday. That's the only part that was true.`,
    passages: [
      { type: 'prayer', text: `forgive me for the way I talked to her on Tuesday` },
    ],
    note: 'The prayer is embedded mid-sentence in narration. Boundaries are genuinely arguable — scoring uses containment, not equality.',
  },

  // ── Near-miss subjects: designed to fall just short of a thread ───────────
  // Four touches, all inside one ISO week → fails MIN_WEEKS (3 distinct weeks).
  {
    id: 'pra-nearmiss-burst-01',
    category: 'prayer-clear',
    week: 7,
    day: 0,
    body: `The move is three weeks out and nothing is packed.

Lord, settle me about the move. I keep doing the maths at 2am.`,
    passages: [{ type: 'prayer', text: `Lord, settle me about the move. I keep doing the maths at 2am.` }],
    subjects: [{ label: 'the move', kind: 'theme' }],
  },
  {
    id: 'pra-nearmiss-burst-02',
    category: 'prayer-clear',
    week: 7,
    day: 1,
    body: `Survey came back on the house. Two things wrong, neither fatal.

God, keep me from making the move mean more than it means.`,
    passages: [{ type: 'prayer', text: `God, keep me from making the move mean more than it means.` }],
    subjects: [{ label: 'the move', kind: 'theme' }],
  },
  {
    id: 'pra-nearmiss-burst-03',
    category: 'prayer-clear',
    week: 7,
    day: 3,
    body: `Packing. Found the box of her dad's things and stopped for an hour.

Lord, be in the boxes too. Not just the arrival.`,
    passages: [{ type: 'prayer', text: `Lord, be in the boxes too. Not just the arrival.` }],
    subjects: [{ label: 'the move', kind: 'theme' }],
  },
  {
    id: 'pra-nearmiss-burst-04',
    category: 'prayer-clear',
    week: 7,
    day: 6,
    body: `Last Sunday in this house.

Jesus, thank you for eleven years here. Carry what should be carried and let the rest stay.`,
    passages: [
      {
        type: 'prayer',
        text: `Jesus, thank you for eleven years here. Carry what should be carried and let the rest stay.`,
      },
    ],
    subjects: [{ label: 'the move', kind: 'theme' }],
  },
  // Two touches, eight weeks apart → fails MIN_TOUCHES (3).
  {
    id: 'pra-nearmiss-sparse-01',
    category: 'prayer-clear',
    week: 3,
    day: 5,
    body: `Bristol trip booked for the spring.

Lord, go ahead of us to Bristol. I don't know what that means but it's what came out.`,
    passages: [
      {
        type: 'prayer',
        text: `Lord, go ahead of us to Bristol. I don't know what that means but it's what came out.`,
      },
    ],
    subjects: [{ label: 'Bristol', kind: 'place' }],
    entities: [{ kind: 'place', canonical: 'Bristol', surfaceForms: ['Bristol'] }],
  },
  {
    id: 'pra-nearmiss-sparse-02',
    category: 'prayer-clear',
    week: 11,
    day: 6,
    body: `Bristol again in the diary, moved to June.

God, same prayer as before about Bristol. I haven't got a better one.`,
    passages: [
      { type: 'prayer', text: `God, same prayer as before about Bristol. I haven't got a better one.` },
    ],
    subjects: [{ label: 'Bristol', kind: 'place' }],
    entities: [{ kind: 'place', canonical: 'Bristol', surfaceForms: ['Bristol'] }],
  },

  // Third touch for anxiety and Naomi so both clear MIN_TOUCHES across ≥3 weeks.
  {
    id: 'pra-clear-09',
    category: 'prayer-clear',
    week: 12,
    day: 3,
    body: `Naomi's results came back clear. I read the message four times.

God, thank you. That's all. Thank you.`,
    passages: [{ type: 'prayer', text: `God, thank you. That's all. Thank you.` }],
    subjects: [{ label: 'Naomi', kind: 'person' }],
    entities: [{ kind: 'person', canonical: 'Naomi', surfaceForms: ['Naomi'] }],
  },
  {
    id: 'pra-clear-10',
    category: 'prayer-clear',
    week: 15,
    day: 2,
    body: `Anxiety came back this week after a good month. Less frightening the second time, which is something.

Lord, I'm not asking you to take it this time. I'm asking you to be in it with me.`,
    passages: [
      {
        type: 'prayer',
        text: `Lord, I'm not asking you to take it this time. I'm asking you to be in it with me.`,
      },
    ],
    subjects: [{ label: 'anxiety', kind: 'theme' }],
  },
]
