// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SHORTCUT_GROUPS } from '@/features/shortcuts/shortcuts'
import {
  MENU_COMMAND_EVENT,
  MENU_COMMANDS,
  chordAccelerator,
  chordEvent,
  commandAccelerator,
  noteKeydown,
  resetMenuEcho,
  runMenuCommand,
} from './nativeMenu'

const MENU_RS = readFileSync(join(__dirname, '../../src-tauri/src/mac_menu.rs'), 'utf8')

/** Every `command(app, "id", "Label", Some("Accel") | None)` in mac_menu.rs. */
function rustItems(): Map<string, string | null> {
  const items = new Map<string, string | null>()
  const re = /command\(app, "([^"]+)", "[^"]*", (?:Some\("([^"]+)"\)|None)\)/g
  for (const m of MENU_RS.matchAll(re)) items.set(m[1]!, m[2] ?? null)
  return items
}

/** shortcuts.ts tokens as a Tauri accelerator: ['Mod', 'Shift', 'H'] → CmdOrCtrl+Shift+H. */
function tokensAccelerator(keys: string[]): string | null {
  if (keys[0] !== 'Mod') return null
  return keys
    .map((k) => (k === 'Mod' ? 'CmdOrCtrl' : k.length === 1 ? k.toUpperCase() : k))
    .join('+')
}

const SHEET_ACCELERATORS = new Set(
  SHORTCUT_GROUPS.flatMap((g) => g.items).flatMap((item) =>
    [item.keys, item.alsoKeys ?? []].map(tokensAccelerator).filter((a): a is string => !!a),
  ),
)

/**
 * ⌘-shortcuts the sheet lists that are deliberately NOT menu items: they act
 * on what's in front of you (save the entry, select every page, editor-only
 * formatting toggles) rather than being app commands.
 */
const NOT_IN_MENU = new Set(['CmdOrCtrl+S', 'CmdOrCtrl+E', 'CmdOrCtrl+Shift+F', 'CmdOrCtrl+A'])

afterEach(() => {
  resetMenuEcho()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('the menu bar and shortcuts.ts agree', () => {
  it('builds every custom item the webview knows, and nothing it does not', () => {
    expect([...rustItems().keys()].sort()).toEqual(Object.keys(MENU_COMMANDS).sort())
  })

  it('lists every custom id in COMMAND_IDS (what lib.rs forwards to the webview)', () => {
    const block = /pub const COMMAND_IDS: &\[&str\] = &\[([\s\S]*?)\];/.exec(MENU_RS)?.[1] ?? ''
    const ids = [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1])
    expect(ids.sort()).toEqual(Object.keys(MENU_COMMANDS).sort())
  })

  it('gives each item the accelerator its command replays', () => {
    for (const [id, accelerator] of rustItems()) {
      expect([id, accelerator]).toEqual([id, commandAccelerator(MENU_COMMANDS[id]!) ?? null])
    }
  })

  it('takes every listed chord from the shortcut sheet', () => {
    for (const [id, command] of Object.entries(MENU_COMMANDS)) {
      const accelerator = commandAccelerator(command)
      if (!accelerator || command.unlisted) continue
      expect([id, SHEET_ACCELERATORS.has(accelerator)]).toEqual([id, true])
    }
  })

  it('puts every app-wide ⌘-shortcut from the sheet in the menu', () => {
    const inMenu = new Set(
      Object.values(MENU_COMMANDS)
        .map(commandAccelerator)
        .filter((a): a is string => !!a),
    )
    const missing = [...SHEET_ACCELERATORS].filter((a) => !inMenu.has(a) && !NOT_IN_MENU.has(a))
    expect(missing).toEqual([])
  })

  it('spells accelerators the way mac_menu.rs does', () => {
    expect(chordAccelerator({ key: 'h', code: 'KeyH', keyCode: 72, mod: true, shift: true })).toBe(
      'CmdOrCtrl+Shift+H',
    )
    expect(chordAccelerator({ key: 'Enter', code: 'Enter', keyCode: 13, mod: true })).toBe(
      'CmdOrCtrl+Enter',
    )
  })
})

describe('runMenuCommand', () => {
  it('replays the shortcut where a key press would land, keyCode and all', () => {
    const field = document.createElement('div')
    field.tabIndex = 0
    document.body.appendChild(field)
    field.focus()
    const seen: KeyboardEvent[] = []
    field.addEventListener('keydown', (e) => seen.push(e))

    expect(runMenuCommand('highlight')).toBe(true)
    expect(seen).toHaveLength(1)
    expect(seen[0]).toMatchObject({ key: 'h', metaKey: true, shiftKey: true, keyCode: 72 })
  })

  it('reaches window-level shortcut handlers', () => {
    const onKey = vi.fn((e: KeyboardEvent) => e.preventDefault())
    window.addEventListener('keydown', onKey, true)
    runMenuCommand('go-journal')
    window.removeEventListener('keydown', onKey, true)
    expect(onKey).toHaveBeenCalledTimes(1)
    expect(onKey.mock.calls[0]![0]).toMatchObject({ key: '2', metaKey: true })
  })

  it('lets a surface claim an item outright', () => {
    const onKey = vi.fn()
    const claim = (e: Event) => e.preventDefault()
    window.addEventListener(MENU_COMMAND_EVENT, claim)
    window.addEventListener('keydown', onKey, true)
    runMenuCommand('find-or-ask')
    window.removeEventListener(MENU_COMMAND_EVENT, claim)
    window.removeEventListener('keydown', onKey, true)
    expect(onKey).not.toHaveBeenCalled()
  })

  it('does not replay a key the page has just seen for real', () => {
    const onKey = vi.fn()
    window.addEventListener('keydown', onKey, true)
    noteKeydown({
      isTrusted: true,
      key: 'n',
      code: 'KeyN',
      metaKey: true,
      shiftKey: false,
      altKey: false,
      ctrlKey: false,
      defaultPrevented: false,
    } as KeyboardEvent)
    runMenuCommand('new-entry')
    window.removeEventListener('keydown', onKey, true)
    expect(onKey).not.toHaveBeenCalled()
  })

  it('falls back when nothing claims the replayed key (Print)', () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    runMenuCommand('print')
    expect(print).toHaveBeenCalledTimes(1)

    const claim = (e: KeyboardEvent) => e.preventDefault()
    window.addEventListener('keydown', claim, true)
    runMenuCommand('print')
    window.removeEventListener('keydown', claim, true)
    expect(print).toHaveBeenCalledTimes(1)
  })

  it('only sends Link with words selected in the editor', () => {
    const onKey = vi.fn()
    window.addEventListener('keydown', onKey, true)
    runMenuCommand('link')
    window.removeEventListener('keydown', onKey, true)
    expect(onKey).not.toHaveBeenCalled()
  })

  it('ignores ids it does not know', () => {
    expect(runMenuCommand('not-a-command')).toBe(false)
  })

  it('builds untrusted events, so its own replays are never remembered as key presses', () => {
    const event = chordEvent(MENU_COMMANDS['new-entry']!.chord!)
    expect(event.isTrusted).toBe(false)
  })
})
