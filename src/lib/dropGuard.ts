// Global drag-and-drop guard.
//
// Because the desktop app runs with Tauri's `dragDropEnabled: false` (so OS file
// drops pass through to the WebView and reach our /image dropzone), a file dropped
// *outside* a dropzone hits the WebView's default handler — which navigates to
// `file://…/theimage.png` and replaces the entire SPA with the browser's image
// viewer. The app is then dead until relaunch. The same footgun exists in any web
// browser. Dropzones call preventDefault on their own drop; this catches every
// stray drop the dropzones don't, turning it into a harmless no-op.
//
// Real dropzones (e.g. InlineImagePopover) already call preventDefault in their own
// bubble-phase handler before the event reaches window, so guarding here does not
// interfere with them — a second preventDefault is idempotent.
export function installDropGuard() {
  const swallow = (e: DragEvent) => {
    // A drop that landed on an element which handled it will have defaultPrevented
    // set by the time it bubbles to window. Only neutralize the unhandled ones.
    if (e.defaultPrevented) return
    e.preventDefault()
  }
  // dragover must be prevented too, otherwise the browser never fires a drop we can
  // cancel — preventing dragover is what marks the window as a valid drop target.
  window.addEventListener('dragover', swallow)
  window.addEventListener('drop', swallow)
}
