// The native window around the web layer: the Mac window's launch, close,
// drag, focus and full-screen behaviour, the theme the OS chrome is drawn in,
// and the iOS status-bar tap. Installed once from main.tsx; everything here is
// a no-op on the web.
//
// DESIGN_PRINCIPLES N4 (Mac window behaviour), N5 (no white flash) and N8
// (native chrome follows the voice). Audit: docs/NATIVE_FEEL_AUDIT.md §4–§6.

import { scrollToTop } from '@/features/journal/scrollToTop'
import { isDesktopTauri, isIOSTauri, isTauri, setFullscreenInsets } from './platform'

// ── Launch ──────────────────────────────────────────────────────────────────

let revealed = false

/**
 * Show the Mac window. It is created hidden (tauri.macos.conf.json) so the
 * first thing on screen is the journal, not WKWebView's white — main.tsx calls
 * this once React has committed its first render.
 *
 * Not from requestAnimationFrame: WebKit doesn't run frames for a page in a
 * window that isn't on screen, so a rAF here would wait for the very show it
 * is meant to trigger, and fall through to the 3-second native fallback in
 * src-tauri/src/native_chrome.rs. By the time React has committed, the page
 * has styles and a DOM; WebKit paints it in the window's first frame.
 *
 * `setFocus` is also what brings the app forward after an update relaunch,
 * which starts without activating (the reason lib.rs used to show and focus
 * the window itself in setup).
 */
export function revealWindow(): void {
  if (revealed || !isDesktopTauri()) return
  revealed = true
  void import('@tauri-apps/api/window')
    .then(async ({ getCurrentWindow }) => {
      const win = getCurrentWindow()
      await win.show()
      await win.setFocus()
    })
    .catch(() => {
      /* the native fallback shows it */
    })
}

// ── Theme-synced native chrome ──────────────────────────────────────────────

/** `#rrggbb` for a computed CSS colour (`rgb()`, `rgba()` or `color(srgb …)`). */
export function cssColorToHex(value: string): string | null {
  const v = value.trim().toLowerCase()
  const hex = /^#([0-9a-f]{6})$/.exec(v)
  if (hex) return `#${hex[1]}`
  const byte = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0')
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(v)
  if (rgb) return `#${byte(Number(rgb[1]))}${byte(Number(rgb[2]))}${byte(Number(rgb[3]))}`
  const srgb = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(v)
  if (srgb) {
    return `#${byte(Number(srgb[1]) * 255)}${byte(Number(srgb[2]) * 255)}${byte(Number(srgb[3]) * 255)}`
  }
  return null
}

/**
 * A theme token resolved to `#rrggbb`. Tokens can be `color-mix()` or another
 * `var()`, so they are read back through a probe's computed `color` rather
 * than as the declared string.
 */
function resolveToken(token: string): string | null {
  if (typeof document === 'undefined' || !document.body) return null
  const probe = document.createElement('span')
  probe.style.display = 'none'
  probe.style.color = `var(${token})`
  document.body.appendChild(probe)
  try {
    return cssColorToHex(getComputedStyle(probe).color)
  } finally {
    probe.remove()
  }
}

let lastAppearance = ''

/**
 * Draw the OS's own chrome in the voice the page is in. Called from App.tsx's
 * theme effect each time the resolved theme changes.
 *
 * - Mac: the window's appearance (`setTheme`), so the traffic lights, the
 *   native menus, Writing Tools and the scroll bars match a dark voice on a
 *   light system and vice versa.
 * - iOS: `set_native_appearance` (src-tauri/src/native_chrome.rs) sets the
 *   key window's `overrideUserInterfaceStyle` (status bar, keyboard, system
 *   sheets), the web view's `tintColor` from `--accent` (selection handles,
 *   not system blue — Rulings) and its ground from `--bg`, which the native
 *   privacy cover borrows.
 */
export function syncNativeAppearance(appearance: 'light' | 'dark'): void {
  if (!isTauri()) return
  const accent = resolveToken('--accent')
  const ground = resolveToken('--bg')
  const key = `${appearance}|${accent ?? ''}|${ground ?? ''}`
  if (key === lastAppearance) return
  lastAppearance = key
  if (isDesktopTauri()) {
    void import('@tauri-apps/api/window')
      .then(({ getCurrentWindow }) => getCurrentWindow().setTheme(appearance))
      .catch(() => {})
  } else if (isIOSTauri()) {
    void import('@tauri-apps/api/core')
      .then(({ invoke }) => invoke('set_native_appearance', { appearance, accent, ground }))
      .catch(() => {})
  }
}

// ── The top layer: ⌘W, the red light, ⌘. ────────────────────────────────────

/**
 * What counts as a layer over the surface: the dialogs, sheets and menus,
 * all of which mark themselves this way already (LookFor's "/" uses the same
 * test to stand aside for a modal).
 */
const LAYER_SELECTOR = '[aria-modal="true"], [role="dialog"], [role="alertdialog"], [role="menu"]'

function isShown(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return true
  if (el.getClientRects().length === 0) return false
  return getComputedStyle(el).visibility !== 'hidden'
}

/** How many layers are open over the surface right now. */
export function openLayerCount(root: ParentNode = document): number {
  let count = 0
  root.querySelectorAll(LAYER_SELECTOR).forEach((el) => {
    if (isShown(el)) count++
  })
  return count
}

/**
 * Press Escape where a real Escape would land: the focused element, or the
 * body. Every overlay already closes on Esc, so ⌘W and ⌘. reuse that path
 * instead of each overlay learning two more keys. Returns whether something
 * claimed it.
 */
export function pressEscape(): boolean {
  const active = document.activeElement
  const target = active instanceof HTMLElement ? active : document.body
  const event = new KeyboardEvent('keydown', {
    key: 'Escape',
    code: 'Escape',
    bubbles: true,
    cancelable: true,
    composed: true,
  })
  Object.defineProperty(event, 'keyCode', { get: () => 27 })
  Object.defineProperty(event, 'which', { get: () => 27 })
  target.dispatchEvent(event)
  return event.defaultPrevented
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * ⌘W or the red light: close the top layer if there is one, otherwise hide
 * the window (never quit — the Dock brings it back). Resolves to whether the
 * window should hide.
 *
 * An Escape somebody claimed closed something. One nobody claimed might
 * still have (a handler that forgot preventDefault), so the layers are
 * counted again a beat later; if none went away, Esc had nothing to close
 * and the window goes, rather than ⌘W doing nothing forever.
 */
export async function closeTopLayerOrHide(): Promise<boolean> {
  const before = openLayerCount()
  if (before === 0) return true
  if (pressEscape()) return false
  await wait(150)
  return openLayerCount() >= before
}

function installCloseRequests(): void {
  void Promise.all([import('@tauri-apps/api/event'), import('@tauri-apps/api/core')])
    .then(([{ listen }, { invoke }]) =>
      listen<number>('window-close-requested', (event) => {
        const seq = event.payload
        void closeTopLayerOrHide()
          .catch(() => true)
          .then((hide) => invoke('resolve_close_request', { seq, hide }))
          .catch(() => {})
      }),
    )
    .catch(() => {})
}

/** ⌘. is Escape on the Mac — Cancel in every dialog since System 7. */
function onCommandPeriod(e: KeyboardEvent): void {
  if (!e.isTrusted || !e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
  if (e.key !== '.' && e.code !== 'Period') return
  e.preventDefault()
  e.stopPropagation()
  pressEscape()
}

// ── Dragging the window ─────────────────────────────────────────────────────

/** The strip along the top that drags the window, in CSS px. */
export const DRAG_STRIP_PX = 28

/**
 * What must keep its own clicks under the strip. Scrims and backdrops are on
 * the list because clicking them dismisses an overlay.
 */
const INTERACTIVE = [
  'a[href]',
  'button',
  'input',
  'textarea',
  'select',
  'label',
  'summary',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="tab"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="slider"]',
  '[role="textbox"]',
  '[role="combobox"]',
  '[role="option"]',
  '.cm-editor',
  '[data-no-drag]',
  '[class*="scrim"]',
  '[class*="backdrop"]',
].join(', ')

/** True when a press on `el` belongs to the page, not to the window. */
export function isInteractive(el: Element | null): boolean {
  if (!el) return true
  return el.closest(INTERACTIVE) != null
}

/**
 * One invisible strip, 28px tall, across the top of the window, carrying
 * `data-tauri-drag-region` — the only drag hint WKWebView honours
 * (`-webkit-app-region` is a Chromium property it ignores).
 *
 * It never covers a control. It sits above everything but takes no pointer
 * events, and switches them on only while the pointer is over a spot in the
 * strip where nothing beneath it is interactive. So a press on empty chrome
 * hits the strip (and Tauri drags, or zooms on a double-click), and a press
 * on a button hits the button.
 */
function installDragStrip(): void {
  const strip = document.createElement('div')
  strip.className = 'window-drag-strip'
  strip.setAttribute('data-tauri-drag-region', '')
  strip.setAttribute('aria-hidden', 'true')
  Object.assign(strip.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    right: '0',
    height: `${DRAG_STRIP_PX}px`,
    zIndex: '2147483000',
    pointerEvents: 'none',
    background: 'transparent',
    webkitUserSelect: 'none',
    userSelect: 'none',
  })
  document.body.appendChild(strip)

  let active = false
  const setActive = (on: boolean) => {
    if (on === active) return
    active = on
    strip.style.pointerEvents = on ? 'auto' : 'none'
  }

  const update = (e: MouseEvent) => {
    if (e.buttons !== 0) return // mid-press or mid-drag: leave it be
    if (e.clientY < 0 || e.clientY >= DRAG_STRIP_PX || document.documentElement.hasAttribute('data-fullscreen')) {
      setActive(false)
      return
    }
    if (typeof document.elementsFromPoint !== 'function') return
    const under = document.elementsFromPoint(e.clientX, e.clientY).find((el) => el !== strip) ?? null
    setActive(!isInteractive(under))
  }

  window.addEventListener('mousemove', update, { passive: true, capture: true })
  document.documentElement.addEventListener('mouseleave', () => setActive(false))
}

// ── Focus and full screen ───────────────────────────────────────────────────

/**
 * `html[data-window-inactive]` while another app has the keyboard (the
 * selection and accent mute, as a Mac window's do — global.css), and
 * `html[data-fullscreen]` in full screen, where the traffic-light clearances
 * go (platform.ts `setFullscreenInsets`).
 */
function installWindowState(): void {
  const root = document.documentElement
  void import('@tauri-apps/api/window')
    .then(async ({ getCurrentWindow }) => {
      const win = getCurrentWindow()
      await win.onFocusChanged(({ payload: focused }) => {
        root.toggleAttribute('data-window-inactive', !focused)
      })
      const syncFullscreen = async () => {
        const fullscreen = await win.isFullscreen()
        if (fullscreen === root.hasAttribute('data-fullscreen')) return
        root.toggleAttribute('data-fullscreen', fullscreen)
        setFullscreenInsets(fullscreen)
      }
      await win.onResized(() => {
        void syncFullscreen().catch(() => {})
      })
      await syncFullscreen()
    })
    .catch(() => {})
}

// ── iOS: the status-bar tap ─────────────────────────────────────────────────

/** The event the native side dispatches on a status-bar tap. */
export const SCROLL_TO_TOP_EVENT = 'dayspring:scroll-to-top'

/**
 * Send whatever is scrolled back to its top: the topmost open sheet if it has
 * anything scrolled, otherwise the surface, the same scroller the tab bar's
 * second tap uses (MobileJournal: `.journal-canvas__content`).
 */
export function scrollActiveSurfaceToTop(): boolean {
  const smooth = !(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
  const layers = Array.from(document.querySelectorAll(LAYER_SELECTOR)).filter(isShown)
  const top = layers[layers.length - 1]
  if (top && scrollToTop(top, smooth)) return true
  const surface =
    document.querySelector('.app-shell .journal-canvas__content') ?? document.querySelector('.app-shell')
  return scrollToTop(surface, smooth)
}

// ── Install ─────────────────────────────────────────────────────────────────

let installed = false

export function installWindowChrome(): void {
  if (installed || typeof window === 'undefined') return
  installed = true
  if (isDesktopTauri()) {
    installDragStrip()
    installWindowState()
    installCloseRequests()
    window.addEventListener('keydown', onCommandPeriod, true)
  } else if (isIOSTauri()) {
    window.addEventListener(SCROLL_TO_TOP_EVENT, () => {
      scrollActiveSurfaceToTop()
    })
  }
}
