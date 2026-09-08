import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { DEFAULT_SETTINGS, type Settings } from '@/lib/settings'
import { THEMES, type ThemeId } from '@/lib/resolveTheme'
import type { Entry } from '@/lib/types'
import { PagesView } from './PagesView'
import { LookFor } from './LookFor'
import { buildSubjectIndex, type Subject } from './subjects'
import type { KeptSubject } from './keptSubjects'
import { MARK_KIND } from '@/lib/markKinds'
import type { MarkingChip } from './facets'

/**
 * Dev-only: `?__preview=pages` mounts the read surface with a fixture archive,
 * inside a phone-sized frame, so the mobile treatment can be looked at without
 * an account.
 *
 *   ?__preview=pages                  → the surface, in a 390×844 frame
 *   ?__preview=pages&part=sheet       → `look for`, open, with fixture options
 *   ?__preview=pages&part=sheet&wide=1 → the same sheet as a desktop DROPDOWN
 *   ?__preview=pages&part=sheet&bracket=1 → the sheet with an ERA bracketed
 *   ?__preview=pages&frame=0          → no frame; the window IS the viewport
 *   ?__preview=pages&theme=ink        → any palette; defaults to dawn
 *
 * The frame is an `<iframe>` rather than a fixed-size box on purpose: media
 * queries answer to the viewport, and an iframe has its own. A 390px box in a
 * 1400px window would render the surface at its desktop breakpoint and prove
 * nothing about a phone.
 *
 * Everything the surface fetches (the concordance, kept subjects, markings,
 * anniversary senses) needs an account and fails silently by design, so the
 * subject pills are empty here — `part=sheet` is what to look at for those.
 */

const DAY = 24 * 60 * 60 * 1000

const PARAS = [
  'Down to the water while it was still dark. Just the sound of it, and the cold coming up off the stones.',
  'Tiffany called on the way back and we talked the whole way home about nothing in particular, which was the point.',
  'Sat the twenty minutes anyway. Nothing came, and I am learning not to read that as a verdict.',
  'Naomi asked me at dinner whether I was worried, and I said no before I had checked whether it was true.',
  'The long way home is not a detour. Write that down again next week when it stops being obvious.',
  'Rain all afternoon. Read the same page of Romans four times and then gave up and made soup.',
]

function page(id: string, iso: string, body: string): Entry {
  return {
    id,
    created_at: iso,
    updated_at: iso,
    body_markdown: body,
    title: null,
    mood: null,
    tags: [],
    word_count: body.split(/\s+/).length,
    source: 'native',
    external_id: null,
  } as Entry
}

/**
 * A fixture archive: recent pages plus a few from fifteen years earlier on the
 * same calendar week, so the phone list shows an anniversary echo the way a
 * real import does — and so the row's year + eyebrow can be looked at without
 * an account.
 */
const RECENT: Entry[] = Array.from({ length: 48 }, (_, i) => {
  const created = new Date(Date.UTC(2026, 7, 30) - i * 2 * DAY).toISOString()
  const body = [
    PARAS[i % PARAS.length],
    PARAS[(i + 2) % PARAS.length],
    i % 3 === 0 ? PARAS[(i + 4) % PARAS.length] : '',
  ]
    .filter(Boolean)
    .join('\n\n')
  return page(`preview-${i}`, created, body)
})

/** Same week of August, 2011 — dense enough to earn an echo beside today. */
const ECHO_YEAR: Entry[] = [27, 28, 29, 30, 31].map((day) =>
  page(
    `preview-2011-${day}`,
    new Date(Date.UTC(2011, 7, day, 12)).toISOString(),
    'back home now. really struggling already. Lord Jesus, release a grace for me to be preserved here.',
  ),
)

const ENTRIES: Entry[] = [...RECENT, ...ECHO_YEAR].sort(
  (a, b) => (a.created_at > b.created_at ? -1 : a.created_at < b.created_at ? 1 : 0),
)

/*
 * Kept — what the writer answered. Never amber, whichever list it sits in.
 *
 * `word:soup` has neither a Concordance kind nor a `section` (the box it was
 * typed into on the Life Map), which is exactly the shape of a row kept before
 * that column existed. It must still land somewhere: Matters.
 */
const KEPT: KeptSubject[] = [
  { key: 'c:tiffany', label: 'Tiffany', terms: ['Tiffany'], kind: 'person', keptAt: '2026-01-01T00:00:00.000Z' },
  { key: 'c:naomi', label: 'Naomi', terms: ['Naomi'], kind: 'person', keptAt: '2026-01-02T00:00:00.000Z' },
  { key: 'word:soup', label: 'soup', terms: ['soup'], kind: 'word', keptAt: '2026-01-03T00:00:00.000Z' },
]

/*
 * Offered — what the journal noticed and nobody has answered. Amber, and spread
 * across all four Life Map lists on purpose: the whole point of the grouping is
 * that it has a shape, and a fixture with only people in it would prove nothing.
 *
 * `occurrences` is the Concordance's own stored count, which is what the floor
 * reads. `stones` sits below the fixture's floor of 3, so it should be absent
 * until you type it — which is the floor's overrule, and worth being able to see.
 */
const NOW = { firstSeen: '2026-06-01T00:00:00.000Z', lastSeen: '2026-08-30T00:00:00.000Z' }
const THEN = { firstSeen: '2011-08-27T00:00:00.000Z', lastSeen: '2011-08-31T00:00:00.000Z' }

const OFFERED: Subject[] = [
  { key: 'c:marcus', label: 'Marcus', terms: ['Marcus'], kind: 'person', occurrences: 18, ...NOW },
  { key: 'c:dad', label: 'Dad', terms: ['Dad'], kind: 'person', occurrences: 9, ...NOW },
  { key: 'c:water', label: 'the water', terms: ['the water'], kind: 'place', occurrences: 24, ...NOW },
  { key: 'c:frontier', label: 'Frontier', terms: ['Frontier'], kind: 'org', occurrences: 7, ...NOW },
  { key: 'c:romans', label: 'Romans', terms: ['Romans'], kind: 'term', occurrences: 12, ...NOW },
  { key: 'c:thursday', label: 'Thursday', terms: ['Thursday'], kind: 'term', occurrences: 5, ...NOW },
  { key: 'c:stones', label: 'stones', terms: ['stones'], kind: 'term', occurrences: 2, ...NOW },
  // The 2011 side of the fixture's fifteen-year silence, so `bracket=1` has
  // something to find and the rest has something to lose.
  { key: 'c:grace', label: 'grace', terms: ['grace'], kind: 'term', occurrences: 5, ...THEN },
  { key: 'c:home', label: 'home', terms: ['home'], kind: 'place', occurrences: 4, ...THEN },
]

/** The older of the fixture's two eras — what pressing its chip brackets. */
const BRACKET = { start: '2011-08-01T00:00:00.000Z', end: '2011-09-01T00:00:00.000Z' }

const MARKINGS: MarkingChip[] = (['gift', 'prayer', 'scripture', 'sense', 'learned'] as const).map(
  (kind, i) => ({
    key: `m:${kind}`,
    kind,
    label: MARK_KIND[kind].label,
    tone: MARK_KIND[kind].tone,
    count: [12, 34, 8, 21, 3][i] ?? 1,
  }),
)

function SurfacePreview() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [subjectKey, setSubjectKey] = useState<string | null>(null)
  const [spreadId, setSpreadId] = useState<string | null>(null)

  return (
    <div className="app-shell" style={{ flexDirection: 'column', height: '100dvh' }}>
      <div className="journal-canvas journal-canvas--reflections" style={{ flex: 1, minHeight: 0 }}>
        <div className="journal-canvas__content" style={{ padding: 0, overflow: 'hidden' }}>
          <PagesView
            entries={ENTRIES}
            marks={[]}
            ready
            activeId={null}
            subjectKey={subjectKey}
            onSubject={setSubjectKey}
            asked={null}
            onClearAsked={() => {}}
            spreadId={spreadId}
            onSpread={setSpreadId}
            onOpenEntry={() => window.alert('This is where the editor would open.')}
            onEntryMenuAction={() => {}}
            onDeleteEntries={() => {}}
            settings={settings}
            updateSettings={(patch) => setSettings((s) => ({ ...s, ...patch }))}
          />
        </div>
      </div>

      {/* The chrome the surface has to live with: the tab bar, and the accent
          disc the `look for` pill sits opposite. Copies, not the real
          components — only their geometry matters here. */}
      <button className="mobile-fab" aria-label="New entry">
        +
      </button>
      <nav className="mobile-bar mobile-bar--tabs" aria-label="Primary">
        {['Journal', 'Ascent', 'Lamp', 'Settings'].map((label) => (
          <button key={label} type="button" className="mobile-tab" data-active={label === 'Journal' ? 'true' : undefined}>
            <span className="mobile-tab__glyph">◦</span>
            <span className="mobile-tab__label">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

/** The fixture archive, indexed — what gives the sheet's pills their counts. */
const SHEET_INDEX = buildSubjectIndex(ENTRIES)

/** The same, over one era only — what a bracket hands the sheet. */
const BRACKET_INDEX = buildSubjectIndex(
  ENTRIES.filter((e) => e.created_at >= BRACKET.start && e.created_at < BRACKET.end),
)

/**
 * `wide` is not cosmetic. The dropdown and the bottom sheet lay the four Life
 * Map lists out differently — two-up against stacked — and the grouping is the
 * thing being looked at, so both need to be reachable without a phone.
 */
function SheetPreview({ wide, bracket }: { wide: boolean; bracket: boolean }) {
  const [zoom, setZoom] = useState(0)
  const [keys, setKeys] = useState<string[]>(['c:tiffany'])
  const chips = [...KEPT, ...OFFERED]
    .filter((s) => keys.includes(s.key))
    .map((s) => ({ key: s.key, label: s.label, kind: 'subject' as const }))

  return (
    <div className="pg" style={{ height: '100dvh' }}>
      <div className="pg__head-wrap">
        <div className="pg__inner pg__inner--head">
          <div className="pg__head-tools">
          <LookFor
            kept={KEPT}
            offered={OFFERED}
            index={bracket ? BRACKET_INDEX : SHEET_INDEX}
            // The fixture archive is 53 pages, so `floorFor` lands on its
            // minimum of 3 either way — which is the young-journal case, and the
            // one where a floor has to be careful not to empty the sheet.
            floor={3}
            window={bracket ? BRACKET : null}
            markings={MARKINGS}
            zoom={zoom}
            onZoom={setZoom}
            narrow={!wide}
            standLabel="30 a screen"
            reading="order"
            onReading={() => {}}
            chips={chips}
            onToggleSubject={(s) => setKeys((k) => [...k, s.key])}
            onToggleMarking={(key) =>
              setKeys((k) => (k.includes(key) ? k.filter((x) => x !== key) : [...k, key]))
            }
            onRemove={(key) => setKeys((k) => k.filter((x) => x !== key))}
            onClear={() => setKeys([])}
            onSomewhere={() => {}}
            onKeep={() => {}}
            onDrop={() => {}}
            onlyLit={false}
            onOnlyLit={() => {}}
            onTend={() => window.alert('This is where the Life Map would open.')}
          />
          </div>
        </div>
      </div>
    </div>
  )
}

/** The phone, so the surface inside it is laid out for a phone's viewport. */
function frame(src: string): void {
  document.body.style.cssText =
    'margin:0;min-height:100vh;display:grid;place-items:center;background:#111;'
  const el = document.getElementById('root')
  if (!el) return
  el.innerHTML = ''
  const iframe = document.createElement('iframe')
  iframe.src = src
  iframe.style.cssText =
    'width:390px;height:844px;border:1px solid #333;border-radius:34px;background:#000;'
  el.appendChild(iframe)
}

function isThemeId(value: string | null): value is ThemeId {
  return THEMES.some((t) => t.id === value)
}

export function renderPagesPreview(): void {
  const params = new URLSearchParams(window.location.search)

  if (params.get('frame') !== '0' && params.get('wide') !== '1') {
    const inner = new URLSearchParams(params)
    inner.set('frame', '0')
    frame(`${window.location.pathname}?${inner.toString()}`)
    return
  }

  const wanted = params.get('theme')
  const theme: ThemeId = isThemeId(wanted) ? wanted : 'dawn'
  const family = THEMES.find((t) => t.id === theme)?.family ?? 'light'
  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  root.setAttribute('data-appearance', family)
  root.style.colorScheme = family
  document.body.style.margin = '0'
  document.body.style.background = 'var(--bg)'

  const el = document.getElementById('root')
  if (!el) throw new Error('Root element #root not found')
  createRoot(el).render(
    params.get('part') === 'sheet' ? (
      <SheetPreview wide={params.get('wide') === '1'} bracket={params.get('bracket') === '1'} />
    ) : (
      <SurfacePreview />
    ),
  )
}
