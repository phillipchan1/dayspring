/**
 * `?__preview=threads` — the walked-practices surface, without a session.
 *
 * The library and the composer both live behind OAuth, so the only way to see
 * this while building it is a harness. It renders the real `RitualThreads`
 * against fixture ENTRIES rather than fixture threads, on purpose: the parse is
 * the part most likely to be wrong, so a harness that skipped it would verify
 * the half that cannot break.
 *
 * DEV-only — `import.meta.env.DEV` in main.tsx dead-code-eliminates the whole
 * block in a production build.
 */
import { createRoot } from 'react-dom/client'
import type { Entry } from '@/lib/types'
import { RitualThreads } from './RitualThreads'
import '@/styles/themes.css'
import '@/editor/practices/PracticeLibrary.css'

function entry(id: string, at: string, body: string): Entry {
  return {
    id,
    created_at: at,
    updated_at: at,
    body_markdown: body,
    title: null,
    mood: null,
    tags: [],
    word_count: 0,
    source: 'native',
    external_id: null,
  } as Entry
}

/** Written the way `buildPracticeBlock` writes it, tokens and all. */
function block(name: string, movements: [string, string][]): string {
  const out = [`<!-- ritual:name:${name} -->`]
  for (const [label, text] of movements) {
    out.push(`<!-- ritual:section:${label} -->`)
    out.push(text)
  }
  return out.join('\n')
}

const OFFERING: [string, string, string, string][] = [
  [
    '2026-09-12T06:11:00Z',
    "Q3 numbers. The thing I said to Dan on Tuesday that I keep replaying. Mum's scan results, which are Thursday. Car is making the noise again.",
    'Being actually present at lunch with Mum before Thursday. Not rehearsing Thursday during it.',
    'The lunch. Take it and make me present in it.',
  ],
  [
    '2026-09-05T06:34:00Z',
    "School run, standing meeting, the budget thing. Mum's appointment moved again.",
    'Not opening the laptop until after breakfast. That is the whole thing today.',
    'The first hour.',
  ],
  [
    '2026-08-29T06:02:00Z',
    'Tired. Not much in the tank. Ella starts Tuesday and I am already thinking about the review on Wednesday instead.',
    "Ella. Tuesday is hers, not Wednesday's.",
    'Tuesday. Hers and yours, not mine.',
  ],
  [
    '2026-08-08T06:40:00Z',
    "Deadline. Deadline. The conversation with Dan I'm still not having.",
    'Talking to Dan. Not preparing to talk to Dan.',
    'The conversation. And my need to come out of it looking reasonable.',
  ],
  [
    '2025-12-14T06:20:00Z',
    'First go at this. Feels odd writing a list to God.',
    'I genuinely do not know. Starting, maybe.',
    'The hum I cannot name.',
  ],
]

const ENTRIES: Entry[] = [
  ...OFFERING.map(([at, everything, matters, offering], i) =>
    entry(
      `mo-${i}`,
      at,
      block('The Morning Offering', [
        ['Everything', everything],
        ['What matters', matters],
        // Left blank on the most recent walk — the surface must drop it, not
        // render an empty row.
        ['Not yours', i === 0 ? '' : 'Whatever is not mine today.'],
        ['Offering', offering],
      ]),
    ),
  ),
  entry(
    'de-1',
    '2026-09-09T22:05:00Z',
    block('The Daily Examen', [
      ['Gratitude', 'Ella laughing at something genuinely funny she said herself.'],
      ['Awareness', 'Most alive on the floor with Ella. Most distant at 3pm refreshing my inbox.'],
      ['Prayer', 'Patience at 7.40am. Same as always.'],
    ]),
  ),
  entry(
    'de-2',
    '2026-07-14T22:12:00Z',
    block('The Daily Examen', [
      ['Gratitude', "Mum rang me, which she hasn't done first in a long time."],
      ['Prayer', 'Time with Mum that I am actually in.'],
    ]),
  ),
  // A retired practice: still readable, so an old page never loses its question.
  entry(
    'eh-1',
    '2026-06-02T21:00:00Z',
    block('Emotionally Healthy Examen', [['Feel', 'Flat, mostly. Which is its own answer.']]),
  ),
  // An ordinary page, to prove the cheap reject works.
  entry('plain', '2026-05-01T09:00:00Z', 'Just a page with no ritual on it at all.'),
]

export function renderRitualThreadsPreview(): void {
  const host = document.getElementById('root')
  if (!host) return
  const params = new URLSearchParams(window.location.search)
  document.documentElement.dataset.theme = params.get('theme') ?? 'dawn'
  // ?empty=1 — a journal that has never walked a ritual. Worth being able to
  // see: Principle 5 says tell the truth about a surface that needs history.
  const entries = params.get('empty') === '1' ? [] : ENTRIES
  createRoot(host).render(
    <RitualThreads
      entries={entries}
      onClose={() => console.log('[preview] close')}
      onOpenEntry={(id) => console.log('[preview] open entry', id)}
    />,
  )
}
