/**
 * Density-tiered mock fixtures.
 *
 * Each comp has a `minHorizon` controlling when it joins the rope:
 *   0 = visible at week · 1 = month · 2 = season · 3 = year · 4 = all time
 *
 * Fixture corpus sizes per horizon:
 *   Week    → 2 visible strands, all threads
 *   Month   → 4 strands, 1 rope
 *   Season  → 6 strands, 2–3 ropes
 *   Year    → 9 strands, 4–5 ropes
 *   All     → 12 strands, richest ropes (5 comps for the main theme)
 *
 * TODO: wire real data — replace with pgvector cluster derivation + insights rows
 */

import type { ThreadComp, Strand, ConnectionCandidate } from './types'

/** Strand storage shape: comps carry minHorizon; weight/breadth/kind are derived. */
export type RawComp = ThreadComp & { minHorizon: number }
export type RawStrand = Omit<Strand, 'weight' | 'breadth' | 'kind'> & { comps: RawComp[] }

export const RAW_STRANDS: RawStrand[] = [
  // ── week (comps with minHorizon 0) ───────────────────────────────────────
  {
    id: 'board',
    label: 'the elder-board tension',
    declared: false,
    comps: [
      {
        id: 'board-ministry',
        lens: 'Ministry',
        span: 'this week',
        matter: 'A hard meeting. Sat with it a few days, then it eased.',
        moments: [
          {
            date: 'Mon',
            prose: 'Left the meeting frustrated. Need to not let it calcify.',
            entryId: 'mock-board-1',
          },
        ],
        minHorizon: 0,
      },
    ],
    span: { from: '2026-05-26', to: '2026-06-02' },
    temperature: 1.0,
  },
  {
    id: 'wait',
    label: 'the waiting is the work',
    declared: false,
    comps: [
      {
        id: 'wait-trading',
        lens: 'Trading discipline',
        span: 'Feb→',
        matter: 'Forced the entry before it confirmed — the patience IS the edge.',
        moments: [
          {
            date: 'Feb 14',
            prose: 'Forced it again. Gave it back. The waiting was the edge.',
            entryId: 'mock-wait-1',
          },
        ],
        minHorizon: 0,
      },
      {
        id: 'wait-prayer',
        lens: 'Prayer',
        span: 'Feb→',
        matter: 'What if the waiting is the work, not the delay before it?',
        moments: [
          {
            date: 'Mar 2',
            prose: "Asking Him to move faster. Maybe the waiting is the thing He's doing.",
            entryId: 'mock-wait-2',
          },
        ],
        minHorizon: 1,
      },
      {
        id: 'wait-family',
        lens: 'Family',
        span: 'Mar→',
        matter: 'It only landed with Eli when I stopped pushing for the landing.',
        moments: [
          {
            date: 'Mar 22',
            prose: 'Tried to force a breakthrough. Stopped pushing. Then it came.',
            entryId: 'mock-wait-3',
          },
        ],
        minHorizon: 2,
      },
      {
        id: 'wait-scripture',
        lens: 'Scripture',
        span: 'May→',
        matter: 'Proverbs 16:9 — the Lord establishes the steps. I keep planning them.',
        moments: [
          {
            date: 'May 2',
            prose: 'Back to 16:9 again. I keep planning the steps.',
            entryId: 'mock-wait-4',
          },
        ],
        minHorizon: 3,
      },
      {
        id: 'wait-health',
        lens: 'Health',
        span: '2021→',
        matter: "Forcing the body doesn't work either — rest is part of the training.",
        moments: [
          {
            date: '2021',
            prose: 'Wired and tired. Rest is training, not a break from it.',
            entryId: 'mock-wait-5',
          },
        ],
        minHorizon: 4,
      },
    ],
    span: { from: '2021-01-01', to: '2026-05-02' },
    temperature: 0.95,
  },

  // ── month (new comps join at minHorizon 1) ───────────────────────────────
  {
    id: 'present',
    label: 'be here, not three steps ahead',
    declared: false,
    comps: [
      {
        id: 'present-family',
        lens: 'Family',
        span: 'Mar→',
        matter: 'Rushing bedtime to get back to the charts. Felt it the moment I did.',
        moments: [
          {
            date: 'Mar 11',
            prose: "Caught myself counting the minutes till they were down.",
            entryId: 'mock-present-1',
          },
        ],
        minHorizon: 1,
      },
    ],
    span: { from: '2026-03-11', to: '2026-03-11' },
    temperature: 0.7,
  },
  {
    id: 'rest',
    label: 'rest is part of the training',
    declared: false,
    comps: [
      {
        id: 'rest-health',
        lens: 'Health',
        span: 'Apr→',
        matter: 'Skipped the walk three days running. Wired and tired both.',
        moments: [
          {
            date: 'Apr 5',
            prose: 'Three days no walk. The body keeps the score.',
            entryId: 'mock-rest-1',
          },
        ],
        minHorizon: 1,
      },
    ],
    span: { from: '2026-04-05', to: '2026-04-05' },
    temperature: 0.75,
  },

  // ── season (new comps join at minHorizon 2) ──────────────────────────────
  {
    id: 'enough',
    label: 'is there enough?',
    declared: false,
    comps: [
      {
        id: 'enough-trading',
        lens: 'Trading',
        span: 'Feb→',
        matter: "The month's numbers don't add up yet. Old knot in the chest.",
        moments: [
          {
            date: 'Feb 3',
            prose: "Are we going to make it this year? The account doesn't lie.",
            entryId: 'mock-enough-1',
          },
        ],
        minHorizon: 0,
      },
      {
        id: 'enough-family',
        lens: 'Family',
        span: 'Mar→',
        matter: 'Esther and I prayed it together — less alone, if not less afraid.',
        moments: [
          {
            date: 'Mar 19',
            prose: 'Prayed about provision together.',
            entryId: 'mock-enough-2',
          },
        ],
        minHorizon: 1,
      },
      {
        id: 'enough-prayer',
        lens: 'Prayer',
        span: 'Feb→',
        matter: 'The provision question and the control question are the same question.',
        moments: [
          {
            date: 'Apr 8',
            prose: "It's not really about money. It's about whether I trust Him to hold us.",
            entryId: 'mock-enough-3',
          },
        ],
        minHorizon: 2,
      },
    ],
    span: { from: '2026-02-03', to: '2026-04-08' },
    temperature: 0.8,
  },
  {
    id: 'builder',
    label: '"you\'ll build, not only tend"',
    declared: true,
    comps: [
      {
        id: 'builder-calling',
        lens: 'Calling',
        span: '2021→',
        matter: 'A word spoken over me. Held it for years, weighing if it was Him.',
        moments: [
          {
            date: '2021',
            prose: "An elder: 'God's making you a builder.' Didn't know what to do with it.",
            entryId: 'mock-builder-1',
          },
        ],
        minHorizon: 2,
      },
      {
        id: 'builder-work',
        lens: 'Work',
        span: '2024→',
        matter: 'Started building Dayspring — the first thing from nothing.',
        moments: [
          {
            date: '2024',
            prose: "Is the word being borne out? The first thing I've built, not stewarded.",
            entryId: 'mock-builder-2',
          },
        ],
        minHorizon: 3,
      },
    ],
    span: { from: '2021-01-01', to: '2026-01-01' },
    temperature: 0.6,
  },

  // ── year (new comps join at minHorizon 3) ────────────────────────────────
  {
    id: 'control',
    label: 'the illusion of control',
    declared: false,
    comps: [
      {
        id: 'control-trading',
        lens: 'Trading',
        span: '2025→',
        matter: "Every system I build is really an attempt to not need faith.",
        moments: [
          {
            date: 'Oct 2025',
            prose: "I'm building another system. Another container for certainty.",
            entryId: 'mock-control-1',
          },
        ],
        minHorizon: 3,
      },
      {
        id: 'control-parenting',
        lens: 'Parenting',
        span: 'Nov 2025→',
        matter: "Can't manage the outcome — only the room I make for him.",
        moments: [
          {
            date: 'Nov 2025',
            prose: "Tried to steer the conversation again. He shut down.",
            entryId: 'mock-control-2',
          },
        ],
        minHorizon: 3,
      },
    ],
    span: { from: '2025-10-01', to: '2026-01-01' },
    temperature: 0.5,
  },
  {
    id: 'identity',
    label: "who am I when I'm not performing",
    declared: false,
    comps: [
      {
        id: 'identity-work',
        lens: 'Work',
        span: '2025→',
        matter: "The app failing didn't change anything about whether I'm loved.",
        moments: [
          {
            date: 'Sep 2025',
            prose: 'Bad week. Kept wanting to tie my worth to the metrics.',
            entryId: 'mock-identity-1',
          },
        ],
        minHorizon: 3,
      },
      {
        id: 'identity-scripture',
        lens: 'Scripture',
        span: '2025→',
        matter: "John 15:5 — abide. Not produce. Not perform. Abide.",
        moments: [
          {
            date: 'Oct 2025',
            prose: "The vine doesn't perform for the vinedresser.",
            entryId: 'mock-identity-2',
          },
        ],
        minHorizon: 3,
      },
    ],
    span: { from: '2025-09-01', to: '2026-01-15' },
    temperature: 0.45,
  },

  // ── all time (new comps join at minHorizon 4) ────────────────────────────
  {
    id: 'suffering',
    label: 'what suffering is for',
    declared: false,
    comps: [
      {
        id: 'suffering-scripture',
        lens: 'Scripture',
        span: '2019→',
        matter: 'Romans 5 — suffering → perseverance → character → hope. I keep meeting it.',
        moments: [
          {
            date: '2019',
            prose: 'First serious trial. Romans 5 was a lifeline.',
            entryId: 'mock-suffering-1',
          },
        ],
        minHorizon: 4,
      },
      {
        id: 'suffering-prayer',
        lens: 'Prayer',
        span: '2020→',
        matter: 'The darkest prayers were the most honest. Something opened.',
        moments: [
          {
            date: '2020',
            prose: "I stopped asking for relief and asked for presence instead.",
            entryId: 'mock-suffering-2',
          },
        ],
        minHorizon: 4,
      },
      {
        id: 'suffering-journal',
        lens: 'Journal',
        span: '2022→',
        matter: 'Writing through the hard thing was the hard thing, and also the help.',
        moments: [
          {
            date: '2022',
            prose: 'The page made it real enough to see, not just feel.',
            entryId: 'mock-suffering-3',
          },
        ],
        minHorizon: 4,
      },
    ],
    span: { from: '2019-01-01', to: '2022-06-01' },
    temperature: 0.3,
  },
  {
    id: 'calling-deferred',
    label: 'the calling that keeps returning',
    declared: true,
    comps: [
      {
        id: 'caldef-word',
        lens: 'Calling',
        span: '2018→',
        matter: '"Equip the body." Three people, different years, same phrase.',
        moments: [
          {
            date: '2018',
            prose: "First time I heard it I dismissed it. It came back.",
            entryId: 'mock-caldef-1',
          },
        ],
        minHorizon: 4,
      },
      {
        id: 'caldef-work',
        lens: 'Work',
        span: '2023→',
        matter: 'Every project that felt alive had a teaching dimension.',
        moments: [
          {
            date: '2023',
            prose: 'The work I dread is the work without formation in it.',
            entryId: 'mock-caldef-2',
          },
        ],
        minHorizon: 4,
      },
    ],
    span: { from: '2018-01-01', to: '2023-09-01' },
    temperature: 0.25,
  },
  {
    id: 'forgiveness',
    label: 'the forgiveness I still carry',
    declared: false,
    comps: [
      {
        id: 'forgive-prayer',
        lens: 'Prayer',
        span: '2017→',
        matter: 'I said I forgave. The body kept a different record.',
        moments: [
          {
            date: '2017',
            prose: 'Prayed it again. Still a knot.',
            entryId: 'mock-forgive-1',
          },
        ],
        minHorizon: 4,
      },
    ],
    span: { from: '2017-01-01', to: '2023-01-01' },
    temperature: 0.2,
  },
]

export const MOCK_CANDIDATES: ConnectionCandidate[] = [
  {
    threadA: 'wait',
    threadB: 'control',
    oneLineReason: 'Both circle around surrendering the outcome — is this the same rope?',
    similarity: 0.82,
  },
  {
    threadA: 'rest',
    threadB: 'present',
    oneLineReason: "You've written about hurrying in both — are they one thread?",
    similarity: 0.74,
  },
]
