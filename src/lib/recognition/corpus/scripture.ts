// Scripture recognition corpus.
//
// `refs` is what a reader would say the entry cites. `currentRefs` is what
// parseReferences actually emits today, present only where the two differ.
// The gap between them is the measurement.
//
// Entries whose note begins FIXED once carried a `currentRefs`. They now assert
// the correct answer, so they are regression guards rather than defect pins —
// the history is kept in the note because a defect worth fixing is worth being
// able to recognise if it ever comes back.
//
// Prose is written the way people actually journal — abbreviations, lowercase,
// a reference dropped mid-sentence, a verse remembered without its address.

import type { CorpusEntry } from './types'

export const SCRIPTURE_ENTRIES: CorpusEntry[] = [
  // ── A. Baseline — every shape parse.ts's own header claims to handle ───────
  {
    id: 'scr-baseline-01',
    category: 'scripture-baseline',
    week: 0,
    day: 1,
    body: `Woke up before the alarm again. Sat with Phil 4:6 for a while — "do not be anxious about anything" — and then just stared at the ceiling being anxious about everything.

Read Romans 8:28-30 after. The word that stuck was "called."`,
    refs: [{ osis: 'Phil.4.6' }, { osis: 'Rom.8.28-Rom.8.30' }],
  },
  {
    id: 'scr-baseline-02',
    category: 'scripture-baseline',
    week: 0,
    day: 4,
    body: `Small group tonight. We're doing 1 Cor 13 for the third week running and I still don't think anyone has said anything true about it.

Walked home the long way. Ps 23 in my head the whole time, not on purpose.`,
    refs: [{ osis: '1Cor.13' }, { osis: 'Ps.23' }],
  },
  {
    id: 'scr-baseline-03',
    category: 'scripture-baseline',
    week: 1,
    day: 2,
    body: `John 15:5,11 — abide, and joy. Those two sitting next to each other is doing something to me. I keep wanting joy without the abiding.`,
    refs: [{ osis: 'John.15.5' }, { osis: 'John.15.11' }],
    note: 'A verse list expands into one ref per landing place, sharing a char span.',
  },
  {
    id: 'scr-baseline-04',
    category: 'scripture-baseline',
    week: 1,
    day: 5,
    body: `Couldn't sleep. Psalm 42 and 43 back to back — they're really one psalm, someone told me once. "Why are you cast down, O my soul." Asked twice. Answered once.`,
    refs: [{ osis: 'Ps.42' }, { osis: 'Ps.43' }],
    note: 'Chapter continuation via "and" — two distinct landing places.',
  },
  {
    id: 'scr-baseline-05',
    category: 'scripture-baseline',
    week: 2,
    day: 0,
    body: `Started at the beginning again. Gen. 1 out loud to the kids, doing the voices. Ada asked what "formless" means and I did not have a good answer.`,
    refs: [{ osis: 'Gen.1' }],
  },
  {
    id: 'scr-baseline-06',
    category: 'scripture-baseline',
    week: 2,
    day: 3,
    body: `Romans chapter 8 on the train. Whole thing. Then Rom 8 v 28 again on the way back, slower.`,
    refs: [{ osis: 'Rom.8' }, { osis: 'Rom.8.28' }],
    note: 'The "chapter" keyword and a bare "v" verse marker after book+chapter.',
  },

  // ── B. Lowercase book names ───────────────────────────────────────────────
  {
    id: 'scr-lowercase-01',
    category: 'scripture-lowercase',
    week: 2,
    day: 6,
    body: `read john 3 today, first time in years. didn't take notes. didn't want to.`,
    refs: [{ osis: 'John.3' }],
    note: 'FIXED: lowercase journaling used to be invisible to the map — this entry never lit John.',
  },
  {
    id: 'scr-lowercase-02',
    category: 'scripture-lowercase',
    week: 3,
    day: 1,
    body: `psalm 23 again. i don't know why it's always this one when things are bad. i know the whole thing and i still read it off the page.`,
    refs: [{ osis: 'Ps.23' }],
  },
  {
    id: 'scr-lowercase-03',
    category: 'scripture-lowercase',
    week: 3,
    day: 4,
    body: `back in 1 cor 13 with the group. verse 4 is a knife when you've been unkind all week.`,
    refs: [{ osis: '1Cor.13' }],
  },
  {
    id: 'scr-lowercase-04',
    category: 'scripture-lowercase',
    week: 4,
    day: 2,
    body: `notes from sunday — hebrews 11, the whole roll call. pastor kept saying "and these all died in faith, not having received the things promised." sat with that.`,
    refs: [{ osis: 'Heb.11' }],
  },
  {
    id: 'scr-lowercase-05',
    category: 'scripture-lowercase',
    week: 4,
    day: 5,
    body: `isaiah 43:2 came up twice today from two different people who don't know each other. i'm choosing to take that as something.`,
    refs: [{ osis: 'Isa.43.2' }],
  },
  {
    id: 'scr-lowercase-06',
    category: 'scripture-lowercase',
    week: 5,
    day: 0,
    body: `quick one before bed: matthew 6:34. enough for today. tomorrow gets its own.`,
    refs: [{ osis: 'Matt.6.34' }],
  },

  // ── C. Cross-chapter verse spans — the confidence-1.0 lie ─────────────────
  {
    id: 'scr-xchapter-verse-01',
    category: 'scripture-crosschapter-verse',
    week: 5,
    day: 3,
    body: `Read Romans 8:28-9:2 in one sitting. Paul goes from "all things work together" straight into "great sorrow and unceasing anguish in my heart" and doesn't explain the turn. I think that's the point.`,
    refs: [{ osis: 'Rom.8.28-Rom.9.2' }],
    note: 'FIXED (was the worst defect found): used to emit Rom.8.2 at confidence 1.0 — a verse the writer never read, indistinguishable downstream from a correct parse.',
  },
  {
    id: 'scr-xchapter-verse-02',
    category: 'scripture-crosschapter-verse',
    week: 5,
    day: 6,
    body: `The Sermon on the Mount in one go — Matt 5:3-7:29. It is much harder read straight through than in pieces on Sundays.`,
    refs: [{ osis: 'Matt.5.3-Matt.7.29' }],
  },
  {
    id: 'scr-xchapter-verse-03',
    category: 'scripture-crosschapter-verse',
    week: 6,
    day: 2,
    body: `Ps 119:105-120:1 before work. The long one bleeding into the short one — lamp for my feet, then straight to "in my distress I called."`,
    refs: [{ osis: 'Ps.119.105-Ps.120.1' }],
  },
  {
    id: 'scr-xchapter-verse-04',
    category: 'scripture-crosschapter-verse',
    week: 6,
    day: 5,
    body: `Couldn't stop at the chapter break. John 20:19-21:14, all the way to breakfast on the beach.`,
    refs: [{ osis: 'John.20.19-John.21.14' }],
  },

  // ── D. Cross-chapter ranges ───────────────────────────────────────────────
  {
    id: 'scr-xchapter-range-01',
    category: 'scripture-crosschapter-range',
    week: 7,
    day: 1,
    body: `Romans 8-9 this morning. Two chapters that people use to argue with each other, read by one tired person at a kitchen table.`,
    refs: [{ osis: 'Rom.8' }, { osis: 'Rom.9' }],
    currentRefs: ['Rom.8'],
    defect: 'crosschapter-range',
    note: 'Half the reading never reaches the map.',
  },
  {
    id: 'scr-xchapter-range-02',
    category: 'scripture-crosschapter-range',
    week: 7,
    day: 4,
    body: `Genesis 1-3 with the kids over three nights. Made, named, lost. They asked better questions than I did.`,
    refs: [{ osis: 'Gen.1' }, { osis: 'Gen.2' }, { osis: 'Gen.3' }],
    currentRefs: ['Gen.1'],
    defect: 'crosschapter-range',
  },
  {
    id: 'scr-xchapter-range-03',
    category: 'scripture-crosschapter-range',
    week: 8,
    day: 0,
    body: `1 Sam 16-17 — anointed in private, then the giant. The gap between those two is where most of my life happens.`,
    refs: [{ osis: '1Sam.16' }, { osis: '1Sam.17' }],
    currentRefs: ['1Sam.16'],
    defect: 'crosschapter-range',
  },

  // ── E. Bare book names, no chapter ────────────────────────────────────────
  {
    id: 'scr-bare-book-01',
    category: 'scripture-bare-book',
    week: 8,
    day: 3,
    body: `Sat in Philippians this morning. Didn't read it so much as sit in it. Whole letter written from a cell and it will not stop talking about joy.`,
    refs: [{ osis: 'Phil' }],
    currentRefs: [],
    defect: 'bare-book-no-chapter',
    note: 'Reading a whole book is the most committed thing a person does, and it registers as nothing.',
  },
  {
    id: 'scr-bare-book-02',
    category: 'scripture-bare-book',
    week: 8,
    day: 6,
    body: `Reading through Ecclesiastes on the flight. Everyone told me it would be bleak. It's the most honest thing I've read in months.`,
    refs: [{ osis: 'Eccl' }],
    currentRefs: [],
    defect: 'bare-book-no-chapter',
  },
  {
    id: 'scr-bare-book-03',
    category: 'scripture-bare-book',
    week: 9,
    day: 2,
    body: `Started Lamentations because it matched. No plan, no notes.`,
    refs: [{ osis: 'Lam' }],
    currentRefs: [],
    defect: 'bare-book-no-chapter',
  },
  {
    id: 'scr-bare-book-04',
    category: 'scripture-bare-book',
    week: 9,
    day: 5,
    body: `Finished Hebrews tonight. Took eleven weeks. I want to say something about it and I can't yet.`,
    refs: [{ osis: 'Heb' }],
    currentRefs: [],
    defect: 'bare-book-no-chapter',
  },
  {
    id: 'scr-bare-book-05',
    category: 'scripture-bare-book',
    week: 10,
    day: 1,
    body: `Someone at the table said Habakkuk was their favourite and I realised I have never once read Habakkuk.`,
    refs: [{ osis: 'Hab' }],
    currentRefs: [],
    defect: 'bare-book-no-chapter',
  },

  // ── F. Ordinal and unusual name forms ─────────────────────────────────────
  {
    id: 'scr-ordinal-01',
    category: 'scripture-ordinal',
    week: 10,
    day: 4,
    body: `1st Corinthians 13 at the wedding, obviously. Still landed.`,
    refs: [{ osis: '1Cor.13' }],
    note: 'FIXED: canon.ts had no ordinal forms. Was doubly blocked until admits() replaced the capitalization guard, after which it became a pure data edit.',
  },
  {
    id: 'scr-ordinal-02',
    category: 'scripture-ordinal',
    week: 11,
    day: 0,
    body: `2nd Timothy 2 this morning — "endure hardship as a good soldier." Not the verse I wanted.`,
    refs: [{ osis: '2Tim.2' }],
  },
  {
    id: 'scr-ordinal-03',
    category: 'scripture-ordinal',
    week: 11,
    day: 3,
    body: `Psalms 40 on repeat. He drew me up from the pit. I keep waiting for the new song part.`,
    refs: [{ osis: 'Ps.40' }],
    note: "The plural 'Psalms' form is already in canon.ts — this pins that it stays.",
  },
  {
    id: 'scr-ordinal-04',
    category: 'scripture-ordinal',
    week: 11,
    day: 6,
    body: `Song of Songs 2 read aloud on the anniversary. Felt ridiculous. Did it anyway.`,
    refs: [{ osis: 'Song.2' }],
  },

  // ── G. Sentence-boundary false positives ──────────────────────────────────
  {
    id: 'scr-boundary-01',
    category: 'scripture-sentence-boundary',
    week: 12,
    day: 1,
    body: `Finished John 3. 16 people came to the evening thing, which is 16 more than last time.`,
    refs: [{ osis: 'John.3' }],
    note: 'FIXED: the map used to light the most famous verse in the Bible off a headcount.',
  },
  {
    id: 'scr-boundary-02',
    category: 'scripture-sentence-boundary',
    week: 12,
    day: 4,
    body: `Taught on Acts 2. Then we ate for two hours and nobody wanted to leave.`,
    refs: [{ osis: 'Acts.2' }],
    currentRefs: [],
    defect: 'ambiguous-word-needs-verse',
    note: 'The price of the admission rule, written down: "Acts" is an ordinary word, so with no verse it yields nothing. A real loss — people write "Acts 2" constantly.',
  },
  {
    id: 'scr-boundary-03',
    category: 'scripture-sentence-boundary',
    week: 13,
    day: 0,
    body: `Met Mark 5 minutes late and he had already ordered for both of us.`,
    refs: [],
    note: 'FIXED: a friend named Mark plus a number used to be enough to fabricate a reading.',
  },
  {
    id: 'scr-boundary-04',
    category: 'scripture-sentence-boundary',
    week: 13,
    day: 3,
    body: `Is 2 weeks enough notice for them? Feels short. Sending it anyway.`,
    refs: [],
    note: "FIXED: sentence-initial 'Is' cleared the old capitalization guard and resolved to Isaiah.",
  },
  {
    id: 'scr-boundary-05',
    category: 'scripture-sentence-boundary',
    week: 13,
    day: 6,
    body: `Job 2 was a slog — second interview, same panel, worse questions. Third one is Thursday.`,
    refs: [],
    note: 'FIXED: job hunting used to read as the book of Job.',
  },

  // ── H. Anchorless verse markers ───────────────────────────────────────────
  {
    id: 'scr-anchorless-01',
    category: 'scripture-anchorless',
    week: 14,
    day: 1,
    body: `Sermon notes.

Romans 12 — living sacrifice.

vv. 4-5, the body bit. One body, many members. He spent most of the time here.`,
    refs: [{ osis: 'Rom.12' }, { osis: 'Rom.12.4-Rom.12.5' }],
    currentRefs: ['Rom.12'],
    defect: 'anchorless-verse-marker',
    note: 'The verses actually dwelt on are the ones that vanish.',
  },
  {
    id: 'scr-anchorless-02',
    category: 'scripture-anchorless',
    week: 14,
    day: 4,
    body: `Ephesians 2 this morning.

By grace you have been saved.

v. 10 is the one I keep forgetting — workmanship, prepared beforehand.`,
    refs: [{ osis: 'Eph.2' }, { osis: 'Eph.2.10' }],
    currentRefs: ['Eph.2'],
    defect: 'anchorless-verse-marker',
  },
  {
    id: 'scr-anchorless-03',
    category: 'scripture-anchorless',
    week: 15,
    day: 0,
    body: `Hosea 11 tonight. Then vs 8 alone for a long time. "How can I give you up?"`,
    refs: [{ osis: 'Hos.11' }, { osis: 'Hos.11.8' }],
    currentRefs: ['Hos.11'],
    defect: 'anchorless-verse-marker',
  },
  {
    id: 'scr-anchorless-04',
    category: 'scripture-anchorless',
    week: 15,
    day: 3,
    body: `Study notes, Colossians 3.

verses 12-14 — compassion, kindness, humility, meekness, patience. And above all these, love.`,
    refs: [{ osis: 'Col.3' }, { osis: 'Col.3.12-Col.3.14' }],
    currentRefs: ['Col.3'],
    defect: 'anchorless-verse-marker',
  },

  // ── I. Bare allusions — quoted scripture with no address ──────────────────
  // Nothing in the pipeline writes status:'suggested' today. These are scored
  // on their own line so the dark funnel stays visible in every report.
  {
    id: 'scr-allusion-01',
    category: 'scripture-allusion',
    week: 0,
    day: 6,
    body: `Kept coming back to "be still and know" all afternoon. Couldn't do either part.`,
    refs: [{ osis: 'Ps.46.10', status: 'suggested' }],
    currentRefs: [],
    defect: 'allusion-undetected',
  },
  {
    id: 'scr-allusion-02',
    category: 'scripture-allusion',
    week: 1,
    day: 3,
    body: `Woke at 4 and the line in my head was his mercies are new every morning. Which was annoying, and true.`,
    refs: [{ osis: 'Lam.3.23', status: 'suggested' }],
    currentRefs: [],
    defect: 'allusion-undetected',
  },
  {
    id: 'scr-allusion-03',
    category: 'scripture-allusion',
    week: 3,
    day: 6,
    body: `A thorn in my flesh, I guess. Three times now I've asked for it to be taken away and three times nothing.`,
    refs: [{ osis: '2Cor.12.7', status: 'suggested' }],
    currentRefs: [],
    defect: 'allusion-undetected',
  },
  {
    id: 'scr-allusion-04',
    category: 'scripture-allusion',
    week: 6,
    day: 0,
    body: `"I can do all things through him who strengthens me" got put on a mug and I think that's why I can't hear it anymore.`,
    refs: [{ osis: 'Phil.4.13', status: 'suggested' }],
    currentRefs: [],
    defect: 'allusion-undetected',
  },
  {
    id: 'scr-allusion-05',
    category: 'scripture-allusion',
    week: 7,
    day: 6,
    body: `Weeping may tarry for the night. That's the whole entry. It's late.`,
    refs: [{ osis: 'Ps.30.5', status: 'suggested' }],
    currentRefs: [],
    defect: 'allusion-undetected',
  },
  {
    id: 'scr-allusion-06',
    category: 'scripture-allusion',
    week: 9,
    day: 0,
    body: `Told Dan the thing about the lamp and the feet and the path. He said that's the whole of the Christian life and then paid for lunch.`,
    refs: [{ osis: 'Ps.119.105', status: 'suggested' }],
    currentRefs: [],
    defect: 'allusion-undetected',
  },
  {
    id: 'scr-allusion-07',
    category: 'scripture-allusion',
    week: 12,
    day: 6,
    body: `Faith is the assurance of things hoped for. I have the hoping down. The assurance is the part I'm missing.`,
    refs: [{ osis: 'Heb.11.1', status: 'suggested' }],
    currentRefs: [],
    defect: 'allusion-undetected',
  },
  {
    id: 'scr-allusion-08',
    category: 'scripture-allusion',
    week: 14,
    day: 6,
    body: `He must increase, I must decrease. Easy sentence. Terrible year.`,
    refs: [{ osis: 'John.3.30', status: 'suggested' }],
    currentRefs: [],
    defect: 'allusion-undetected',
  },

  // ── J. Reference-dense sermon notes ───────────────────────────────────────
  {
    id: 'scr-dense-01',
    category: 'scripture-dense',
    week: 2,
    day: 5,
    body: `Conference notes, session 2.

Opened in Isaiah 55:1-3. Then Matt 11:28 for the invitation. Cross-referenced John 7:37 and Rev 22:17 — same invitation, both ends of the book.

Came back to Isaiah 55:1-3 at the end, which I thought was well done.`,
    refs: [
      { osis: 'Isa.55.1-Isa.55.3' },
      { osis: 'Matt.11.28' },
      { osis: 'John.7.37' },
      { osis: 'Rev.22.17' },
      { osis: 'Isa.55.1-Isa.55.3' },
    ],
    note: 'The repeat is deliberate — parse.ts emits both; deduping is scan.ts’s job.',
  },
  {
    id: 'scr-dense-02',
    category: 'scripture-dense',
    week: 4,
    day: 6,
    body: `Teaching prep — the "in Christ" thread.

Eph 1:3, Eph 1:7, Eph 1:13. Then 2 Cor 5:17. Then Gal 2:20 to land it. Col 3:3 if there's time.`,
    refs: [
      { osis: 'Eph.1.3' },
      { osis: 'Eph.1.7' },
      { osis: 'Eph.1.13' },
      { osis: '2Cor.5.17' },
      { osis: 'Gal.2.20' },
      { osis: 'Col.3.3' },
    ],
  },
  {
    id: 'scr-dense-03',
    category: 'scripture-dense',
    week: 10,
    day: 6,
    body: `Sunday. He went Ps 130, then Mic 7:18-19, then 1 John 1:9, then back to Ps 130. Depths, pardon, confession, depths. Good shape for a sermon.`,
    refs: [
      { osis: 'Ps.130' },
      { osis: 'Mic.7.18-Mic.7.19' },
      { osis: '1John.1.9' },
      { osis: 'Ps.130' },
    ],
  },
  {
    id: 'scr-dense-04',
    category: 'scripture-dense',
    week: 15,
    day: 6,
    body: `Year-end read-through of the ones I marked: Ps 62:5, Jer 29:11, Prov 3:5-6, Josh 1:9, Isa 41:10, 2 Tim 1:7, Jas 1:5, Heb 4:16.

Reading them in a row is a strange experience. They were all true on different days.`,
    refs: [
      { osis: 'Ps.62.5' },
      { osis: 'Jer.29.11' },
      { osis: 'Prov.3.5-Prov.3.6' },
      { osis: 'Josh.1.9' },
      { osis: 'Isa.41.10' },
      { osis: '2Tim.1.7' },
      { osis: 'Jas.1.5' },
      { osis: 'Heb.4.16' },
    ],
    note: 'FIXED: the year-end list used to lose 2 Tim 1:7 and gain an Isa.41.2 nobody read.',
  },

  // ── J2. Reference lists containing a numbered book ────────────────────────
  {
    id: 'scr-numbered-list-01',
    category: 'scripture-numbered-list',
    week: 3,
    day: 0,
    body: `Two verses for the week: Ps 62:5, 2 Cor 5:17. Wait, and be made new.`,
    refs: [{ osis: 'Ps.62.5' }, { osis: '2Cor.5.17' }],
    note: 'FIXED: 2 Corinthians used to disappear, with a verse of Psalm 62 invented in its place.',
  },
  {
    id: 'scr-numbered-list-02',
    category: 'scripture-numbered-list',
    week: 6,
    day: 6,
    body: `Rom 8:28, 1 John 4:19 — both taped to the monitor now.`,
    refs: [{ osis: 'Rom.8.28' }, { osis: '1John.4.19' }],
    note: 'FIXED, and worse than a loss while it lasted: 1 John was filed under John, lighting the wrong book on the map.',
  },
  {
    id: 'scr-numbered-list-03',
    category: 'scripture-numbered-list',
    week: 9,
    day: 6,
    body: `Read Heb 4:16 and 2 Tim 1:7 together. Approach the throne; not a spirit of fear. Same courage from two directions.`,
    refs: [{ osis: 'Heb.4.16' }, { osis: '2Tim.1.7' }],
    note: 'FIXED: the "and" continuation had the same hole as the comma.',
  },

  // ── K. Clamping — out-of-range values lower confidence, never drop ────────
  {
    id: 'scr-clamp-01',
    category: 'scripture-clamping',
    week: 5,
    day: 1,
    body: `Typed Ps 200:1 into the group chat and got roasted for it. There are 150.`,
    refs: [{ osis: 'Ps.150.1' }],
    note: 'Chapter clamped to the book maximum, confidence 0.5 so review can catch it.',
  },
  {
    id: 'scr-clamp-02',
    category: 'scripture-clamping',
    week: 8,
    day: 5,
    body: `Wrote John 3:16-2 in my notes, which is backwards, but I know what I meant.`,
    refs: [{ osis: 'John.3.16' }],
    note: 'Garbled range — the end is dropped, the start survives at confidence 0.6.',
  },
  {
    id: 'scr-clamp-03',
    category: 'scripture-clamping',
    week: 13,
    day: 1,
    body: `Someone cited Jude 2:5 at me with total confidence. Jude has one chapter.`,
    refs: [{ osis: 'Jude.1.5' }],
    note: 'Single-chapter book, chapter clamped to 1.',
  },
]
