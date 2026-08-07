// Pure name → (gender, age) estimation, split out of scripts/demographics.ts so
// the arithmetic can be tested. No IO, no database, no network.
//
// Everything here is population-level. Per person these numbers mean nothing —
// see the header of demographics.ts for why that distinction is the entire
// design, and why none of this is ever written back to a row.

/** Aggregate SSA record for one name, over the birth-year window we kept. */
export interface NameStats {
  male: number
  female: number
  /** birth year → births recorded with this name */
  years: Map<number, number>
}

/** Birth years that could plausibly belong to an adult user today. */
export const MIN_BIRTH_YEAR = 1930
export function maxBirthYear(thisYear: number): number {
  return thisYear - 18
}

/**
 * Fold one `yobNNNN.txt` (lines of `Name,Sex,Count`) into the index.
 * Unparseable lines are skipped — the dataset has a trailing newline and the
 * occasional oddity, and one bad row must not lose the year.
 */
export function ingestSsaYear(
  index: Map<string, NameStats>,
  year: number,
  text: string,
): void {
  for (const line of text.split('\n')) {
    const parts = line.trim().split(',')
    if (parts.length !== 3) continue
    const [rawName, sex, rawCount] = parts as [string, string, string]
    if (sex !== 'M' && sex !== 'F') continue
    const count = Number(rawCount)
    if (!Number.isFinite(count) || count <= 0) continue

    const key = rawName.toLowerCase()
    let stats = index.get(key)
    if (!stats) {
      stats = { male: 0, female: 0, years: new Map() }
      index.set(key, stats)
    }
    if (sex === 'M') stats.male += count
    else stats.female += count
    stats.years.set(year, (stats.years.get(year) ?? 0) + count)
  }
}

/**
 * First token of a display name, if it looks like a name at all.
 *
 * Deliberately conservative: a handle, an email local-part, or an initial
 * returns null and the account drops out of the denominator, which the report
 * shows as reduced coverage. Guessing on thin evidence would quietly inflate
 * the sample instead.
 */
export function firstName(full: string | null | undefined): string | null {
  if (!full) return null
  const token = full.trim().split(/\s+/)[0] ?? ''
  // Reject handles and email local-parts on the RAW token. This has to happen
  // before the punctuation trim below, or "user1234" gets trimmed down to a
  // perfectly respectable-looking "user" and is counted as a name.
  if (/[\d_@]/.test(token)) return null
  // Trim surrounding punctuation; keep internal hyphens and apostrophes, which
  // are part of plenty of real names.
  const cleaned = token.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '').toLowerCase()
  if (cleaned.length < 2) return null
  return cleaned
}

/**
 * P(female | name), or null when the name is unknown.
 *
 * Callers must SUM these rather than thresholding them per person. Summing
 * expectations over a population is unbiased; labelling each user and counting
 * labels throws away the uncertainty and biases toward whichever gender owns
 * the ambiguous names.
 */
export function pFemale(stats: NameStats | undefined): number | null {
  if (!stats) return null
  const births = stats.male + stats.female
  if (births <= 0) return null
  return stats.female / births
}

export const AGE_BANDS: ReadonlyArray<readonly [string, number, number]> = [
  ['18–24', 18, 24],
  ['25–34', 25, 34],
  ['35–44', 35, 44],
  ['45–54', 45, 54],
  ['55–64', 55, 64],
  ['65+', 65, Infinity],
]

export function ageBand(age: number): string {
  for (const [label, lo, hi] of AGE_BANDS) {
    if (age >= lo && age <= hi) return label
  }
  // Younger than the window we kept; the caller filtered these out already.
  return AGE_BANDS[0]![0]
}

/**
 * One person's contribution to the population age histogram: their name's whole
 * normalised birth-year distribution, not a single point estimate.
 *
 * A point estimate would say every Jordan is 31. The mixture says Jordans are
 * spread over 1985–2005 with a peak, which is true, and summing those spreads
 * across everyone gives an age distribution that reflects real uncertainty.
 * Weights sum to 1 per person, so nobody counts twice.
 */
export function ageMixture(
  stats: NameStats,
  thisYear: number,
): Array<{ band: string; weight: number; age: number }> {
  const total = [...stats.years.values()].reduce((a, b) => a + b, 0)
  if (total <= 0) return []
  const out: Array<{ band: string; weight: number; age: number }> = []
  for (const [year, count] of stats.years) {
    const age = thisYear - year
    out.push({ band: ageBand(age), weight: count / total, age })
  }
  return out
}
