// The single source of truth for every keyboard shortcut Dayspring advertises.
// Both the Settings → Shortcuts tab and the global “?” cheat-sheet render from
// this list, so a shortcut is documented in exactly one place. Keep it in sync
// with useJournalShortcuts / useFocusMode when bindings change.

import { isTauri } from '@/lib/platform'

/** A token in a shortcut. `Mod` renders as ⌘ on macOS, Ctrl elsewhere. */
export type KeyToken = string

export interface Shortcut {
  /** Key tokens shown as separate <kbd> chips. */
  keys: KeyToken[]
  label: string
  /** A second binding for the same act, shown beside the first. */
  alsoKeys?: KeyToken[]
  /** When the binding only applies in a given context. */
  when?: string
}

export interface ShortcutGroup {
  title: string
  items: Shortcut[]
}

/** Native app: ⌘N. Browser: C (Gmail-style compose; ⌘N opens a new tab). */
export function newEntryShortcutKeys(): KeyToken[] {
  return isTauri() ? ['Mod', 'N'] : ['C']
}

export function formatNewEntryShortcut(mac = isMac()): string {
  return newEntryShortcutKeys().map((k) => renderKey(k, mac)).join('')
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Writing',
    items: [
      // ⌘1 is the same act from the rail's numbering — one item under Write,
      // four under Return. Listed here rather than twice under Navigation,
      // because writing is not a place you go.
      { keys: ['Mod', 'N'], label: 'New entry', alsoKeys: ['Mod', '1'] },
      { keys: ['Mod', 'S'], label: 'Save now' },
      { keys: ['Mod', 'B'], label: 'Bold', when: 'with text selected in the editor' },
      { keys: ['Mod', 'I'], label: 'Italic', when: 'with text selected in the editor' },
      { keys: ['Mod', 'U'], label: 'Underline', when: 'with text selected in the editor' },
      { keys: ['Mod', 'Shift', 'H'], label: 'Highlight', when: 'with text selected in the editor' },
      { keys: ['Mod', 'E'], label: 'Inline code', when: 'with text selected in the editor' },
      { keys: ['Mod', 'K'], label: 'Link', when: 'with text selected in the editor' },
      { keys: ['Mod', 'Enter'], label: 'Toggle focus mode' },
      { keys: ['Tab'], label: 'Indent line', when: 'while writing in the editor' },
      { keys: ['Shift', 'Tab'], label: 'Outdent line', when: 'while writing in the editor' },
      { keys: ['Esc'], label: 'Exit focus mode', when: 'while in focus mode' },
    ],
  },
  {
    title: 'Navigation',
    items: [
      { keys: ['Mod', '2'], label: 'Journal — your own, side by side' },
      { keys: ['Mod', '3'], label: 'Ascent' },
      { keys: ['Mod', '4'], label: 'Lamp' },
      { keys: ['Mod', '5'], label: 'Altar' },
      { keys: ['Mod', ','], label: 'Settings' },
      { keys: ['Mod', 'K'], label: 'Find a word, or ask a question', when: 'anywhere' },
      { keys: ['['], label: 'Toggle sidebar labels' },
      { keys: ['↑', '↓', '←', '→'], label: 'Move between pages', when: 'on the Pages wall' },
      { keys: ['Shift', '↑', '↓'], label: 'Extend selection', when: 'on the Pages wall' },
      { keys: ['Mod', 'A'], label: 'Select every page', when: 'on the Pages wall' },
      { keys: ['Enter'], label: 'Read the page', when: 'on the Pages wall' },
      { keys: ['Esc'], label: 'Clear the selection', when: 'on the Pages wall' },
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

/** Shortcut groups with platform-accurate “new entry” keys. */
export function getShortcutGroups(): ShortcutGroup[] {
  const keys = newEntryShortcutKeys()
  const when = isTauri() ? undefined : 'when not typing'
  return SHORTCUT_GROUPS.map((group) => {
    if (group.title !== 'Writing') return group
    return {
      ...group,
      items: group.items.map((item) =>
        item.label === 'New entry' ? { ...item, keys, ...(when !== undefined ? { when } : {}) } : item,
      ),
    }
  })
}

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
