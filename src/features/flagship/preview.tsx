/**
 * DEV-ONLY flagship preview. Entry point for `scripts/capture-flagship.mjs`,
 * reached via `?__preview=flagship`.
 *
 * Two modes on the same URL space, mirroring the listing and ad previews:
 *   ?__preview=flagship&canvas=16x9      → the framed image
 *   ?__preview=flagship&raw=1            → just the app, at true window size
 *
 * The framed page embeds the raw page in a same-origin iframe, for the reason
 * AdFrame gives at length: `.slash-palette` is `position: fixed` and portaled to
 * `document.body`, so inside a CSS-scaled sub-tree it resolves against the real
 * viewport and renders full-size outside the card. In an iframe it resolves
 * against the iframe's own viewport and the scale carries it along — which is
 * the difference between this image existing and not.
 *
 * Reached only through a dynamic import under `import.meta.env.DEV` in main.tsx,
 * so Vite drops this module and its fixtures from production builds.
 */

// main.tsx loads Fraunces 500/600 roman only. The headline needs 300 and its
// italic; without the real face the browser synthesizes an oblique, which is the
// single most likely way for a hero image to look amateur.
import '@fontsource/fraunces/300.css'
import '@fontsource/fraunces/300-italic.css'

import { createRoot } from 'react-dom/client'
import { AppNavigationProvider } from '@/context/AppNavigation'
import { FeatureFlagProvider } from '@/features/flags'
import { EDITOR_FONT_VARS, settingsStore } from '@/lib/settings'
import { isLightTheme, THEMES, type ThemeId } from '@/lib/resolveTheme'
import { FlagshipScene, type FlagshipSurface } from './scene'
import { FlagshipFrame } from './FlagshipFrame'
import { CANVASES, cutById, type CanvasId } from './flagship'

/** The frame's ground when the image is built on ink. Matches FlagshipFrame.css. */
const FRAME_BG = '#0c0d11'

/**
 * Stamp what App.tsx normally stamps from user settings. Not just `data-theme`:
 * the four editor custom properties are what give the writing surface its
 * shipped size, leading and measure, and without them the one thing this image
 * is selling — the page itself — is silently the wrong typography.
 */
function applyTheme(theme: ThemeId): void {
  const root = document.documentElement
  const s = settingsStore.get()
  const light = isLightTheme(theme)
  root.setAttribute('data-theme', theme)
  root.setAttribute('data-appearance', light ? 'light' : 'dark')
  root.style.colorScheme = light ? 'light' : 'dark'
  root.style.setProperty('--editor-font-size', `${s.fontSize}px`)
  root.style.setProperty('--editor-line-height', String(s.lineHeight))
  root.style.setProperty('--editor-max-width', `${s.maxWidth}rem`)
  root.style.setProperty('--font-editor', EDITOR_FONT_VARS[s.editorFont])
}

export function renderFlagshipPreview(): void {
  const params = new URLSearchParams(window.location.search)
  const raw = params.get('raw') === '1'

  const cut = cutById(params.get('cut')) ?? cutById('write')!
  const wanted = params.get('surface')
  const SURFACES = ['ascent', 'altar', 'lamp', 'wall', 'rituals'] as const
  const surface: FlagshipSurface = SURFACES.includes(wanted as never)
    ? (wanted as FlagshipSurface)
    : 'page'
  const wantedCanvas = params.get('canvas')
  const canvas: CanvasId =
    wantedCanvas && wantedCanvas in CANVASES ? (wantedCanvas as CanvasId) : '16x9'

  const wantedTheme = params.get('theme')
  const theme: ThemeId =
    (THEMES.some((t) => t.id === wantedTheme) ? (wantedTheme as ThemeId) : null) ?? cut.theme

  if (raw) {
    settingsStore.update({
      appearance: isLightTheme(theme) ? 'light' : 'dark',
      ...(isLightTheme(theme) ? { lightTheme: theme } : { darkTheme: theme }),
    })
    applyTheme(theme)
  } else {
    // The frame page renders no app components, so it must NOT take the app's
    // palette: `body { background: var(--bg) }` would paint the app's paper
    // colour, and any strip of page taller than the frame shows it.
    document.documentElement.style.background = FRAME_BG
    document.body.style.background = FRAME_BG
    document.body.style.margin = '0'
  }

  /*
   * The frame size comes from the URL, NOT from `window.innerHeight`.
   *
   * Headless Chrome's `--window-size` sizes the WINDOW, not the viewport — the
   * ad capture lost ~87px to chrome that way and every export carried a band of
   * bare background under the footer. The script oversizes the window, passes
   * the true canvas here, and crops back.
   */
  const w = Number(params.get('w')) || window.innerWidth
  const h = Number(params.get('h')) || window.innerHeight

  const el = document.getElementById('root')
  if (!el) throw new Error('Root element #root not found')

  createRoot(el).render(
    raw ? (
      <FeatureFlagProvider flags={[]}>
        <AppNavigationProvider>
          <FlagshipScene surface={surface} />
        </AppNavigationProvider>
      </FeatureFlagProvider>
    ) : (
      <FlagshipFrame cut={cut} canvas={canvas} theme={theme} frame={{ width: w, height: h }} />
    ),
  )
}
