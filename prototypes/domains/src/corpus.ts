/**
 * Fictional journal. Not a real person.
 *
 * The domains are Phil's own — personal · faith · frontier · sce · family —
 * because they are the worked example this prototype exists to test. The people
 * in it are invented (Nat, June, Marcus, Tess) and nothing here happened.
 *
 * The domains are NOT declared anywhere in this file. There is no DOMAINS
 * array. Every one of them is derived from a `## heading` line that appears in
 * ENTRIES, because that is the entire claim: a domain exists because someone
 * typed it while writing. OTHER_ENTRIES is a second writer with a completely
 * different set, and it goes through the same derivation, which is how the
 * house scene proves the app supplies no list.
 *
 * Four shapes in here are load-bearing and must not be tidied away:
 *
 *   1. MID-WEEK ENTRIES with no heading at all, and one with a heading dropped
 *      in casually. If every entry were a Saturday sit-down this would be a
 *      demo of a form, not of a journal.
 *   2. A THIN DOMAIN — `sce`, four entries, opened two years late. Every scene
 *      has to stay honest across it.
 *   3. A DOMAIN THAT GOES QUIET AND COMES BACK — `faith` is silent through
 *      2024. The band has to show the gap without a word of copy about it.
 *   4. A DOMAIN STILL QUIET — `personal`, last written May 2025. It sits at the
 *      bottom of the sit-down. Ordering is the only thing that says so.
 */

export type Entry = {
  id: string
  date: string
  /** One thought per paragraph. A paragraph of the form `## x` is a heading. */
  paragraphs: string[]
}

/** The Saturday being written. Everything after it is unwritten. */
export const TODAY = '2026-08-22'

export const ENTRIES: Entry[] = [
  // ── 2022 · he starts using headings ──────────────────────────────────────
  {
    id: 'e-2022-03-19',
    date: '2022-03-19',
    paragraphs: [
      'Trying something. Headings, so I can see what I actually spend a life on.',
      '## family',
      "June said again eleven times tonight and I counted, which tells you where I was.",
    ],
  },
  {
    id: 'e-2022-04-09',
    date: '2022-04-09',
    paragraphs: [
      '## frontier',
      'First Sunday running setup on my own. Broke a stand, learned two names, home at two.',
      '## family',
      'Nat took the morning without being asked. I noticed a day late.',
    ],
  },
  {
    id: 'e-2022-05-07',
    date: '2022-05-07',
    paragraphs: ['## faith', 'Prayed for the first time in months without wanting something.'],
  },
  {
    id: 'e-2022-06-15',
    date: '2022-06-15',
    paragraphs: ['Long day. Nothing to report and I am writing that down on purpose.'],
  },
  {
    id: 'e-2022-08-13',
    date: '2022-08-13',
    paragraphs: [
      '## frontier',
      'Marcus asked why I do this. I gave him the churchy answer and drove home annoyed at myself.',
      'What is the real answer?',
    ],
  },
  {
    id: 'e-2022-09-17',
    date: '2022-09-17',
    paragraphs: ['## personal', 'Forty pounds and a decade of saying next month.'],
  },
  {
    id: 'e-2022-09-24',
    date: '2022-09-24',
    paragraphs: [
      '## family',
      'Nat asked for one evening. One. I had to check a calendar to answer.',
      '## personal',
      'Walked twice. Putting it here so it is not just a story I tell myself.',
    ],
  },
  {
    id: 'e-2022-11-05',
    date: '2022-11-05',
    paragraphs: [
      '## frontier',
      'Team of four now. I still do the parts nobody sees, which I notice I like more than I should.',
    ],
  },
  {
    id: 'e-2022-12-03',
    date: '2022-12-03',
    paragraphs: [
      '## faith',
      'Read the same psalm four days running and it got worse before it got better.',
    ],
  },

  // ── 2023 ─────────────────────────────────────────────────────────────────
  {
    id: 'e-2023-01-14',
    date: '2023-01-14',
    paragraphs: ['## family', 'Read to her twice tonight because I could.'],
  },
  {
    id: 'e-2023-02-25',
    date: '2023-02-25',
    paragraphs: ['## personal', 'Walked every day this week and said nothing about it to anyone.'],
  },
  {
    id: 'e-2023-03-11',
    date: '2023-03-11',
    paragraphs: ['## frontier', 'Am I building this so it runs without me, or so I can leave?'],
  },
  {
    id: 'e-2023-04-15',
    date: '2023-04-15',
    paragraphs: [
      '## faith',
      "Do I actually believe He likes me, or only that He will put up with me?",
    ],
  },
  {
    id: 'e-2023-05-20',
    date: '2023-05-20',
    paragraphs: [
      '## family',
      'Snapped at the table again. Same hour, same tiredness. It is not a mystery.',
    ],
  },
  {
    id: 'e-2023-06-17',
    date: '2023-06-17',
    paragraphs: [
      '## frontier',
      'Handed Marcus the keys and the checklist. Watched him do it worse and better than me.',
    ],
  },
  {
    id: 'e-2023-07-26',
    date: '2023-07-26',
    paragraphs: [
      'Could not sleep. Two in the morning and the house is loud when it is quiet.',
      '## personal',
      'Why do I only take care of myself when something else is on fire?',
    ],
  },
  {
    id: 'e-2023-09-09',
    date: '2023-09-09',
    paragraphs: ['## faith', 'Nothing this week. Wrote it down anyway.'],
  },
  {
    id: 'e-2023-10-21',
    date: '2023-10-21',
    paragraphs: [
      '## frontier',
      'Third Sunday running that setup did not need me. I keep waiting to feel bad about it and it has not come.',
    ],
  },
  {
    id: 'e-2023-11-11',
    date: '2023-11-11',
    paragraphs: ['## family', 'What would it cost me to be home at six?'],
  },

  // ── 2024 · faith goes quiet · sce opens ──────────────────────────────────
  {
    id: 'e-2024-01-06',
    date: '2024-01-06',
    paragraphs: [
      '## faith',
      'Went through the motions all month. I would rather record that than dress it up.',
    ],
  },
  {
    id: 'e-2024-02-10',
    date: '2024-02-10',
    paragraphs: ['## frontier', 'What am I actually for here now?'],
  },
  {
    id: 'e-2024-03-16',
    date: '2024-03-16',
    paragraphs: [
      '## family',
      'Home at six for nine days straight. Nobody said anything. That is how I know it was overdue.',
    ],
  },
  {
    id: 'e-2024-05-04',
    date: '2024-05-04',
    paragraphs: ['## personal', 'Down to one coffee. Sleeping. The whole thing is boring and it works.'],
  },
  {
    id: 'e-2024-06-08',
    date: '2024-06-08',
    paragraphs: [
      '## sce',
      'Signed with Tess. Two years of saying yes to work I did not want, and this is the first no that paid.',
    ],
  },
  {
    id: 'e-2024-07-13',
    date: '2024-07-13',
    paragraphs: [
      '## frontier',
      'Told them I would stop taking the six a.m. slot. Said it out loud so I could not take it back.',
    ],
  },
  {
    id: 'e-2024-10-05',
    date: '2024-10-05',
    paragraphs: [
      '## family',
      'June is eight and has started closing her door. Wrote it down so I would have the date.',
    ],
  },
  {
    id: 'e-2024-11-16',
    date: '2024-11-16',
    paragraphs: ['## sce', 'The number was fine. I felt nothing. That is the part worth writing down.'],
  },

  // ── 2025 · faith comes back · personal goes quiet ────────────────────────
  {
    id: 'e-2025-01-18',
    date: '2025-01-18',
    paragraphs: [
      '## frontier',
      'Two years since I touched a cable. The room is fuller and nobody thanks me for it, which is the point.',
    ],
  },
  {
    id: 'e-2025-02-15',
    date: '2025-02-15',
    paragraphs: ['## faith', 'Back. No event, no crisis. Just back.'],
  },
  {
    id: 'e-2025-04-26',
    date: '2025-04-26',
    paragraphs: [
      '## family',
      'Nat said I am easier to be around. I did not ask what changed. I know what changed.',
    ],
  },
  {
    id: 'e-2025-05-17',
    date: '2025-05-17',
    paragraphs: ['## personal', 'Stopped. Started. Stopped. Writing it down so the pattern is in ink.'],
  },
  {
    id: 'e-2025-07-12',
    date: '2025-07-12',
    paragraphs: ['## sce', 'Is this a business or an escape hatch?'],
  },
  {
    id: 'e-2025-08-30',
    date: '2025-08-30',
    paragraphs: ['## faith', 'The thing I was afraid to ask for, I asked for.'],
  },
  {
    id: 'e-2025-09-06',
    date: '2025-09-06',
    paragraphs: ['## frontier', 'Is the thing I built still the thing I would build?'],
  },
  {
    id: 'e-2025-11-19',
    date: '2025-11-19',
    paragraphs: ['Tired. That is the entry.'],
  },
  {
    id: 'e-2025-12-13',
    date: '2025-12-13',
    paragraphs: ['## family', 'Snapped at the table again. Different hour this time.'],
  },

  // ── 2026 ─────────────────────────────────────────────────────────────────
  {
    id: 'e-2026-03-07',
    date: '2026-03-07',
    paragraphs: ['## faith', 'He likes me. Wrote it plainly so I would have to look at it.'],
  },
  {
    id: 'e-2026-04-11',
    date: '2026-04-11',
    paragraphs: [
      '## frontier',
      'Marcus runs it. I sit in the back and hand out bulletins like a stranger.',
    ],
  },
  {
    id: 'e-2026-05-09',
    date: '2026-05-09',
    paragraphs: [
      '## sce',
      'Tess wants to raise. I want to stay small. One of us is going to be disappointed.',
    ],
  },
  {
    id: 'e-2026-06-20',
    date: '2026-06-20',
    paragraphs: ['## family', 'Read to her twice tonight because she asked, which is new.'],
  },

  // ── today · the entry being written ──────────────────────────────────────
  {
    id: 'e-2026-08-22',
    date: TODAY,
    paragraphs: [
      '## frontier',
      'Sat in the back again and not once wanted the headset back.',
      '## family',
      "June wanted to know what I was writing. Told her. She said that is boring and stayed anyway.",
      '## faith',
      'Quiet week. Not an empty one.',
    ],
  },
]

/**
 * A second writer, so the house scene can show that none of this is a list we
 * ship. Different life, different words, same derivation.
 */
export const OTHER_ENTRIES: Entry[] = [
  {
    id: 'o-2023-02-05',
    date: '2023-02-05',
    paragraphs: ['## mom', 'She asked about the house again.'],
  },
  {
    id: 'o-2023-03-18',
    date: '2023-03-18',
    paragraphs: ['## the shop', 'Sold the lathe. Kept the bench.'],
  },
  { id: 'o-2023-06-24', date: '2023-06-24', paragraphs: ['## recovery', 'Ninety days.'] },
  {
    id: 'o-2023-09-02',
    date: '2023-09-02',
    paragraphs: ['## sundays', 'Sat in the back on purpose. Still counted.'],
  },
  {
    id: 'o-2023-11-11',
    date: '2023-11-11',
    paragraphs: ['## mom', 'Same conversation, different week.'],
  },
  { id: 'o-2024-01-20', date: '2024-01-20', paragraphs: ['## recovery', 'A year.'] },
  {
    id: 'o-2024-04-06',
    date: '2024-04-06',
    paragraphs: ['## the shop', 'Two orders. Both from strangers.'],
  },
  {
    id: 'o-2024-08-17',
    date: '2024-08-17',
    paragraphs: ['## mom', 'I am not going to get a different mother than the one I have.'],
  },
  {
    id: 'o-2025-01-11',
    date: '2025-01-11',
    paragraphs: ['## sundays', 'Went early to help. Nobody asked me to.'],
  },
  {
    id: 'o-2025-06-14',
    date: '2025-06-14',
    paragraphs: ['## recovery', 'Two years, and it is boring now, which is the whole prize.'],
  },
  { id: 'o-2026-02-21', date: '2026-02-21', paragraphs: ['## the shop', 'Bench is full.'] },
]
