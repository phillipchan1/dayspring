// The Mac menu bar's other half (DESIGN_PRINCIPLES N4).
//
// src-tauri/src/mac_menu.rs builds the menu; picking one of Dayspring's own
// items emits `native-menu` with the item's id. This turns that id back into
// the command — and it does so by REPLAYING THE COMMAND'S KEYBOARD SHORTCUT:
// a synthetic `keydown` with the same key and modifiers, dispatched where a
// real key press would land (the focused element, so it bubbles through the
// editor, the document and the window). The handlers in useJournalShortcuts,
// useFocusMode, the editor's keymap and the shortcut sheet run unchanged.
//
// Why replay rather than call: "what ⌘N does" already lives in exactly one
// place, with its own rules about Settings being open, the editor having a
// selection, and so on. A second, direct path from the menu would be a second
// definition that drifts. The cost is that a menu item can only do what its
// shortcut does — which is the promise a menu makes anyway.
//
// Never twice. WKWebView offers a key equivalent to the page first and only
// sends it on to the menu if the page did not claim it (preventDefault). So:
//   - a shortcut the page handles never reaches the menu;
//   - one it doesn't handle does, and replaying it would be a no-op — or a
//     double, if some handler acted without claiming the key.
// To be safe against either reading of the event order, every trusted keydown
// is remembered for a moment, and a menu event for the same chord arriving
// right behind it is not replayed. The synthetic replay is the only path for
// clicks; the real key press is the only path for keys.
//
// A command can also be claimed outright: before replaying, a cancelable
// `dayspring:menu-command` CustomEvent ({ detail: { id } }) goes to `window`.
// Call preventDefault() on it to handle an item directly (JournalScreen could
// claim 'find-or-ask' or 'print' this way).

import { hasEditorSelection } from '@/features/journal/keyboard'
import { checkForUpdate } from './appUpdate'
import { isDesktopTauri } from './platform'

/** The event src-tauri/src/mac_menu.rs emits (`MENU_EVENT`). */
export const MENU_EVENT = 'native-menu'

/** Dispatched on `window` before a command runs; cancel it to claim the item. */
export const MENU_COMMAND_EVENT = 'dayspring:menu-command'

/** A keyboard shortcut, as the synthetic keydown will carry it. */
export interface Chord {
  key: string
  code: string
  /** Legacy keyCode. CodeMirror names ⌘⇧ chords on the Mac from it (w3c-keyname). */
  keyCode: number
  /** ⌘ on the Mac — `Mod` in shortcuts.ts. */
  mod?: boolean
  shift?: boolean
}

export interface MenuCommand {
  /** The shortcut this item replays. */
  chord?: Chord
  /** Accelerator shown in the menu, for items with no chord to replay. */
  accelerator?: string
  /** Where the replayed key goes: the focused element (default) or <body>. */
  target?: 'focus' | 'body'
  /** Only replay when this holds. */
  when?: () => boolean
  /** Runs when nothing claimed the replayed key — or always, with no chord. */
  fallback?: () => void
  /**
   * Shown in the menu but not (yet) in src/features/shortcuts/shortcuts.ts.
   * nativeMenu.test.ts insists every other chord is one the sheet lists.
   */
  unlisted?: true
}

const mod = (key: string, code: string, keyCode: number, shift = false): Chord => ({
  key,
  code,
  keyCode,
  mod: true,
  ...(shift ? { shift: true } : {}),
})

/**
 * Every custom item in mac_menu.rs, by id. The menu's accelerators are checked
 * against these chords, and these against shortcuts.ts, by nativeMenu.test.ts.
 */
export const MENU_COMMANDS: Record<string, MenuCommand> = {
  settings: { chord: mod(',', 'Comma', 188) },
  // The same manual check Settings → About runs: it says so while it looks.
  'check-updates': {
    fallback: () => {
      void checkForUpdate(true).catch(() => {})
    },
  },
  'new-entry': { chord: mod('n', 'KeyN', 78) },
  // No page claims ⌘P today; the webview's own print panel is the answer then.
  print: { chord: mod('p', 'KeyP', 80), fallback: () => window.print(), unlisted: true },
  find: { chord: mod('f', 'KeyF', 70) },
  'find-or-ask': { chord: mod('k', 'KeyK', 75) },
  bold: { chord: mod('b', 'KeyB', 66) },
  italic: { chord: mod('i', 'KeyI', 73) },
  underline: { chord: mod('u', 'KeyU', 85) },
  // ⌘⇧ on the Mac leaves `key` lowercase; CodeMirror reads keyCode instead.
  highlight: { chord: mod('h', 'KeyH', 72, true) },
  // ⌘K only means Link with words selected in the editor; without them the
  // same chord would open Find, which is not what "Link…" promised.
  link: { chord: mod('k', 'KeyK', 75), when: hasEditorSelection },
  'focus-mode': { chord: mod('Enter', 'Enter', 13) },
  // useJournalShortcuts binds these; the sheet doesn't list them yet.
  'zoom-in': { chord: mod('=', 'Equal', 187), unlisted: true },
  'zoom-out': { chord: mod('-', 'Minus', 189), unlisted: true },
  'zoom-reset': { chord: mod('0', 'Digit0', 48), unlisted: true },
  'go-write': { chord: mod('1', 'Digit1', 49) },
  'go-journal': { chord: mod('2', 'Digit2', 50) },
  'go-ascent': { chord: mod('3', 'Digit3', 51) },
  'go-lamp': { chord: mod('4', 'Digit4', 52) },
  'go-altar': { chord: mod('5', 'Digit5', 53) },
  // History is how the app navigates (lib/appHistory.ts), so Back is the
  // browser's back — the same thing the mouse's back button does. Not a
  // replayed ⌘[: in the editor CodeMirror reads that as "outdent".
  'go-back': { accelerator: 'CmdOrCtrl+[', fallback: () => history.back(), unlisted: true },
  'go-forward': { accelerator: 'CmdOrCtrl+]', fallback: () => history.forward(), unlisted: true },
  // The sheet ignores "?" typed into a field or the editor, so it goes to <body>.
  shortcuts: { chord: { key: '?', code: 'Slash', keyCode: 191, shift: true }, target: 'body' },
}

/** The Tauri accelerator string for a chord, as mac_menu.rs spells it. */
export function chordAccelerator(chord: Chord): string {
  const parts: string[] = []
  if (chord.mod) parts.push('CmdOrCtrl')
  if (chord.shift && chord.mod) parts.push('Shift')
  parts.push(chord.key.length === 1 ? chord.key.toUpperCase() : chord.key)
  return parts.join('+')
}

/** The accelerator a command's menu item should carry, if any. */
export function commandAccelerator(command: MenuCommand): string | undefined {
  if (command.accelerator) return command.accelerator
  if (!command.chord?.mod) return undefined
  return chordAccelerator(command.chord)
}

/** A keydown carrying `chord`, legacy keyCode and all. */
export function chordEvent(chord: Chord): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: chord.key,
    code: chord.code,
    metaKey: !!chord.mod,
    shiftKey: !!chord.shift,
    bubbles: true,
    cancelable: true,
    composed: true,
  })
  // Not settable through the constructor in WebKit; CodeMirror needs them.
  Object.defineProperty(event, 'keyCode', { get: () => chord.keyCode })
  Object.defineProperty(event, 'which', { get: () => chord.keyCode })
  return event
}

function matchesChord(e: KeyboardEvent, chord: Chord): boolean {
  if (e.metaKey !== !!chord.mod || e.shiftKey !== !!chord.shift) return false
  if (e.altKey || e.ctrlKey) return false
  return e.key.toLowerCase() === chord.key.toLowerCase() || e.code === chord.code
}

/** How long a real key press shadows a menu event for the same chord. */
const ECHO_MS = 1000

let lastTrusted: { event: KeyboardEvent; at: number } | null = null

/** Remember real key presses, so the menu's echo of one can be recognised. */
export function noteKeydown(e: KeyboardEvent): void {
  if (!e.isTrusted) return
  lastTrusted = { event: e, at: performance.now() }
}

/** For tests. */
export function resetMenuEcho(): void {
  lastTrusted = null
}

function recentEcho(chord: Chord): KeyboardEvent | null {
  if (!lastTrusted) return null
  if (performance.now() - lastTrusted.at > ECHO_MS) return null
  return matchesChord(lastTrusted.event, chord) ? lastTrusted.event : null
}

function replayTarget(command: MenuCommand): EventTarget {
  if (command.target === 'body') return document.body
  const active = document.activeElement
  return active instanceof HTMLElement ? active : document.body
}

/**
 * Run a menu item. Returns false for an id this build doesn't know (an older
 * webview under a newer menu, or the reverse) so nothing happens rather than
 * the wrong thing.
 */
export function runMenuCommand(id: string): boolean {
  const command = MENU_COMMANDS[id]
  if (!command) return false

  const claim = new CustomEvent(MENU_COMMAND_EVENT, { detail: { id }, cancelable: true })
  window.dispatchEvent(claim)
  if (claim.defaultPrevented) return true

  if (command.when && !command.when()) return true

  if (!command.chord) {
    command.fallback?.()
    return true
  }

  // The page already saw this very key press and passed on it; replaying it
  // would ask the same question twice. Only the fallback is left to try.
  const echo = recentEcho(command.chord)
  if (echo) {
    if (!echo.defaultPrevented) command.fallback?.()
    return true
  }

  const event = chordEvent(command.chord)
  replayTarget(command).dispatchEvent(event)
  if (!event.defaultPrevented) command.fallback?.()
  return true
}

let installed = false

/** Listen for the menu bar. Mac app only; a no-op on the web and on iOS. */
export function installNativeMenu(): void {
  if (installed || !isDesktopTauri()) return
  installed = true
  window.addEventListener('keydown', noteKeydown, true)
  void import('@tauri-apps/api/event')
    .then(({ listen }) =>
      listen<string>(MENU_EVENT, (event) => {
        runMenuCommand(event.payload)
      }),
    )
    .catch(() => {
      /* no bridge — nothing to listen to */
    })
}
