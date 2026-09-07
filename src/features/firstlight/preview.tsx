import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { THEMES, type ThemeId } from '@/lib/resolveTheme'
import { AppNavigationProvider } from '@/context/AppNavigation'
import { FirstLight } from './FirstLight'
import { openFirstLight } from './open'

/**
 * Dev-only: `?__preview=firstlight` mounts the release-note deck with no
 * account, so the copy and every palette can be looked at without signing in.
 *
 *   ?__preview=firstlight              → the deck, in Dawn
 *   ?__preview=firstlight&theme=vigil  → any of the nine palettes
 *
 * A palette strip sits behind the deck: this surface has to hold in all nine,
 * and the dark ones are where a hand-picked colour would show. Nothing here is
 * mocked — it renders the shipped component against the real registry, so what
 * is reviewed is what users get.
 */
function Harness({ initial }: { initial: ThemeId }) {
  const [theme, setTheme] = useState<ThemeId>(initial)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  // The deck marks itself seen on close; re-open it from the strip rather than
  // clearing storage by hand.
  useEffect(() => {
    openFirstLight()
  }, [])

  return (
    <div className="fl-preview">
      <div className="fl-preview__strip">
        {THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            data-on={t.id === theme}
            title={`${t.label} — ${t.blurb}`}
            onClick={() => setTheme(t.id)}
          >
            <span style={{ background: t.swatch.bg }}>
              <i style={{ background: t.swatch.accent }} />
            </span>
            {t.label}
          </button>
        ))}
        <button type="button" className="fl-preview__reopen" onClick={() => openFirstLight()}>
          Re-open
        </button>
      </div>
      <AppNavigationProvider>
        <FirstLight />
      </AppNavigationProvider>
    </div>
  )
}

export function renderFirstLightPreview(): void {
  const params = new URLSearchParams(window.location.search)
  const asked = params.get('theme') as ThemeId | null
  const initial: ThemeId = THEMES.some((t) => t.id === asked) ? asked! : 'dawn'

  const style = document.createElement('style')
  style.textContent = `
    body { margin: 0; background: var(--bg); }
    .fl-preview { min-height: 100vh; }
    /* Above the deck: the overlay covers the viewport and treats a click on
       the ground as a dismissal, so the strip has to out-stack it to be
       clickable while the deck is open. */
    .fl-preview__strip {
      position: relative; z-index: 80;
      display: flex; flex-wrap: wrap; gap: 8px; padding: 20px;
      font-family: var(--font-sans); font-size: 12px;
    }
    .fl-preview__strip button {
      display: inline-flex; align-items: center; gap: 7px;
      background: var(--bg-elevated); color: var(--text-dim);
      border: 1px solid var(--border); border-radius: 999px;
      padding: 6px 12px 6px 7px; cursor: pointer;
    }
    .fl-preview__strip button[data-on="true"] { color: var(--text-bright); border-color: var(--accent); }
    .fl-preview__strip span {
      width: 16px; height: 16px; border-radius: 50%;
      display: grid; place-items: center; border: 1px solid rgba(0,0,0,.2);
    }
    .fl-preview__strip i { width: 6px; height: 6px; border-radius: 50%; }
    .fl-preview__reopen { padding: 6px 14px !important; }
  `
  document.head.appendChild(style)

  const root = document.getElementById('root')
  if (!root) return
  createRoot(root).render(<Harness initial={initial} />)
}
