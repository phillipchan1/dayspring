// Navigation made from INSIDE the mobile entries drawer.
//
// The drawer is a pushed history frame — that is what makes system Back close
// it, and why the scrim and the left-swipe pop it. But a pop is exactly wrong
// for getting the drawer out of the way of a navigation *chosen inside it*:
// everything the drawer offers commits onto the drawer's own frame, so popping
// afterwards rewinds past the thing you just did.
//
// That is the "I can't reopen an entry" bug on mobile web. Tapping a row
// replaced the selection onto the drawer's frame, then closing the drawer popped
// it — landing you back on whatever the drawer had opened over. From Ascent →
// Entries → tap an entry, you got Ascent again, every time.
//
// So a navigation made from the drawer CONSUMES the drawer's frame: same
// destination, drawer closed, committed as a replace.
import type { AppHistoryState, EntryReturnSurface } from '@/lib/appHistory'

/** What a navigation asks of the history stack. */
export type NavAction =
  | { kind: 'none' }
  /** Pop a frame (`history.back()`). */
  | { kind: 'pop' }
  /** Pop back to the surface an entry preview was opened from. */
  | { kind: 'return-to-origin' }
  | { kind: 'go'; patch: Partial<AppHistoryState>; replace: boolean }

export interface PagesModeOpts {
  /** true = show the Pages wall, false = show the list. */
  on: boolean
  /** The wall currently has the canvas. */
  pagesActive: boolean
  /** The mobile entries drawer is open — the switch was tapped inside it. */
  drawerOpen: boolean
  surfaceEntryOpenedFrom: EntryReturnSurface | null
}

/**
 * List, or Pages — the entries panel's two reading modes.
 *
 * On desktop the panel is not a history frame, so leaving Pages is a plain pop
 * back to wherever the wall was opened from.
 *
 * On mobile the panel IS the drawer, and its frame sits on top of the wall's:
 * a pop from in there would only close the drawer and leave you standing on the
 * wall you just asked to leave. Switching from the drawer replaces instead, so
 * one tap makes one frame's worth of change and Back still goes where it went
 * before the drawer was opened.
 */
export function pagesModeAction(opts: PagesModeOpts): NavAction {
  const { on, pagesActive, drawerOpen, surfaceEntryOpenedFrom } = opts
  const readingPages = pagesActive || surfaceEntryOpenedFrom === 'pages'

  if (!on) {
    // Already in list mode: the switch is a no-op and must not close the drawer.
    if (!readingPages) return { kind: 'none' }
    if (drawerOpen) {
      return {
        kind: 'go',
        // Leaving Pages deliberately — the "← Pages" breadcrumb goes with it.
        patch: { surface: 'journal', entryReturn: null, sidebar: false },
        replace: true,
      }
    }
    if (surfaceEntryOpenedFrom === 'pages') return { kind: 'return-to-origin' }
    return { kind: 'pop' }
  }

  if (pagesActive) {
    // Already on the wall. From the drawer the tap still means "show me the
    // wall", which it is covering.
    return drawerOpen ? { kind: 'go', patch: { sidebar: false }, replace: true } : { kind: 'none' }
  }

  return {
    kind: 'go',
    patch: {
      surface: 'pages',
      entryId: null,
      entryReturn: null,
      settings: null,
      help: false,
      sidebar: false,
    },
    replace: drawerOpen,
  }
}
