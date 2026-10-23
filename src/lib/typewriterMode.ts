import type { Settings } from './settings'

/**
 * Typewriter scrolling, as the one choice a writer sees: off, only in focus
 * mode (the default, and what it always was), or in the normal editor too.
 *
 * Stored as two booleans rather than one string so that stable, which reads the
 * same synced settings row and cannot be made tolerant after the fact, still
 * finds a boolean `typewriter` and reads it correctly: on for both "focus" and
 * "always", off for "off". `typewriterAlways` is the later key, and an older
 * client round-trips it untouched. Off wins over a stale `typewriterAlways`, so
 * an older client switching typewriter off really does switch it off.
 */
export type TypewriterMode = 'off' | 'focus' | 'always'

type TypewriterSettings = Pick<Settings, 'typewriter' | 'typewriterAlways'>

export const TYPEWRITER_MODES: { value: TypewriterMode; label: string; title: string }[] = [
  { value: 'off', label: 'Off', title: 'Never centre the line' },
  { value: 'focus', label: 'In focus', title: 'Centre the line in focus mode' },
  { value: 'always', label: 'Always', title: 'Centre the line whenever you write' },
]

export function typewriterMode(s: TypewriterSettings): TypewriterMode {
  if (!s.typewriter) return 'off'
  return s.typewriterAlways ? 'always' : 'focus'
}

export function typewriterPatch(mode: TypewriterMode): TypewriterSettings {
  return { typewriter: mode !== 'off', typewriterAlways: mode === 'always' }
}

/**
 * Whether the setting asks for the line to be centred right now. Says nothing
 * about the device — whether this one can (a phone cannot) is
 * `useTypewriterAvailable`'s question.
 */
export function typewriterWanted(s: TypewriterSettings, focusActive: boolean): boolean {
  const mode = typewriterMode(s)
  return mode === 'always' || (mode === 'focus' && focusActive)
}

export interface TypewriterContext {
  focusActive: boolean
  /** The device can centre at all — `useTypewriterAvailable`. */
  available: boolean
  /** Focus mode's chrome has cleared (see `focusEditorReady`). */
  focusEditorReady: boolean
}

/**
 * Is the line being centred, here, now — and should the editor be wearing the
 * extension for it?
 *
 * `shown`: the setting asks for it and the device can do it. This is what the
 * page's layout has to agree with (the handoffs to and from the reader), so it
 * does not wait on anything.
 *
 * `on`: `shown`, and the editor is ready for it. Inside focus mode the editor
 * waits a beat for the chrome to clear; in the normal editor (Always) there is
 * no chrome to wait for and the page is centred from the first frame.
 *
 * A phone never gets either, whatever the setting says — it may have been set
 * on a desktop and synced.
 */
export function resolveTypewriter(
  s: TypewriterSettings,
  ctx: TypewriterContext,
): { shown: boolean; on: boolean } {
  const shown = ctx.available && typewriterWanted(s, ctx.focusActive)
  return { shown, on: shown && (typewriterMode(s) === 'always' || ctx.focusEditorReady) }
}

/**
 * The corner switch: flip typewriter *here, now*.
 *
 * If it is centring where you are, it goes off, everywhere. If it is not, it
 * comes on for where you are — in the normal editor that means Always, and
 * inside focus mode it means In focus, so turning it on there never changes
 * how the normal editor behaves. The full three-way choice is in Settings;
 * this is the quick version of it.
 */
export function flipTypewriter(s: TypewriterSettings, focusActive: boolean): TypewriterSettings {
  if (typewriterWanted(s, focusActive)) return typewriterPatch('off')
  return typewriterPatch(focusActive ? 'focus' : 'always')
}
