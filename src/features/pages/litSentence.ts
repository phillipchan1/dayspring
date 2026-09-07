// What is actually lit, said in words.
//
// The count line used to read `34 pages carrying “Tiffany”` — and it said that
// whether or not a marking was also on. Choosing Tiffany AND Scripture narrowed
// the wall to twelve pages and the sentence still named only Tiffany, so the
// one place the surface states its own filter was quietly wrong about it.
//
// Two grammars, because the two legs genuinely compose differently (see
// `matchSubjects` and `matchFacets`):
//
//   · SUBJECTS UNION — "Mom and David" means pages about EITHER, because you
//     are naming the people you want to read about. So they join with `or`.
//   · MARKINGS INTERSECT — "prayers and scripture" means both, because the
//     second word narrows the first. So they join with `and`.
//
// Every word here is a count or a label the reader chose. Nothing characterises
// the pages, and there is no adjective anywhere in it.

import { MARK_KIND } from '@/lib/markKinds'
import type { SpiritualItemType } from '@/lib/types'

/** `a, b and c` — an Oxford comma would be a fourth punctuation style here. */
function list(parts: string[], joiner: string): string {
  if (parts.length <= 1) return parts[0] ?? ''
  if (parts.length === 2) return `${parts[0]} ${joiner} ${parts[1]}`
  return `${parts.slice(0, -1).join(', ')} ${joiner} ${parts.at(-1)}`
}

export interface LitDescription {
  count: number
  /** The lit subjects' own labels, in the order they were lit. */
  subjects: string[]
  /** The lit markings, as kinds — labelled from the closed vocabulary. */
  markings: SpiritualItemType[]
  /** A question asked from ⌘K, which has no word to light. */
  question?: string | null
}

/**
 * The one sentence the surface says about itself.
 *
 * `2,969 pages`
 * `34 pages saying Tiffany`
 * `12 pages saying Tiffany and marked Scripture`
 * `88 pages marked Prayer and Scripture`
 * `9 pages matching “where did I feel far from God” and marked Prayer`
 *
 * "marked", not "carrying a prayer": the pills say Scripture and Prayer, and a
 * sentence that renames them is a second vocabulary for the same six things.
 */
export function litSentence({ count, subjects, markings, question }: LitDescription): string {
  const head = `${count.toLocaleString()} ${count === 1 ? 'page' : 'pages'}`
  const clauses: string[] = []
  if (question) clauses.push(`matching “${question}”`)
  if (subjects.length > 0) clauses.push(`saying ${list(subjects, 'or')}`)
  if (markings.length > 0) {
    const labels = markings.map((k) => MARK_KIND[k]?.label ?? k)
    clauses.push(`marked ${list(labels, 'and')}`)
  }
  return clauses.length === 0 ? head : `${head} ${clauses.join(' and ')}`
}
