import { createRoot } from 'react-dom/client'
import { Editor } from './Editor'
import { THEMES, type ThemeId } from '@/lib/resolveTheme'

/**
 * Dev-only: `?__preview=typewriter` mounts the real editor inside the same
 * flex/overflow shell DesktopJournal gives it in focus mode, with typewriter
 * and title styling on, so caret centring and the title line can be checked
 * without signing in. Optional `&theme=ink` etc; `&doc=title` starts with a
 * lone title line and nothing below it.
 */

const LONG = [
  'The morning',
  '',
  ...Array.from(
    { length: 40 },
    (_, i) => `Paragraph ${i + 1}. I sat with this longer than I meant to, and the room stayed still around me while the light came up.`,
  ).flatMap((p) => [p, '']),
].join('\n')

function isThemeId(value: string | null): value is ThemeId {
  return THEMES.some((t) => t.id === value)
}

export function renderTypewriterPreview(): void {
  const params = new URLSearchParams(window.location.search)
  const wanted = params.get('theme')
  const theme: ThemeId = isThemeId(wanted) ? wanted : 'dawn'
  const family = THEMES.find((t) => t.id === theme)?.family ?? 'light'
  const doc = params.get('doc') === 'title' ? 'morning je' : LONG

  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  root.setAttribute('data-appearance', family)
  root.style.colorScheme = family

  const el = document.getElementById('root')
  if (!el) throw new Error('Root element #root not found')

  createRoot(el).render(
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="journal-canvas" style={{ flex: 1, minHeight: 0 }}>
        <div className="journal-canvas__content" style={{ padding: '0 1.5rem', overflow: 'hidden' }}>
          <Editor
            docKey="typewriter-preview"
            initialDoc={doc}
            onChange={() => {}}
            autofocus
            typewriter={params.get('tw') !== '0'}
            titleStyling
          />
        </div>
      </div>
    </div>,
  )
}
