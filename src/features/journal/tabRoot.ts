import type { AppHistoryState, Surface } from '@/lib/appHistory'

/** The surfaces the phone's bottom bar holds a tab for. */
export type TabSurface = Extract<Surface, 'pages' | 'reflections' | 'scripture' | 'altar'>

/**
 * A tab tapped while already on its surface: what closes back to the surface's
 * root, or null when it is already there (and the tap scrolls to the top).
 *
 * The layers each surface pushes over itself — the Pages reader, a Lamp book,
 * an Ascent drill-in — are closed as destinations, never with `back()`: popping
 * a frame goes wherever you came from, and that is the toggle this replaces.
 */
export function tabRootPatch(
  state: Pick<AppHistoryState, 'surface' | 'pagesSpreadId' | 'scriptureBook' | 'ascentDrill'>,
  tab: TabSurface,
): Partial<AppHistoryState> | null {
  if (state.surface !== tab) return null
  if (tab === 'pages' && state.pagesSpreadId) return { pagesSpreadId: null }
  if (tab === 'scripture' && state.scriptureBook) return { scriptureBook: null, scriptureVerse: null }
  if (tab === 'reflections' && state.ascentDrill) return { ascentDrill: null }
  return null
}
