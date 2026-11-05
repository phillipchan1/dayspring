// No WebKit context menu in the app (NATIVE_FEEL_AUDIT top-10 #4).
//
// A right-click on chrome in a web view offers Reload, Back and — with the
// inspector on — Inspect Element. Nothing says "website" faster. The journal
// already blocked it (JournalScreen and useSuppressNativeContextMenu), but only
// while the journal was mounted, so sign-in, onboarding, the paywall, the lock
// and the error screens all still showed it. This guard is installed once, for
// the whole app, before anything renders.
//
// It lets the system menu through where it is the right menu, with the same
// allow-list the journal's guard uses:
//   - the editor (spelling suggestions, Look Up, Writing Tools),
//   - text fields (Cut / Copy / Paste, AutoFill),
//   - entry rows, whose own handler opens Dayspring's menu,
//   - anything marked `data-native-context-menu`.
//
// Native app only. On the web the browser's menu is the browser's business.

import { isEntryRowTarget } from '@/features/journal/useSuppressNativeContextMenu'
import { isInEditor } from '@/features/journal/keyboard'
import { isTauri } from './platform'

/** True when a right-click on `target` should get the system menu. */
export function allowsNativeContextMenu(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  if (isInEditor(target) || isEntryRowTarget(target)) return true
  if (target.closest('[data-native-context-menu]')) return true
  const field = target.closest('input, textarea, select, [contenteditable]')
  if (field instanceof HTMLElement) {
    if (field.isContentEditable) return true
    if (field.tagName !== 'INPUT') return true
    // Only inputs you type into; a right-click on a checkbox has nothing to offer.
    const type = (field as HTMLInputElement).type
    return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image'].includes(type)
  }
  return false
}

function onContextMenu(e: MouseEvent): void {
  if (allowsNativeContextMenu(e.target)) return
  e.preventDefault()
}

let installed = false

export function installContextMenuGuard(): void {
  if (installed || !isTauri()) return
  installed = true
  document.addEventListener('contextmenu', onContextMenu, true)
}
