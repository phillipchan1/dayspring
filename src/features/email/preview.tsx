/**
 * DEV-ONLY scenes for the welcome email series. Entry point for
 * `scripts/capture-welcome-emails.mjs`, reached via `?__preview=email-*`.
 *
 * Only the scenes nothing else already renders live here. The stills in the
 * series reuse the listing (`listing-*&raw=1`) and flagship (`flagship&raw=1`)
 * scenes, so an email can never show a surface the App Store shots don't.
 *
 *   ?__preview=email-slash   → a bare page, caret on an open line, waiting for
 *                               the capture script to type `/` into it
 *   ?__preview=email-page    → the whole desktop app on a quiet page: the rail
 *                               is the map of where everything lives, which is
 *                               what a first email needs to show
 *
 * The capture script drives real keystrokes over the DevTools protocol, so the
 * palette in the GIF is opened the way a writer opens it — no synthetic state.
 * Sample content is fabricated; no real journal is ever in a public asset.
 *
 * Reached only through a dynamic import under `import.meta.env.DEV` in main.tsx,
 * so Vite drops this module from production builds.
 */

import { createRoot } from 'react-dom/client'
import { useEffect, useRef, useState } from 'react'
import { EditorView } from '@codemirror/view'
import { AppNavigationProvider } from '@/context/AppNavigation'
import { FeatureFlagProvider } from '@/features/flags'
import { Editor, type EditorHandle } from '@/editor/Editor'
import type { InlinePanelAnchor } from '@/editor/inlinePanelAnchor'
import { InlinePrayPopover } from '@/features/capture/InlinePrayPopover'
import { DesktopJournal } from '@/features/journal/DesktopJournal'
import { journalProps } from '@/features/appstore/devices'
import { EDITOR_FONT_VARS, settingsStore } from '@/lib/settings'
import { isLightTheme, THEMES, type ThemeId } from '@/lib/resolveTheme'

const noop = () => {}

/** Ends on an empty line: that is where the caret waits and `/` gets typed. */
export const SLASH_DOC = `Wednesday

Couldn't sleep again. Kept running Thursday over in my head until the birds started.

`

/** A first page, nothing open over it. Fabricated, like every fixture here. */
export const PAGE_DOC = `Sunday

First page. Sat on the porch before anyone was up and tried to remember the last time I actually prayed instead of just worrying in God's direction.

Starting here anyway.
`

function PageScene() {
  useEffect(() => {
    // No keystrokes to wait for; one settled frame is enough for fonts and CM.
    const t = setTimeout(() => document.documentElement.setAttribute('data-email-ready', '1'), 600)
    return () => clearTimeout(t)
  }, [])
  const words = PAGE_DOC.trim().split(/\s+/).length
  return (
    <DesktopJournal
      {...journalProps(
        <Editor
          docKey="email-page"
          initialDoc={PAGE_DOC}
          onChange={noop}
          placeholder="Title"
          autofocus={false}
          titleStyling
          slashEnabled
        />,
      )}
      words={words}
    />
  )
}

function applyTheme(theme: ThemeId): void {
  const root = document.documentElement
  const s = settingsStore.get()
  const light = isLightTheme(theme)
  settingsStore.update({
    appearance: light ? 'light' : 'dark',
    ...(light ? { lightTheme: theme } : { darkTheme: theme }),
  })
  root.setAttribute('data-theme', theme)
  root.setAttribute('data-appearance', light ? 'light' : 'dark')
  root.style.colorScheme = light ? 'light' : 'dark'
  root.style.setProperty('--editor-font-size', `${s.fontSize}px`)
  root.style.setProperty('--editor-line-height', String(s.lineHeight))
  root.style.setProperty('--editor-max-width', `${s.maxWidth}rem`)
  root.style.setProperty('--font-editor', EDITOR_FONT_VARS[s.editorFont])
}

/**
 * Put the caret at the end of the document and focus it, then raise
 * `data-email-ready` so the capture script knows keystrokes will land.
 * Retried per frame: CodeMirror has no view until it has mounted and measured.
 */
function SlashScene() {
  const hostRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<EditorHandle>(null)
  // Prayer opens its own popover — JournalScreen hosts it in the app, so this
  // scene hosts it here, inserting the block the same way
  // (JournalScreen.completeSlashInsert: block plus a trailing line). Saving the
  // spiritual item has no session here and fails quietly after the insert.
  const [capture, setCapture] = useState<{ insertAt: number; anchor: InlinePanelAnchor } | null>(null)
  useEffect(() => {
    let frame = 0
    let tries = 0
    const tick = () => {
      tries += 1
      const dom = hostRef.current?.querySelector<HTMLElement>('.cm-editor')
      const view = dom ? EditorView.findFromDOM(dom) : null
      if (view && view.contentDOM.getBoundingClientRect().height > 0) {
        const end = view.state.doc.length
        view.dispatch({ selection: { anchor: end } })
        view.focus()
        document.documentElement.setAttribute('data-email-ready', '1')
        return
      }
      if (tries < 240) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div className="app-shell" style={{ flexDirection: 'column', height: '100dvh' }}>
      <div className="journal-canvas" style={{ flex: 1, minHeight: 0 }}>
        <div
          ref={hostRef}
          className="journal-canvas__content"
          style={{ padding: '2rem 1.5rem 1.25rem', overflow: 'hidden', height: '100%' }}
        >
          <Editor
            ref={editorRef}
            docKey="email-slash"
            initialDoc={SLASH_DOC}
            onChange={noop}
            placeholder="Title"
            autofocus={false}
            titleStyling
            slashEnabled
            onSlashCommand={(cmd, insertAt, anchor) => {
              if (cmd === 'pray') setCapture({ insertAt, anchor })
            }}
          />
        </div>
      </div>
      {capture && (
        <InlinePrayPopover
          entryId={null}
          anchor={capture.anchor}
          onInsert={(text) => {
            const withTrailingLine = text.endsWith('\n') ? text : `${text}\n`
            editorRef.current?.insertAt(capture.insertAt, withTrailingLine)
            setCapture(null)
          }}
          onClose={() => setCapture(null)}
        />
      )}
    </div>
  )
}

export function renderEmailPreview(variant: string): void {
  const params = new URLSearchParams(window.location.search)
  const wanted = params.get('theme')
  const theme: ThemeId = THEMES.some((t) => t.id === wanted) ? (wanted as ThemeId) : 'dawn'
  applyTheme(theme)

  const el = document.getElementById('root')
  if (!el) throw new Error('Root element #root not found')
  const scene =
    variant === 'email-slash' ? <SlashScene /> : variant === 'email-page' ? <PageScene /> : null
  if (!scene) throw new Error(`Unknown email scene "${variant}"`)

  createRoot(el).render(
    <FeatureFlagProvider flags={[]}>
      <AppNavigationProvider>{scene}</AppNavigationProvider>
    </FeatureFlagProvider>,
  )
}
