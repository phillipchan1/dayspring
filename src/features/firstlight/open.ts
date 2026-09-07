/**
 * The manual door into First Light — Settings → About → "What changed".
 *
 * Separate from the automatic path on purpose. FirstLight decides the automatic
 * deck once, at mount, and nothing may recompute it (PRINCIPLE 3). A person
 * pressing a button in Settings is not an interruption, so it gets its own
 * channel rather than loosening that rule.
 *
 * A tiny store rather than context: the opener is called from Settings, which
 * sits in a different part of the tree, and threading a callback through would
 * couple two surfaces that otherwise know nothing about each other.
 */
const listeners = new Set<() => void>()

/** Open the most recent announcement, whether or not it has been seen. */
export function openFirstLight(): void {
  for (const l of listeners) l()
}

export function onOpenFirstLight(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
