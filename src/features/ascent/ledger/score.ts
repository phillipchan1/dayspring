/**
 * THE YEAR'S LEDGER — scoring.
 *
 * What a year "was about" is decided here, in code, from things the writer did:
 * came back to a subject month after month, came back to it after going quiet,
 * saw it move (a prayer answered, a prayer that later turns up as something
 * sensed or learned), and set entries about it apart themselves. No model reads
 * the year to decide what mattered; it would decide by what quotes well, and
 * the plain, unquotable thing someone prayed about for ten months would lose to
 * one lovely week away (prototypes/ledger shows exactly that).
 *
 * This is ranking for ARRANGEMENT, never a verdict. The number is never shown
 * to the writer — it only decides which threads the Summit lays out, and in
 * what order.
 */

export interface ScoreFacts {
  /** Distinct months the subject appears in. */
  months: number
  /** Entries that carry it. */
  mentions: number
  /** Times it came back after two or more quiet months. */
  returns: number
  /** Answered prayers + turns (prayer → sensed / learned). */
  movement: number
  /** Entries about it the writer set apart (heading, highlight, ritual, long). */
  marked: number
}

export interface Weights {
  persist: number
  ret: number
  move: number
  marked: number
  volume: number
  /** 0–1: how hard to damp a subject present in every earlier year. */
  damp: number
}

/** Tuned on the prototype's synthetic year; see prototypes/ledger. */
export const DEFAULT_WEIGHTS: Weights = { persist: 1, ret: 1.5, move: 2, marked: 1, volume: 0.5, damp: 0.8 }

/** How many quiet months count as "going quiet" before a return. */
export const QUIET_GAP = 2

/** Month-by-month counts (index 0 = January) → months present + returns. */
export function presence(perMonth: readonly number[], throughMonth = perMonth.length): Pick<ScoreFacts, 'months' | 'mentions' | 'returns'> {
  let months = 0
  let mentions = 0
  let returns = 0
  let last = -1
  for (let i = 0; i < Math.min(throughMonth, perMonth.length); i++) {
    const n = perMonth[i] ?? 0
    if (n <= 0) continue
    months++
    mentions += n
    if (last >= 0 && i - last - 1 >= QUIET_GAP) returns++
    last = i
  }
  return { months, mentions, returns }
}

/**
 * The score. `prior` is the share of the writer's EARLIER years this subject
 * appeared in (0–1): a name that has been on every page for a decade is
 * constant, and constant is not the same as significant.
 */
export function score(f: ScoreFacts, prior: number, w: Weights = DEFAULT_WEIGHTS): number {
  const raw =
    w.persist * f.months +
    w.ret * f.returns +
    w.move * f.movement +
    w.marked * f.marked +
    w.volume * Math.log2(1 + f.mentions)
  const keep = 1 - w.damp * Math.min(1, Math.max(0, prior))
  return raw * keep
}
