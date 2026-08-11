// Bucket helpers — the only sanctioned way a count of user content reaches the
// analytics boundary.
//
// Why bucket at all, when a number is already not text? Because a precise count
// is an identifier. "Imported 3,460 entries spanning 11 years on the 2nd" picks
// exactly one person out of a beta cohort, and having carefully kept entry
// content out of the payload it would be silly to hand over a fingerprint
// instead. Buckets keep the shape of the distribution — which is all any of the
// four questions in MEASUREMENT.md actually needs — and drop the identity.
//
// The second reason is that buckets age better. Raw counts tempt you into
// averages, and an average entry count is one dashboard away from being shown
// to a user, which Principles 1 and 2 forbid. A histogram of coarse buckets is
// hard to accidentally turn into a score.
//
// These labels are ANALYTICS KEYS: permanent, per GLOSSARY. Re-cutting a
// boundary silently rewrites history, because old events keep the old label and
// nothing reconciles them. Add a bucket at the end of a scale if you must;
// never redefine one.

/** Coarse magnitude for anything countable. Boundaries are order-of-magnitude. */
export type CountBucket =
  | '0'
  | '1'
  | '2-10'
  | '11-50'
  | '51-200'
  | '201-1k'
  | '1k-5k'
  | '5k+'

/** How much history an archive covers. */
export type YearsBucket = 'under-1' | '1-2' | '3-5' | '6-10' | 'over-10'

/** How long ago something was written, for re-reading depth. */
export type AgeBucket = 'today' | 'this-week' | 'this-month' | 'this-year' | 'over-a-year'

export function countBucket(n: number): CountBucket {
  if (!Number.isFinite(n) || n <= 0) return '0'
  if (n === 1) return '1'
  if (n <= 10) return '2-10'
  if (n <= 50) return '11-50'
  if (n <= 200) return '51-200'
  if (n <= 1000) return '201-1k'
  if (n <= 5000) return '1k-5k'
  return '5k+'
}

export function yearsBucket(years: number): YearsBucket {
  if (!Number.isFinite(years) || years < 1) return 'under-1'
  if (years <= 2) return '1-2'
  if (years <= 5) return '3-5'
  if (years <= 10) return '6-10'
  return 'over-10'
}

/**
 * Years spanned by an ISO date range, inclusive-ish.
 *
 * Deliberately crude: this is feeding a five-bucket scale, so leap years and
 * time zones cannot change the answer except exactly on a boundary, where
 * either side is equally true.
 */
export function yearsBetween(earliestIso: string, latestIso: string): number {
  const a = Date.parse(earliestIso)
  const b = Date.parse(latestIso)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  return Math.abs(b - a) / (365.25 * 24 * 60 * 60 * 1000)
}

export function ageBucket(iso: string, now: number = Date.now()): AgeBucket {
  const then = Date.parse(iso)
  if (!Number.isFinite(then)) return 'over-a-year'
  const days = (now - then) / (24 * 60 * 60 * 1000)
  if (days < 1) return 'today'
  if (days < 7) return 'this-week'
  if (days < 31) return 'this-month'
  if (days < 366) return 'this-year'
  return 'over-a-year'
}
