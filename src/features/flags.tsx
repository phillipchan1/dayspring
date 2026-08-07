import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'

/** Map of flag key → Vite env variable name. */
const FLAG_ENV: Record<string, string> = {
  threadsRopes: 'VITE_FF_THREADS_ROPES',
  altar: 'VITE_FF_ALTAR',
  // The Concordance drawer (Settings → About). Off by default — the fidelity
  // engine populates silently; this only exposes the inspect/curate UI. Enable
  // per-user via profiles.feature_flags or VITE_FF_CONCORDANCE=true.
  concordance: 'VITE_FF_CONCORDANCE',
  // Remember (what you've set apart, and ask the rest). Off by default while it
  // proves out. Hiding the flag hides only the nav affordances — the mobile tab
  // and the desktop rail button. The ⌘K Find palette and the route itself are
  // untouched, so ⌘K → Ask still lands somewhere real.
  remember: 'VITE_FF_REMEMBER',
  // Pages — the read surface (the wall, the Spread). Off by default while it
  // proves out. Hiding the flag hides only the "Pages" segment in the Entries
  // view switcher; the route itself stays reachable so a saved history frame
  // never dead-ends.
  pages: 'VITE_FF_PAGES',
}

/**
 * Flags that have graduated — shipped to everyone, gate retained only so the
 * `useFeatureFlag('x')` call sites don't have to be torn out at once.
 */
const GRADUATED = new Set<string>(['altar'])

/**
 * Resolve a feature flag for a given user.
 *
 * Resolution order:
 *   0. Graduated: on for everyone.
 *   1. Per-user override: profiles.feature_flags (text[]) read once on boot.
 *   2. Env default: VITE_FF_<KEY> === 'true'.
 *   3. Off.
 *
 * // TODO: wire real A/B bucketing — for now, assignment is manual via the
 * // profiles.feature_flags jsonb field (set 'threadsRopes' in the array).
 */
export function resolveFlag(flags: string[], key: string): boolean {
  if (GRADUATED.has(key)) return true
  if (flags.includes(key)) return true
  const envKey = FLAG_ENV[key]
  return envKey !== undefined && import.meta.env[envKey] === 'true'
}

const FeatureFlagContext = createContext<string[]>([])

/** Wrap JournalScreen (or any subtree) to make flags available via useFeatureFlag. */
export function FeatureFlagProvider({
  flags,
  children,
}: {
  flags: string[]
  children: ReactNode
}) {
  return <FeatureFlagContext.Provider value={flags}>{children}</FeatureFlagContext.Provider>
}

/** Read a single feature flag from the nearest FeatureFlagProvider. */
export function useFeatureFlag(key: string): boolean {
  return resolveFlag(useContext(FeatureFlagContext), key)
}
