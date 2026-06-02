// Reads the cumulative changelog that CI bundles into the app at
// public/changelog.json (see scripts/assemble-changelog.mjs). Same-origin fetch
// of a bundled asset — no network/CORS. Absent on web/dev builds, where it
// simply resolves to an empty list and the Settings section hides itself.

export interface ChangelogEntry {
  version: string
  date: string
  notes: string
}

// Entries we render compactly (collapsed into a count) rather than calling out:
// the generic "nothing user-facing" line, empties, and the legacy
// "Automated build from <sha>" notes from before human notes existed.
const GENERIC = /^(✨\s*)?(minor improvements|a little polish|automated build from)/i

export function isMinor(notes: string): boolean {
  const t = notes.trim()
  return !t || GENERIC.test(t)
}

let cache: ChangelogEntry[] | null = null

export async function loadChangelog(): Promise<ChangelogEntry[]> {
  if (cache) return cache
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}changelog.json`, { cache: 'no-store' })
    if (!res.ok) return (cache = [])
    const data = (await res.json()) as { versions?: ChangelogEntry[] }
    cache = Array.isArray(data?.versions) ? data.versions : []
  } catch {
    cache = []
  }
  return cache
}
