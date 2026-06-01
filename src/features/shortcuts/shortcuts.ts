// The single source of truth for every keyboard shortcut Dayspring advertises.
// Both the Settings → Shortcuts tab and the global “?” cheat-sheet render from
// this list, so a shortcut is documented in exactly one place. Keep it in sync
// with useJournalShortcuts / useFocusMode when bindings change.

/** A token in a shortcut. `Mod` renders as ⌘ on macOS, Ctrl elsewhere. */
export type KeyToken = string

export interface Shortcut {
  /** Key tokens shown as separate <kbd> chips. */
  keys: KeyToken[]
  label: string
  /** When the binding only applies in a given context. */
  when?: string
}

export interface ShortcutGroup {
  title: string
  items: Shortcut[]
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Writing',
    items: [
      { keys: ['Mod', 'N'], label: 'New entry' },
      { keys: ['Mod', 'S'], label: 'Save now' },
      { keys: ['Mod', 'Enter'], label: 'Toggle focus mode' },
      { keys: ['Esc'], label: 'Exit focus mode', when: 'while in focus mode' },
    ],
  },
  {
    title: 'Navigation',
    items: [
      { keys: ['Mod', 'K'], label: 'Search your entries' },
      { keys: ['Mod', ','], label: 'Open settings' },
    ],
  },
  {
    title: 'Help',
    items: [
      { keys: ['?'], label: 'Show this shortcut guide' },
      { keys: ['Esc'], label: 'Close any dialog' },
    ],
  },
]

/** True on macOS-family devices, where the platform modifier is ⌘. */
export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false
  const p = navigator.platform || ''
  return /mac|iphone|ipad|ipod/i.test(p) || /Mac OS X/i.test(navigator.userAgent)
}

/** Render a key token for display (⌘/Ctrl, arrows, etc.). */
export function renderKey(token: KeyToken, mac = isMac()): string {
  switch (token) {
    case 'Mod':
      return mac ? '⌘' : 'Ctrl'
    case 'Enter':
      return mac ? '⏎' : 'Enter'
    case 'Esc':
      return 'Esc'
    case 'Shift':
      return mac ? '⇧' : 'Shift'
    default:
      return token
  }
}
