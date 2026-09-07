import { createRoot } from 'react-dom/client'
import { Editor } from './Editor'
import { THEMES, type ThemeId } from '@/lib/resolveTheme'
import { useEffect, useRef, useState } from 'react'
import { PRACTICES } from './practices/practicesData'
import { PracticeLibrary } from './practices/PracticeLibrary'
import { RitualComposer } from './practices/RitualComposer'
import { PracticeAboutSheet } from './practices/PracticeAboutSheet'
import { PRACTICE_BY_NAME, type Practice } from './practices/practicesData'
import { EDITOR_FONT_VARS, type EditorFont } from '@/lib/settings'
import {
  buildPracticeBlock,
  describeRitualLanding,
} from './practices/usePracticeInsertion'

/**
 * Dev-only: `?__preview=ritual` mounts the real editor with a ritual begun
 * partway down a page that already has writing on it — the case the pacing and
 * the hold exist for. Optional `&theme=vigil` etc. to check every palette, and
 * `&answered=2` to start with the first N movements already written, which is
 * how a ritual looks when you come back to it the next day.
 *
 * `&library=1` opens the Rituals library over it as it appears when reached from
 * inside an entry that already has writing — the filter on Need-based, and the
 * threshold naming where the ritual will land.
 *
 * `&composer=1` opens the ritual composer on that block. `&font=mono&size=36`
 * drive the writer's face and size exactly as Settings does, which is how the
 * font/theme matrix gets checked: the app's own voice must hold its shape in
 * every one of the six faces, including the two that ship only 400 and 700.
 */

const ABOVE = `Morning, still dark out.

Slept badly again — the same 3am waking, the same list of things I cannot do
anything about until the office opens. I keep meaning to write about it properly
and keep not doing it.
`

const BELOW = `
Coffee's cold. Going to sit with that last one a while longer before I go.
`

const ANSWERS = [
  'The long walk after dinner, and that the rain held off for it.',
  'Most alive on the walk. Most distant reading email at 9pm, which I knew better than to open.',
  'I was short with Hannah when she asked how the day went. She was being kind and I made her pay for my mood.',
  'Patience for the first hour. That is where I keep losing it.',
]

function isThemeId(value: string | null): value is ThemeId {
  return THEMES.some((t) => t.id === value)
}

/**
 * Live visual-viewport numbers, on top of everything.
 *
 * `?__preview=ritual&composer=1&debug=1`. The composer's position on iOS is
 * decided entirely by these three, and no amount of reasoning from a desktop
 * browser substitutes for reading them off the device that is misbehaving.
 *
 * Also `console.warn`s every reading (tagged `[vvlog]`) — Vite's dev overlay
 * forwards `warn`/`error` (not `log`) from the webview to the terminal that
 * ran `tauri ios dev` / `npm run dev`, which is a more reliable trace than
 * polling screenshots. This is how the keyboard-open swipe bug was actually
 * caught: `window.innerHeight` dropping out from under an unchanged
 * `visualViewport.height` right as Embla's `select` handler re-focused the
 * next pane's `<textarea>` — iOS re-running its scroll-into-view for a
 * newly-focused element even though it was already on screen. Fixed in
 * `RitualComposer.tsx` by focusing with `{ preventScroll: true }`.
 */
function ViewportReadout() {
  const [n, setN] = useState({ offsetTop: 0, vvHeight: 0, innerHeight: 0 })
  useEffect(() => {
    const vv = window.visualViewport
    const read = () => {
      const next = {
        offsetTop: Math.round(vv?.offsetTop ?? -1),
        vvHeight: Math.round(vv?.height ?? -1),
        innerHeight: Math.round(window.innerHeight),
      }
      console.warn('[vvlog]', JSON.stringify(next), Date.now())
      setN(next)
    }
    read()
    vv?.addEventListener('resize', read)
    vv?.addEventListener('scroll', read)
    return () => {
      vv?.removeEventListener('resize', read)
      vv?.removeEventListener('scroll', read)
    }
  }, [])
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 2000,
        padding: '2px 6px',
        background: 'rgba(0,0,0,0.8)',
        color: '#0f0',
        font: '11px ui-monospace, monospace',
        pointerEvents: 'none',
      }}
    >
      offsetTop {n.offsetTop} · vv {n.vvHeight} · win {n.innerHeight}
    </div>
  )
}

/**
 * Raw window-level touch stream, timestamped, for the stranding bug.
 *
 * The hypothesis worth killing or confirming: WebKit's text-interaction
 * recogniser takes a gesture that lands on non-editable text and the touch
 * stream stops dead — no `touchend`, no `touchcancel`. Listens in the capture
 * phase on `window` so nothing upstream (Embla included) can absorb an event
 * before this sees it. `?__preview=ritual&composer=1&debug=1`.
 *
 * Every event also goes to `console.warn` (`[touchlog]`, forwarded to the
 * terminal — see `ViewportReadout`), because polling screenshots to see
 * whether a gesture stranded is unreliable: a screenshot can catch the touch
 * stream mid-delivery and read as permanently dead when it was only slow.
 * The iOS SIMULATOR's synthetic touch injection did not strand on any
 * combination tried here — running text (`.rc__q`), the masthead, blank
 * chrome, fast and slow drags, drags with an initial dwell — every one
 * eventually produced a `touchend`, confirmed against this log's real
 * `Date.now()` timestamps. That does not clear the composer: the bug report
 * is from a physical device, and simulator touch is synthesized from mouse
 * events rather than real capacitive input, which is exactly the kind of gap
 * WebKit's text-interaction/selection recognisers could depend on. Use this
 * log on-device before trusting any fix for the strand itself.
 */
function TouchLog() {
  const [lines, setLines] = useState<string[]>([])
  const startT = useRef(0)
  useEffect(() => {
    const fmt = (e: TouchEvent) => {
      if (!startT.current) startT.current = performance.now()
      const t = Math.round(performance.now() - startT.current)
      const touch = e.touches[0] ?? e.changedTouches[0]
      const target = e.target instanceof Element ? e.target.tagName : String(e.target)
      const pos = touch ? `${Math.round(touch.clientX)},${Math.round(touch.clientY)}` : '-'
      return `${t}ms ${e.type} n=${e.touches.length} @${pos} ${target}`
    }
    const push = (e: TouchEvent) => {
      const line = fmt(e)
      console.warn('[touchlog]', line, Date.now())
      setLines((prev) => [...prev.slice(-24), line])
      if (e.type === 'touchend' || e.type === 'touchcancel') startT.current = 0
    }
    const opts = { capture: true, passive: true } as const
    window.addEventListener('touchstart', push, opts)
    window.addEventListener('touchmove', push, opts)
    window.addEventListener('touchend', push, opts)
    window.addEventListener('touchcancel', push, opts)
    return () => {
      window.removeEventListener('touchstart', push, opts)
      window.removeEventListener('touchmove', push, opts)
      window.removeEventListener('touchend', push, opts)
      window.removeEventListener('touchcancel', push, opts)
    }
  }, [])
  return (
    <div
      style={{
        position: 'fixed',
        top: 20,
        left: 0,
        right: 0,
        maxHeight: '40vh',
        overflow: 'hidden',
        zIndex: 2000,
        padding: '2px 6px',
        background: 'rgba(0,0,0,0.8)',
        color: '#0f0',
        font: '10px ui-monospace, monospace',
        pointerEvents: 'none',
        whiteSpace: 'pre',
      }}
    >
      {lines.join('\n')}
    </div>
  )
}

/** Holds the document the composer reads and writes, the way JournalScreen does. */
function ComposerHarness({ seedDoc }: { seedDoc: string }) {
  const [doc, setDoc] = useState(seedDoc)
  // The About sheet is here so the seam between it and the composer is
  // reachable: it is where the focus and Escape bugs lived.
  const [about, setAbout] = useState<Practice | null>(null)
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <RitualComposer
        blockIndex={0}
        getDoc={() => doc}
        replaceRange={(from, to, text) =>
          setDoc((d) => d.slice(0, from) + text + d.slice(to))
        }
        onAbout={(name) => setAbout(PRACTICE_BY_NAME.get(name) ?? null)}
        onClose={() => {}}
        blocked={about !== null}
      />
      {about && <PracticeAboutSheet practice={about} onClose={() => setAbout(null)} />}
      {new URLSearchParams(window.location.search).get('debug') === '1' && (
        <>
          <ViewportReadout />
          <TouchLog />
        </>
      )}
      {/* What the entry now holds — proof the composer is a surface, not a store. */}
      <pre
        data-testid="doc"
        style={{ position: 'fixed', inset: 'auto 0 0 0', opacity: 0, pointerEvents: 'none' }}
      >
        {doc}
      </pre>
    </div>
  )
}

export function renderRitualPreview(): void {
  const params = new URLSearchParams(window.location.search)
  const wanted = params.get('theme')
  const theme: ThemeId = isThemeId(wanted) ? wanted : 'compline'
  const family = THEMES.find((t) => t.id === theme)?.family ?? 'dark'
  const answered = Number(params.get('answered') ?? '0')

  const practice = PRACTICES.find((p) => p.name === 'The Daily Examen') ?? PRACTICES[0]!
  let block = buildPracticeBlock(practice, ABOVE, ABOVE.length).text
  // Fill the first `answered` movements, the way returning to a half-prayed
  // ritual the next day would find them.
  if (answered > 0) {
    const lines = block.split('\n')
    let seen = 0
    for (let i = 0; i < lines.length; i++) {
      if (!/^<!-- ritual:section:/.test(lines[i] ?? '')) continue
      if (seen < answered) lines[i + 1] = ANSWERS[seen] ?? 'Something written here.'
      seen++
    }
    block = lines.join('\n')
  }

  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  root.setAttribute('data-appearance', family)
  root.style.colorScheme = family

  const el = document.getElementById('root')
  if (!el) throw new Error('Root element #root not found')

  if (params.get('composer') === '1') {
    const font = (params.get('font') ?? 'serif') as EditorFont
    if (EDITOR_FONT_VARS[font]) root.style.setProperty('--font-editor', EDITOR_FONT_VARS[font])
    root.style.setProperty('--editor-font-size', (params.get('size') ?? '24') + 'px')
    createRoot(el).render(<ComposerHarness seedDoc={ABOVE + block} />)
    return
  }

  if (params.get('library') === '1') {
    const doc = ABOVE + block
    createRoot(el).render(
      <PracticeLibrary
        onBegin={() => {}}
        onClose={() => {}}
        skipPreview={false}
        onToggleSkipPreview={() => {}}
        midEntry={doc.trim().length > 0}
        landing={describeRitualLanding(doc, doc.length)}
      />,
    )
    return
  }

  createRoot(el).render(
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        color: 'var(--text)',
        padding: '6vh 1.5rem 30vh',
      }}
    >
      <div className="journal-write" style={{ maxWidth: '42rem', margin: '0 auto' }}>
        <Editor
          docKey="ritual-preview"
          // Exactly one blank line between the ritual and the prose below it —
          // the separation `buildPracticeBlock` writes, and the one that tells
          // the parser the writer has stepped back out of the practice.
          initialDoc={`${ABOVE}${block.replace(/\n+$/, '')}\n\n${BELOW.trim()}\n`}
          onChange={() => {}}
          autofocus={false}
        />
      </div>
    </div>,
  )
}
