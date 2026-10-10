/**
 * DEV-ONLY App Store listing preview. Entry point for
 * `scripts/capture-listing-screenshots.mjs`, reached via `?__preview=listing-*`.
 *
 * Two modes on the same URL space:
 *   ?__preview=listing-ascent          → the framed marketing shot
 *   ?__preview=listing-ascent&raw=1    → just the app, at true device size
 *
 * The framed page embeds the raw page in an iframe (see ShotFrame). Rendering the
 * shipped components rather than a mock-up is the whole point — what gets
 * uploaded is always what ships.
 *
 * Reached only through a dynamic import under `import.meta.env.DEV` in main.tsx,
 * so Vite drops this module and its fixtures from production builds.
 */

// First, before anything reads the date: every shot is taken at one moment.
import './clock'

// main.tsx loads Fraunces 500/600 roman only. The caption needs 300 and its
// italic; without the real face the browser synthesizes an oblique, which reads
// as cheap at 46px.
import '@fontsource/fraunces/300.css'
import '@fontsource/fraunces/300-italic.css'
// The drawn status bar's 9:41 — the nearest face to the system's that ships.
import '@fontsource/inter/600.css'

import { createRoot } from 'react-dom/client'
import { AppNavigationProvider } from '@/context/AppNavigation'
import { FeatureFlagProvider } from '@/features/flags'
import { EDITOR_FONT_VARS, settingsStore } from '@/lib/settings'
import { isLightTheme, THEMES, type ThemeId } from '@/lib/resolveTheme'
import { ShotFrame } from './ShotFrame'
import { renderSurface } from './surfaces'
import { renderDevicePane, type DevicePane } from './devices'
import { renderIpadShot } from './ipad'
import { shotById, type Shot } from './shots'

/** The marketing frame's ground — site/'s `--ink`. Matches ShotFrame.css. */
const FRAME_BG = '#0c0d11'

/**
 * Stamp what App.tsx normally stamps from user settings. Not just `data-theme`:
 * the four editor custom properties are what give the writing surface its
 * shipped 24px / 1.7 / 42rem Newsreader, and without them an editor shot is
 * silently the wrong typography.
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

/**
 * ScriptureView reaches for navigation context; the other snippets don't, but
 * the provider is cheap and self-seeding. `ascentAltitude` no longer needs
 * seeding — shot 01 renders `Summit` directly rather than driving AscentView to
 * its top altitude.
 */
function RawShot({
  shot,
  pane,
  ipad,
}: {
  shot: Shot
  pane: DevicePane | null
  ipad: boolean
}) {
  return (
    <FeatureFlagProvider flags={[]}>
      <AppNavigationProvider>
        {pane ? renderDevicePane(pane) : ipad ? renderIpadShot(shot) : renderSurface(shot)}
      </AppNavigationProvider>
    </FeatureFlagProvider>
  )
}

export function renderListingPreview(variant: string): void {
  const shot = shotById(variant)
  if (!shot) throw new Error(`Unknown listing shot "${variant}"`)

  const params = new URLSearchParams(window.location.search)
  const raw = params.get('raw') === '1'
  // The cross-device shot renders one of two layouts per iframe; which one is
  // decided by the iframe's width, so the pane only picks the component.
  const ipad = params.get('platform') === 'ipad'
  const paneParam = params.get('pane')
  const pane: DevicePane | null =
    paneParam === 'desktop' || paneParam === 'phone' ? paneParam : null

  // Per-shot palette (default `ink`). Applied before render so nothing
  // re-lays-out mid-capture. Shot 06's "a decade on screen at once" used to need
  // the entries list forced to year grouping; the wall puts a decade on screen
  // by default, so there is nothing left to arrange.
  //
  // `&theme=` overrides it. The capture scripts never pass one, so every shot
  // is byte-identical to before; it exists so a voice can be checked on Altar,
  // Lamp and the Ascent without reaching for devtools (D-028).
  const wantedTheme = params.get('theme')
  const theme: ThemeId =
    (THEMES.some((t) => t.id === wantedTheme) ? (wantedTheme as ThemeId) : null) ?? shot.theme ?? 'ink'

  if (raw) {
    settingsStore.update({
      appearance: isLightTheme(theme) ? 'light' : 'dark',
      ...(isLightTheme(theme) ? { lightTheme: theme } : { darkTheme: theme }),
    })
    applyTheme(theme)
    // Every surface at rest. Headless Chrome's virtual time budget does not
    // drive compositor animations inside the frame's iframe, so an entrance
    // (the Ascent's rise, a strip's fade) was photographed half-run — the year
    // shot came out with its lower half dimmed. Zero durations land each one on
    // its end state at once, the state a person sees after the first second.
    const still = document.createElement('style')
    still.textContent =
      '*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important;' +
      ' animation-iteration-count: 1 !important; transition-duration: 0s !important; transition-delay: 0s !important; }'
    document.head.appendChild(still)
  } else {
    // The frame page renders no app components, so it must NOT take the app's
    // palette: `body { background: var(--bg) }` would then paint the app's paper
    // colour, and any strip of page taller than `.shot` shows it. That was a
    // barely-visible seam under the dark shots and an obvious cream band under a
    // light one. Pin it to the frame's own ink instead.
    document.documentElement.style.background = FRAME_BG
    document.body.style.background = FRAME_BG
    document.body.style.margin = '0'
  }

  const el = document.getElementById('root')
  if (!el) throw new Error('Root element #root not found')

  createRoot(el).render(
    raw ? (
      <RawShot shot={shot} pane={pane} ipad={ipad} />
    ) : (
      <ShotFrame
        shot={shot}
        platform={ipad ? 'ipad' : 'iphone'}
        // The capture passes the frame it wants. New headless Chrome lays out
        // in a viewport ~89pt shorter than the window it photographs, so sizing
        // to `innerHeight` left a bare strip along the foot of every PNG.
        frame={{
          width: Number(params.get('w')) || window.innerWidth,
          height: Number(params.get('h')) || window.innerHeight,
        }}
      />
    ),
  )
}
