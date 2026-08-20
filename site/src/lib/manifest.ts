/**
 * The app manifest — what the help site is allowed to say about Dayspring.
 *
 * Both files are written by CI (see .github/workflows/support-manifest.yml);
 * nothing here is hand-edited.
 *
 *   app-manifest.json        generated from `stable`. What beta/production
 *                            users actually have. This is what gets PUBLISHED.
 *   app-manifest.alpha.json  generated from `master`. The full vocabulary of
 *                            valid feature ids, including things not shipped
 *                            to stable yet.
 *
 * The two-file split is what lets an article distinguish between:
 *
 *   "this feature doesn't exist"      → a typo or a deleted feature. Hard fail.
 *   "this feature isn't on stable yet" → hide the article; publish it by itself
 *                                        the moment the feature merges down.
 */

import stableManifest from "../content/generated/app-manifest.json";
import alphaManifest from "../content/generated/app-manifest.alpha.json";

export interface ManifestEntry {
  id: string;
  [key: string]: unknown;
}

export interface AppManifest {
  schema: number;
  appVersion: string;
  channel: string;
  categories: Record<string, ManifestEntry[]>;
  values: Record<string, string | number>;
}

export const stable = stableManifest as AppManifest;
export const alpha = alphaManifest as AppManifest;

/**
 * When set, hidden (not-yet-on-stable) articles are built anyway.
 *
 * For previewing alpha docs locally — `SUPPORT_CHANNEL=alpha npm run build`.
 * Never set in the production Vercel project.
 */
// Read defensively: this module is imported from build-time code where `process`
// exists, but nothing here should assume Node types are installed.
export const previewingAlpha =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.SUPPORT_CHANNEL === "alpha";

/** The manifest whose contents get published. */
export const published: AppManifest = previewingAlpha ? alpha : stable;

function idsOf(m: AppManifest): Set<string> {
  return new Set(Object.values(m.categories).flatMap((entries) => entries.map((e) => e.id)));
}

/** Feature ids present on the published channel. */
export const publishedIds: Set<string> = idsOf(published);

/** Every id that is a real feature on any channel — the valid vocabulary. */
export const knownIds: Set<string> = new Set([...idsOf(stable), ...idsOf(alpha)]);

/** Every token name resolvable in prose, across both channels. */
export const knownTokens: Set<string> = new Set([
  ...Object.keys(stable.values),
  ...Object.keys(alpha.values),
]);

export type RequirementStatus = "ok" | "not-yet-shipped" | "unknown";

/**
 * Classify a `requires:` id.
 *
 * The distinction is the whole point: `unknown` is an authoring error that must
 * break the build, `not-yet-shipped` is the ordinary state of a doc written
 * ahead of a release.
 */
export function classifyRequirement(id: string): RequirementStatus {
  if (publishedIds.has(id)) return "ok";
  if (knownIds.has(id)) return "not-yet-shipped";
  return "unknown";
}

/** Entries of a category on the published channel. */
export function category(name: string): ManifestEntry[] {
  return published.categories[name] ?? [];
}

/** Look up a single entry by id, or null. */
export function entry(id: string): ManifestEntry | null {
  for (const entries of Object.values(published.categories)) {
    const found = entries.find((e) => e.id === id);
    if (found) return found;
  }
  return null;
}

/**
 * Resolve a `{{token}}` to its published value.
 *
 * Throws rather than returning a placeholder: an unresolved token would render
 * literally as "{{billing.trial-days}}" on a live page, and a silently-empty
 * one would read as a missing fact.
 */
export function value(token: string): string | number {
  const v = published.values[token];
  if (v === undefined) {
    const hint = knownTokens.has(token)
      ? `It exists on another channel but not on "${published.channel}".`
      : `Known tokens: ${[...knownTokens].sort().join(", ")}`;
    throw new Error(`Unknown manifest token {{${token}}}. ${hint}`);
  }
  return v;
}
