// Ordinary prose — the false-positive control.
//
// Most of what people write in a journal is not about God, and Dayspring's
// restraint is a feature, not a gap. Every entry here must yield NOTHING on
// every axis: no scripture ref, no prayer, no Concordance entity, no subject.
//
// These are also the tripwires — every entry is seeded with a book-name-plus-
// digit pair that ordinary English produces by accident:
//
//     "am 3 chapters in"      → Amos 3
//     "it is 2 degrees"       → Isaiah 2
//     "that job 2 years ago"  → Job 2
//     "missed the mark 3"     → Mark 3
//     "the song 2 minutes in" → Song of Solomon 2
//
// This file has already done its job once. parse.ts used to admit a match only
// when the book name was capitalized, a blunt rule that cost every lowercase
// journal its entire scripture history. Rewriting it (see admits() in parse.ts)
// was only attemptable because these twelve entries could prove the rewrite
// didn't leak: deleting the old guard lit up all five pairs above, by entry id.
//
// So keep them. Anyone touching admission needs a way to find out whether they
// got away with it. Deliberately free of proper nouns so `entities: []` is
// honest.

import type { CorpusEntry } from './types'

export const ORDINARY_ENTRIES: CorpusEntry[] = [
  {
    id: 'ord-weather-01',
    category: 'ordinary',
    week: 0,
    day: 4,
    body: `Cold snap. Woke up and it is 2 degrees out there and the boiler picked today of all days to make the noise again.

Wore the good coat. Regretted nothing.`,
    yieldsNothing: true,
  },
  {
    id: 'ord-reading-01',
    category: 'ordinary',
    week: 1,
    day: 4,
    body: `Am I enjoying this novel? Unclear. I am 3 chapters in and I still couldn't tell you what anyone wants.

Giving it fifty more pages.`,
    yieldsNothing: true,
  },
  {
    id: 'ord-work-01',
    category: 'ordinary',
    week: 2,
    day: 3,
    body: `Left that job 2 years ago this week and I still dream about the building. Not the people. The building.`,
    yieldsNothing: true,
  },
  {
    id: 'ord-darts-01',
    category: 'ordinary',
    week: 3,
    day: 2,
    body: `Darts at the pub. Missed the mark 3 times in a row on double sixteen and then hit it when nobody was watching.`,
    yieldsNothing: true,
  },
  {
    id: 'ord-music-01',
    category: 'ordinary',
    week: 4,
    day: 6,
    body: `The song 2 minutes in does the key change thing and I have listened to that eight-second stretch about forty times today.`,
    yieldsNothing: true,
  },
  {
    id: 'ord-recipe-01',
    category: 'ordinary',
    week: 5,
    day: 5,
    body: `Ragu, take four.

Two onions, not one. Brown the mince properly — actually brown, not grey. Splash of milk at the end, which sounds wrong and isn't.

Three hours. Worth it. Wrote it down this time.`,
    yieldsNothing: true,
  },
  {
    id: 'ord-todo-01',
    category: 'ordinary',
    week: 6,
    day: 2,
    body: `- ring the dentist
- gutters
- return the drill
- book the car in
- the thing with the tax letter that I keep moving to the next day

That last one has been on this list since October.`,
    yieldsNothing: true,
  },
  {
    id: 'ord-film-01',
    category: 'ordinary',
    week: 8,
    day: 6,
    body: `Watched the submarine one everyone talks about. First hour, excellent. Second hour, they explain everything and it dies.

Is it me or does every film now have twenty minutes of explaining at the end?`,
    yieldsNothing: true,
  },
  {
    id: 'ord-dream-01',
    category: 'ordinary',
    week: 10,
    day: 6,
    body: `Odd dream. The house had a room we'd never opened and inside it was just more house. Not frightening. Slightly rude.`,
    yieldsNothing: true,
  },
  {
    id: 'ord-car-01',
    category: 'ordinary',
    week: 12,
    day: 4,
    body: `Garage rang. It's the wishbone, it's four hundred quid, and it was always going to be four hundred quid.

Paid it. Drove home. It drives better.`,
    yieldsNothing: true,
  },
  {
    id: 'ord-shopping-01',
    category: 'ordinary',
    week: 13,
    day: 5,
    body: `Big shop. Forgot the one thing I went for, came back with olives we do not need and a bread I have never bought before.

Job interview clothes still need taking in. Booked that for Thursday.`,
    yieldsNothing: true,
  },
  // A reading verb sitting next to an ordinary word that happens to be a book.
  // These were the counter-examples that killed the "nearby reading verb is
  // enough" version of admits() — every one of them parsed as scripture under
  // it. They stay so nobody rebuilds that rule from scratch.
  {
    id: 'ord-reading-verb-01',
    category: 'ordinary',
    week: 9,
    day: 4,
    body: `Spent the morning reading Mark 5 emails from the same person about the same thing, and answering none of them.`,
    yieldsNothing: true,
  },
  {
    id: 'ord-reading-verb-02',
    category: 'ordinary',
    week: 11,
    day: 4,
    body: `Finished reading the job 2 applications I owed them. Both fine. Neither exciting.`,
    yieldsNothing: true,
  },
  {
    id: 'ord-reading-verb-03',
    category: 'ordinary',
    week: 14,
    day: 3,
    body: `Read the chapter on compensation 5 times before it sank in, and I still had to ask.`,
    yieldsNothing: true,
  },
  {
    id: 'ord-admin-01',
    category: 'ordinary',
    week: 15,
    day: 5,
    body: `Two hours on hold, then cut off, then two more hours, then a very nice man sorted it in four minutes.

Re: the parking fine — appealed. We'll see.`,
    yieldsNothing: true,
  },
]
