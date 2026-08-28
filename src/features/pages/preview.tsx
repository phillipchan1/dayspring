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
 *   ?__preview=pages              → the surface, in a 390×844 frame
 *   ?__preview=pages&part=sheet   → `look for`, open, with fixture options
 *   ?__preview=pages&frame=0      → no frame; the window IS the viewport
 *   ?__preview=pages&theme=ink    → any palette; defaults to dawn
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

/** A fixture archive: three years of pages, newest first, stable across reloads. */
const ENTRIES: Entry[] = Array.from({ length: 48 }, (_, i) => {
  const created = new Date(Date.UTC(2026, 7, 24) - i * 9 * DAY).toISOString()
  const body = [
    PARAS[i % PARAS.length],
    PARAS[(i + 2) % PARAS.length],
    i % 3 === 0 ? PARAS[(i + 4) % PARAS.length] : '',
  ]
    .filter(Boolean)
    .join('\n\n')
  return {
    id: `preview-${i}`,
    created_at: created,
    updated_at: created,
    body_markdown: body,
    title: null,
    mood: null,
    tags: [],
    word_count: body.split(/\s+/).length,
    source: 'native',
    external_id: null,
  } as Entry
})

const KEPT: KeptSubject[] = [
  { key: 'c:tiffany', label: 'Tiffany', terms: ['Tiffany'], kind: 'person', keptAt: '2026-01-01T00:00:00.000Z' },
  { key: 'c:naomi', label: 'Naomi', terms: ['Naomi'], kind: 'person', keptAt: '2026-01-02T00:00:00.000Z' },
]

const OFFERED: Subject[] = [
  { key: 'c:marcus', label: 'Marcus', terms: ['Marcus'], kind: 'person' },
  { key: 'c:romans', label: 'Romans', terms: ['Romans'], kind: 'term' },
  { key: 'c:thursday', label: 'Thursday', terms: ['Thursday'], kind: 'term' },
  { key: 'c:dad', label: 'Dad', terms: ['Dad'], kind: 'person' },
]

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

function SheetPreview() {
  const [zoom, setZoom] = useState(0)
  const [keys, setKeys] = useState<string[]>(['c:tiffany'])
  const chips = [...KEPT, ...OFFERED]
    .filter((s) => keys.includes(s.key))
    .map((s) => ({ key: s.key, label: s.label, kind: 'subject' as const }))

  return (
    <div className="pg" style={{ height: '100dvh' }}>
      <div className="pg__head-wrap">
        <div className="pg__inner pg__inner--head">
          <LookFor
            kept={KEPT}
            offered={OFFERED}
            index={SHEET_INDEX}
            markings={MARKINGS}
            zoom={zoom}
            onZoom={setZoom}
            narrow
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
          />
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

  if (params.get('frame') !== '0') {
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
  createRoot(el).render(params.get('part') === 'sheet' ? <SheetPreview /> : <SurfacePreview />)
}
