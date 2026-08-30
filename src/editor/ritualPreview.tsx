import { createRoot } from 'react-dom/client'
import { Editor } from './Editor'
import { THEMES, type ThemeId } from '@/lib/resolveTheme'
import { useEffect, useState } from 'react'
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
 */
function ViewportReadout() {
  const [n, setN] = useState({ offsetTop: 0, vvHeight: 0, innerHeight: 0 })
  useEffect(() => {
    const vv = window.visualViewport
    const read = () =>
      setN({
        offsetTop: Math.round(vv?.offsetTop ?? -1),
        vvHeight: Math.round(vv?.height ?? -1),
        innerHeight: Math.round(window.innerHeight),
      })
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
      {new URLSearchParams(window.location.search).get('debug') === '1' && <ViewportReadout />}
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
