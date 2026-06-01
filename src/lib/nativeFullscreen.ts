/**
 * Focus mode presentation — chrome hiding is handled in React/CSS.
 *
 * Browser Fullscreen API and Tauri setFullscreen were removed; both caused blank
 * screens / layout bugs. Focus mode = hide rail, entries, and top bar in-window.
 */
export async function enterFocusPresentation(): Promise<void> {
  /* no-op */
}

export async function exitFocusPresentation(): Promise<void> {
  // Clear any legacy browser fullscreen from older builds.
  if (document.fullscreenElement && document.exitFullscreen) {
    await document.exitFullscreen().catch(() => {})
  }
}

export function isNativeFullscreen(): boolean {
  return document.fullscreenElement != null
}

/** @deprecated Use enterFocusPresentation */
export const enterNativeFullscreen = enterFocusPresentation

/** @deprecated Use exitFocusPresentation */
export const exitNativeFullscreen = exitFocusPresentation
