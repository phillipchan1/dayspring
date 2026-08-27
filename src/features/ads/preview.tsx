/**
 * DEV-ONLY paid-social ad preview. Entry point for `scripts/capture-ads.mjs`,
 * reached via `?__preview=ad-*`.
 *
 * Two modes on the same URL space, mirroring the listing preview:
 *   ?__preview=ad-pile&ratio=4x5   → the framed ad
 *   ?__preview=ad-pile&raw=1       → just the app surface, at true device size
 *
 * The framed page embeds the raw page in a same-origin iframe (see AdFrame).
 * Rendering the shipped components rather than a mock-up is the whole point —
 * what we buy media against is always what ships.
 *
 * Reached only through a dynamic import under `import.meta.env.DEV` in main.tsx,
 * so Vite drops this module and its fixtures from production builds.
 */

// main.tsx loads Fraunces 500/600 roman only. The headline needs 300 and its
// italic; without the real face the browser synthesizes an oblique, which reads
// as cheap at 44px and is the single most likely way for these to look amateur.
import '@fontsource/fraunces/300.css'
import '@fontsource/fraunces/300-italic.css'

import { createRoot } from 'react-dom/client'
import { AppNavigationProvider } from '@/context/AppNavigation'
import { FeatureFlagProvider } from '@/features/flags'
import { renderSurface } from '@/features/appstore/surfaces'
import type { Shot } from '@/features/appstore/shots'
import { EDITOR_FONT_VARS, settingsStore } from '@/lib/settings'
import { isLightTheme, type ThemeId } from '@/lib/resolveTheme'
import { AdFrame } from './AdFrame'
import { adById, type Ad, type AdRatio } from './ads'

/** The frame's ground — site/'s `--ink`. Must match AdFrame.css and the script. */
const FRAME_BG = '#0c0d11'

/**
 * The CSS canvas per ratio, and the pixels it is finally exported at.
 *
 * Capture is supersampled: every canvas is at least 660 CSS px wide (the listing
 * script's hard-won floor — below roughly 640, macOS's minimum window width
 * makes Chrome lay out narrow while still cropping to `--window-size`, silently
 * slicing the right edge off) and is then Lanczos-downsampled to Meta's spec.
 * That buys crisper type than rendering at 540 and avoids the minimum entirely.
 */
export const AD_RATIOS: Record<AdRatio, { css: { w: number; h: number }; out: { w: number; h: number } }> = {
  // The workhorse: the largest cell in the Facebook and Instagram feed.
  '4x5': { css: { w: 660, h: 825 }, out: { w: 1080, h: 1350 } },
  '1x1': { css: { w: 720, h: 720 }, out: { w: 1080, h: 1080 } },
  // Stories and Reels. AdFrame.css keeps the caption and footer clear of
  // Instagram's own overlaid UI at the top and bottom of a story.
  '9x16': { css: { w: 675, h: 1200 }, out: { w: 1080, h: 1920 } },
}

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
 * `renderSurface` is keyed off a Shot, and an Ad is not one — but the only field
 * it reads is `surface`. Adapting here rather than widening its signature keeps
 * the App Store module, whose assets are already in review, untouched.
 */
function asShot(ad: Ad): Shot {
  return {
    id: ad.id,
    file: ad.file,
    eyebrow: ad.eyebrow,
    headline: ad.headline,
    subcaption: ad.subcaption,
    surface: ad.surface ?? 'capture',
    // Spread rather than assign: `exactOptionalPropertyTypes` is on, so an
    // explicit `undefined` is not the same as an absent key.
    ...(ad.theme ? { theme: ad.theme } : {}),
    ...(ad.cropTop ? { cropTop: ad.cropTop } : {}),
    ...(ad.padTop ? { padTop: ad.padTop } : {}),
  }
}

function RawAd({ ad }: { ad: Ad }) {
  return (
    <FeatureFlagProvider flags={[]}>
      <AppNavigationProvider>{renderSurface(asShot(ad))}</AppNavigationProvider>
    </FeatureFlagProvider>
  )
}

export function renderAdPreview(variant: string): void {
  const ad = adById(variant)
  if (!ad) throw new Error(`Unknown ad "${variant}"`)

  const params = new URLSearchParams(window.location.search)
  const raw = params.get('raw') === '1'
  const requested = params.get('ratio')
  const ratio: AdRatio =
    requested === '1x1' || requested === '9x16' || requested === '4x5' ? requested : '4x5'

  const theme: ThemeId = ad.theme ?? 'ink'

  if (raw) {
    settingsStore.update({
      appearance: isLightTheme(theme) ? 'light' : 'dark',
      ...(isLightTheme(theme) ? { lightTheme: theme } : { darkTheme: theme }),
    })
    applyTheme(theme)
  } else {
    // The frame page renders no app components, so it must NOT take the app's
    // palette: `body { background: var(--bg) }` would paint the app's paper
    // colour, and any strip of page taller than `.ad` shows it. Pin it to the
    // frame's own ink instead.
    document.documentElement.style.background = FRAME_BG
    document.body.style.background = FRAME_BG
    document.body.style.margin = '0'
  }

  /*
   * The frame size comes from the URL, NOT from `window.innerHeight`.
   *
   * Headless Chrome's `--window-size` is the WINDOW, not the viewport: at
   * `--window-size=720,720` the page gets 720x633, because ~87px goes to window
   * chrome — while the screenshot is still the full 720x720. Sizing the frame
   * from `innerHeight` therefore laid an 825px ad out at 738px and left a band
   * of bare body background along the bottom of every export, directly under
   * the footer bar. It is invisible on a dark frame until something sits at the
   * bottom edge, which is why the listing shots never surfaced it.
   *
   * Reading the intended size from the URL makes the layout independent of the
   * viewport entirely; the capture script oversizes the window and crops back.
   * Falling back to `innerWidth/innerHeight` keeps a hand-opened browser honest.
   */
  const w = Number(params.get('w')) || window.innerWidth
  const h = Number(params.get('h')) || window.innerHeight

  const el = document.getElementById('root')
  if (!el) throw new Error('Root element #root not found')

  createRoot(el).render(
    raw ? (
      <RawAd ad={ad} />
    ) : (
      <AdFrame ad={ad} ratio={ratio} frame={{ width: w, height: h }} />
    ),
  )
}
