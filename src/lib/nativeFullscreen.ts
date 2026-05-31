/** Options supported in Safari 26.4+ / recent Chromium for Esc handling in fullscreen. */
type FocusFullscreenOptions = FullscreenOptions & {
  keyboardLock?: 'none' | 'browser'
}

/**
 * Enter browser fullscreen (hides browser chrome; on macOS this is the closest
 * a web app gets to system fullscreen). Uses keyboard lock when supported so
 * Esc can close overlays before exiting fullscreen.
 *
 * True macOS window fullscreen (traffic-light green button) needs a native
 * shell (Tauri) — not available to a normal browser tab.
 */
export async function enterNativeFullscreen(): Promise<boolean> {
  const el = document.documentElement
  if (!el.requestFullscreen) return false
  if (document.fullscreenElement) return true

  const withLock: FocusFullscreenOptions = {
    navigationUI: 'hide',
    keyboardLock: 'browser',
  }
  try {
    await el.requestFullscreen(withLock)
    return true
  } catch {
    try {
      await el.requestFullscreen({ navigationUI: 'hide' })
      return true
    } catch {
      return false
    }
  }
}

export async function exitNativeFullscreen(): Promise<void> {
  if (document.fullscreenElement && document.exitFullscreen) {
    await document.exitFullscreen().catch(() => {})
  }
}

export function isNativeFullscreen(): boolean {
  return document.fullscreenElement != null
}
