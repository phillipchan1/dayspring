// URL scrubbing for outbound usage events.
//
// Deliberately its own module with ZERO imports: this is the single most
// safety-critical function in the analytics path, and it needs to be testable
// in a node environment with no DOM, no vendor SDK, and no chance of a network
// call sneaking into the test run.
//
// The problem it solves is that posthog-js attaches the current URL to every
// event it sends — not only to pageviews, which we have disabled — and the
// address bar in this app is not as harmless as it looks:
//
//   • Supabase OAuth returns with `#access_token=...` in the hash.
//     `stripAuthUrlNoise()` clears it, but from an effect inside AppNavigation,
//     which runs AFTER the SDK can already have captured. An access token in a
//     third party's logs is an incident, not an untidiness.
//   • Stripe returns with `?checkout=success`.
//   • Entry ids are not in the path today (appHistoryUrl only ever writes `/`
//     or `/lamp`) — but that is a property of the current router, not a
//     guarantee. This is the line that keeps it true if the router changes.
//
// So: keep the path, drop everything else. The path is what distinguishes the
// Lamp from the journal, which is all any question in MEASUREMENT.md needs.

/**
 * Property names whose values are full URLs, in every variant posthog-js emits.
 *
 * `$referring_domain` and `$host` are deliberately NOT here. They are bare
 * hostnames — no path, no query, no fragment, so nothing to leak — and running
 * them through pathOnly() would turn `google.com` into `/google.com`, which
 * destroys the one signal that answers "which front door did they come in by"
 * (D-001) in exchange for no privacy at all. Scrub what can carry a secret;
 * leave what can't.
 */
const URL_PROP = /(^\$?(initial_)?(current_url|pathname|referrer)$)|url$/i

/**
 * Reduce a URL-shaped string to its path. Non-strings pass through untouched;
 * anything unparseable becomes '/' rather than leaking a half-parsed original.
 *
 * The base is a `.invalid` host (RFC 2606) so a relative input still parses and
 * cannot, even in principle, resolve against a real origin.
 */
export function pathOnly(value: unknown): unknown {
  if (typeof value !== 'string' || !value) return value
  try {
    return new URL(value, 'https://dayspring.invalid').pathname
  } catch {
    return '/'
  }
}

/** Apply pathOnly to every URL-shaped property of an outbound payload. */
export function scrubProperties(props: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(props)) {
    out[key] = URL_PROP.test(key) ? pathOnly(value) : value
  }
  return out
}
