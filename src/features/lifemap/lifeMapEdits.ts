// Optimistic edits to a loaded Life Map — pure, so the surface can show an add
// or a removal the instant it is asked for and put things back exactly if the
// server says no (DESIGN_PRINCIPLES N5: "look done immediately, roll back
// visibly if they fail").
//
// Every function returns a NEW map and never mutates the one it was given:
// the old map is what a rollback restores, so it has to still be the old map.

import type { LifeMap } from './useLifeMap'
import type { LifeMapItem, LifeMapSection, SectionId } from './lifeMap'

/** Where a removed item was, so Undo (or a failed write) can put it back there. */
export interface Removed {
  item: LifeMapItem
  section: SectionId
  list: 'items' | 'earlier'
  index: number
}

function withSection(map: LifeMap, id: SectionId, edit: (s: LifeMapSection) => LifeMapSection): LifeMap {
  return { ...map, sections: map.sections.map((s) => (s.id === id ? edit(s) : s)) }
}

/** `found` counts the current items the engine found — kept in step by hand. */
function recount(s: LifeMapSection): LifeMapSection {
  return { ...s, found: s.items.filter((i) => i.provenance !== 'mine').length }
}

/** The map without the item keyed `key`, and where it was — or null if absent. */
export function withoutItem(map: LifeMap, key: string): { map: LifeMap; removed: Removed | null } {
  for (const s of map.sections) {
    for (const list of ['items', 'earlier'] as const) {
      const index = s[list].findIndex((i) => i.key === key)
      if (index < 0) continue
      const item = s[list][index]!
      const next = withSection(map, s.id, (sec) =>
        recount({ ...sec, [list]: sec[list].filter((_, j) => j !== index) }),
      )
      return { map: next, removed: { item, section: s.id, list, index } }
    }
  }
  return { map, removed: null }
}

/** Put a removed item back where it was (or at the end, if the list shrank). */
export function withRestored(map: LifeMap, removed: Removed): LifeMap {
  const { item, section, list, index } = removed
  return withSection(map, section, (sec) => {
    if (sec[list].some((i) => i.key === item.key)) return sec
    const at = Math.min(index, sec[list].length)
    const next = [...sec[list].slice(0, at), item, ...sec[list].slice(at)]
    return recount({ ...sec, [list]: next })
  })
}

/** The key a typed subject is kept under — `addTyped`'s `subject_key`. */
export const typedKey = (label: string) => `word:${label.trim()}`

/**
 * The item a typed name becomes before the server has answered.
 *
 * Exactly what `buildLifeMap` makes of a `word:` row the engine has not seen —
 * the writer's own, current, no count yet — so the refresh that follows a
 * successful write lands the same chip in the same place and nothing jumps.
 */
export function typedItem(label: string, section: SectionId, keptAt: string): LifeMapItem {
  const clean = label.trim()
  return {
    key: typedKey(clean),
    id: null,
    label: clean,
    section,
    provenance: 'mine',
    pages: 0,
    dormant: false,
    era: 'current',
    firstSeen: keptAt,
    lastSeen: null,
    terms: [clean],
  }
}

/**
 * The map with a typed name added, where `buildLifeMap` would order it: with
 * the writer's own names (which come first), after those first seen earlier.
 * Unchanged if the name is already on the map in that section.
 */
export function withTyped(map: LifeMap, item: LifeMapItem): LifeMap {
  const sec = map.sections.find((s) => s.id === item.section)
  if (!sec) return map
  const lower = item.label.toLowerCase()
  if ([...sec.items, ...sec.earlier].some((i) => i.key === item.key || i.label.toLowerCase() === lower)) {
    return map
  }
  return withSection(map, item.section, (s) => {
    const at = s.items.findIndex(
      (i) => i.provenance !== 'mine' || (i.firstSeen ?? '') > (item.firstSeen ?? ''),
    )
    const items = at < 0 ? [...s.items, item] : [...s.items.slice(0, at), item, ...s.items.slice(at)]
    return recount({ ...s, items })
  })
}
