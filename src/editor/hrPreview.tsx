import { createRoot } from 'react-dom/client'
import { Editor } from './Editor'
import { THEMES, type ThemeId } from '@/lib/resolveTheme'

/**
 * Dev-only: `?__preview=hr` mounts the real editor with a thematic break so
 * each palette's gem can be checked. Optional `&theme=vigil` etc.
 */

const DOC = `The morning

I sat with this longer than I meant to. The room was still.

---

And then the afternoon, which was a different kind of quiet.
`

function isThemeId(value: string | null): value is ThemeId {
  return THEMES.some((t) => t.id === value)
}

export function renderHrPreview(): void {
  const wanted = new URLSearchParams(window.location.search).get('theme')
  const theme: ThemeId = isThemeId(wanted) ? wanted : 'dawn'
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
        padding: '12vh 1.5rem 20vh',
      }}
    >
      <div className="journal-write" style={{ maxWidth: '42rem', margin: '0 auto' }}>
        <Editor docKey="hr-preview" initialDoc={DOC} onChange={() => {}} autofocus={false} />
      </div>
    </div>,
  )
}
