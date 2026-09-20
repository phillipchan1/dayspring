import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Editor } from './Editor'
import { THEMES, type ThemeId } from '@/lib/resolveTheme'
import { formatSpiritualBlock } from '@/lib/spiritualBlocks'
import { markId, normalizeQuote, type Mark } from '@/lib/marks'

/**
 * Dev-only: `?__preview=marking` mounts the real editor with a scripture
 * quotation and a working mark loop, so the gesture can be tried by hand
 * without an account, an entry or a network.
 *
 * What to check, in the order it tends to break:
 *
 * 1. **The cursor splits.** Over the verse it is a text caret; over the
 *    citation and its arrow, a pointer. That split is the only instruction
 *    this feature ships with.
 * 2. **Click opens, drag selects.** A click anywhere on the verse logs an
 *    "open chapter" below; a drag raises a one-button bar instead. The bar
 *    says Mark, never B / I / U.
 * 3. **The selection snaps to words.** Start a drag mid-word and the mark
 *    still lands on whole ones.
 * 4. **The words refuse to change.** Type, paste or backspace inside the
 *    verse and the document does not move.
 * 5. **Marking works on today's page**, which is what this harness is —
 *    `proseMarking` is off, so the prose below the quotation offers no Mark
 *    at all while the verse does.
 *
 * `&theme=vigil` etc. to check a palette; the citation's hairline is tuned per
 * voice and is the first thing to disappear in a low-contrast one.
 */

const ENTRY = 'marking-preview-entry'

const SCRIPTURE = formatSpiritualBlock(
  'scripture',
  '53430d30-3e0c-4d5a-9b1a-000000000001',
  'Draw near to God, and he will draw near to you. Cleanse your hands, you sinners, and purify your hearts, you double-minded.',
  'James 4:8 · ESV',
)

const DOC = `Small group

Something shifted in small group last night. I kept hearing the same phrase and could not shake it.

${SCRIPTURE}
I want to sit with the rest of the chapter. What else is there besides the one line I copied?
`

function isThemeId(value: string | null): value is ThemeId {
  return THEMES.some((t) => t.id === value)
}

function Harness() {
  const [marks, setMarks] = useState<Mark[]>([])
  const [log, setLog] = useState<string[]>([])

  const note = (line: string) => setLog((prev) => [line, ...prev].slice(0, 6))

  return (
    <div style={{ maxWidth: '42rem', margin: '0 auto' }}>
      <div className="journal-write">
        <Editor
          docKey="marking-preview"
          initialDoc={DOC}
          onChange={() => {}}
          autofocus={false}
          marks={marks}
          // Deliberately false: this harness is "today's page". The verse must
          // still offer Mark, and the prose around it must not.
          proseMarking={false}
          onToggleMark={(rawQuote, charStart, existing) => {
            const quote = normalizeQuote(rawQuote)
            if (existing) {
              setMarks((prev) => prev.filter((m) => m.id !== existing.id))
              note(`unmarked “${existing.quote}”`)
              return
            }
            setMarks((prev) => [
              ...prev,
              {
                id: markId(ENTRY, quote),
                entryId: ENTRY,
                quote,
                charStart,
                noticedAt: new Date().toISOString(),
              },
            ])
            note(`marked “${quote}”`)
          }}
          onOpenChapter={(target) => note(`open chapter — ${target.reference ?? 'no reference'}`)}
        />
      </div>

      <div
        style={{
          marginTop: '2rem',
          paddingTop: '1rem',
          borderTop: '1px dashed var(--border-subtle)',
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: '0.72rem',
          lineHeight: 1.7,
          color: 'var(--text-faint)',
        }}
      >
        {log.length === 0 ? 'Drag across the verse, or click it.' : log.map((l, i) => <div key={i}>{l}</div>)}
      </div>
    </div>
  )
}

export function renderMarkingPreview(): void {
  const wanted = new URLSearchParams(window.location.search).get('theme')
  const theme: ThemeId = isThemeId(wanted) ? wanted : 'vellum'
  const family = THEMES.find((t) => t.id === theme)?.family ?? 'light'

  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  root.setAttribute('data-appearance', family)
  root.style.colorScheme = family

  const el = document.getElementById('root')
  if (!el) throw new Error('Root element #root not found')

  createRoot(el).render(
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        color: 'var(--text)',
        padding: '8vh 1.5rem 20vh',
      }}
    >
      <Harness />
    </div>,
  )
}
