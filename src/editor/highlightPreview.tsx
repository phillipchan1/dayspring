import { createRoot } from 'react-dom/client'
import { Editor } from './Editor'
import { THEMES, type ThemeId } from '@/lib/resolveTheme'
import { formatSpiritualBlock } from '@/lib/spiritualBlocks'

/**
 * Dev-only: `?__preview=highlight` mounts the real editor with a two-line
 * `==… ==` wrap (trailing space before the closer — the shape that used to
 * stay invisible). Optional `&theme=vigil` etc. to check every palette.
 */

const SCRIPTURE = formatSpiritualBlock(
  'scripture',
  '53430d30-3e0c-4d5a-9b1a-000000000000',
  'One thing have I asked of the LORD, that will I seek after.',
  'Psalm 27:4 · ESV',
)

const DOC = `${SCRIPTURE}
==give me a one thing heart father.
give me a heart that loves you above all else. ==
`

function isThemeId(value: string | null): value is ThemeId {
  return THEMES.some((t) => t.id === value)
}

export function renderHighlightPreview(): void {
  const wanted = new URLSearchParams(window.location.search).get('theme')
  const theme: ThemeId = isThemeId(wanted) ? wanted : 'compline'
  const family = THEMES.find((t) => t.id === theme)?.family ?? 'dark'

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
        padding: '12vh 1.5rem 20vh',
      }}
    >
      <div className="journal-write" style={{ maxWidth: '42rem', margin: '0 auto' }}>
        <Editor
          docKey="highlight-preview"
          initialDoc={DOC}
          onChange={() => {}}
          autofocus={false}
        />
      </div>
    </div>,
  )
}
