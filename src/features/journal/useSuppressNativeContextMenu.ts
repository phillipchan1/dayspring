import { useEffect } from 'react'
import { isInEditor } from './keyboard'

/** True when the event target is an entry row that owns the custom context menu. */
export function isEntryRowTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.closest('[data-entry-row]') != null
}

/**
 * Desktop-grade context menu: block the browser menu everywhere except entry
 * rows and the writing editor (native spellcheck / Writing Tools on macOS).
 */
export function useSuppressNativeContextMenu(
  menuOpen: boolean,
  onDismiss: () => void,
): void {
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      if (isEntryRowTarget(e.target)) return
      if (isInEditor(e.target)) return
      e.preventDefault()
      if (menuOpen) onDismiss()
    }
    document.addEventListener('contextmenu', onContextMenu, true)
    return () => document.removeEventListener('contextmenu', onContextMenu, true)
  }, [menuOpen, onDismiss])
}
