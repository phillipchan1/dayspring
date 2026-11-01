// Haptics — DESIGN_PRINCIPLES N6, "felt, not just seen".
//
// One helper and six words. A haptic confirms something the finger just did;
// it never praises a behaviour (Principle 2), and it never fires on typing,
// scrolling or anything continuous. Where each kind belongs is the haptics
// map in docs/NATIVE_FEEL_AUDIT.md §8.
//
// Fire-and-forget: nothing waits on a buzz, and nothing breaks without one.
// On the web and on the Mac it is a no-op, and it can never throw — a missing
// plugin, an old build or a refused permission all end in silence.
//
// The plugin is `tauri-plugin-haptics` (registered for mobile in
// src-tauri/src/lib.rs). Its JS package isn't installed, so this talks to its
// commands directly; the names and argument shapes are the plugin's own
// (`plugin:haptics|impact_feedback` with `{ style }`, and so on).

import { invoke } from '@tauri-apps/api/core'
import { isMobileTauri } from './platform'

export type HapticKind = 'selection' | 'light' | 'medium' | 'success' | 'warning' | 'error'

export interface HapticCommand {
  cmd: string
  args?: Record<string, string>
}

/** The plugin call each kind maps to. Exported for the tests. */
export function hapticCommand(kind: HapticKind): HapticCommand {
  switch (kind) {
    case 'selection':
      return { cmd: 'plugin:haptics|selection_feedback' }
    case 'light':
    case 'medium':
      return { cmd: 'plugin:haptics|impact_feedback', args: { style: kind } }
    case 'success':
    case 'warning':
    case 'error':
      return { cmd: 'plugin:haptics|notification_feedback', args: { type: kind } }
  }
}

/** Play a haptic on iPhone/iPad. A no-op everywhere else; never throws. */
export function haptic(kind: HapticKind): void {
  try {
    if (!isMobileTauri()) return
    const { cmd, args } = hapticCommand(kind)
    invoke(cmd, args).catch(() => {
      /* no Taptic Engine, no plugin, or an old build — silence is fine */
    })
  } catch {
    /* never let a buzz take a tap handler down with it */
  }
}
