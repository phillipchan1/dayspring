/**
 * Derivation. Everything the app knows about domains is computed here, from
 * heading lines that already exist in the prose.
 *
 * The design law lives in this file, because a law you only write in a doc is a
 * law you break in a component:
 *
 *   1. There is no way to create a domain. `domainsOf()` is the only source,
 *      and it reads headings. Nothing takes a domain as an argument to add one.
 *   2. Nothing is ever ordered by count. The two orderings are BY FIRST OPENED
 *      and BY LAST WRITTEN, and they are the only two exported.
 *   3. `linesIn()` returns every line. There is no limit parameter.
 *   4. `questionsIn()` filters on whether a line ends in a question mark, which
 *      is a fact about punctuation. No model, no meaning.
 */

import { ENTRIES, OTHER_ENTRIES, TODAY, type Entry } from './corpus'

const HEADING = /^##\s+(.+?)\s*$/

export type Line = {
  entryId: string
  date: string
  /** The domain heading this line was written under, or null if it was written under none. */
  domain: string | null
  text: string
  /** Index into the entry's paragraphs — so a quote can be a pointer, not a copy. */
  para: number
}

export type Domain = {
  /** The writer's own word, exactly as typed. */
  label: string
  firstOpened: string
  lastWritten: string
  /** Every date on which something was written under it. */
  dates: string[]
}

export function headingLabel(paragraph: string): string | null {
  const m = HEADING.exec(paragraph)
  return m ? m[1]! : null
}

/** Every line in the journal, in time, each carrying the heading it sits under. */
export function linesOf(entries: Entry[] = ENTRIES): Line[] {
  const out: Line[] = []
  for (const entry of entries) {
    let domain: string | null = null
    entry.paragraphs.forEach((text, para) => {
      const label = headingLabel(text)
      if (label !== null) {
        domain = label
        return
      }
      out.push({ entryId: entry.id, date: entry.date, domain, text, para })
    })
  }
  return out
}

/**
 * The domains. Not a list we keep — a list we notice. A domain is here because
 * someone typed `## it` and then wrote something underneath.
 */
export function domainsOf(entries: Entry[] = ENTRIES, before?: string): Domain[] {
  const byLabel = new Map<string, Domain>()
  for (const line of linesOf(entries)) {
    if (line.domain === null) continue
    if (before && line.date >= before) continue
    const existing = byLabel.get(line.domain)
    if (!existing) {
      byLabel.set(line.domain, {
        label: line.domain,
        firstOpened: line.date,
        lastWritten: line.date,
        dates: [line.date],
      })
      continue
    }
    existing.lastWritten = line.date
    if (existing.dates[existing.dates.length - 1] !== line.date) existing.dates.push(line.date)
  }
  return [...byLabel.values()]
}

/** The house. Oldest first — the order the writer opened them. */
export function domainsByFirstOpened(entries: Entry[] = ENTRIES, before?: string): Domain[] {
  return domainsOf(entries, before).sort((a, b) => a.firstOpened.localeCompare(b.firstOpened))
}

/**
 * The sit-down. Most recently written first, so the quiet ones sit at the
 * bottom. This is the ONLY thing that says a domain has gone quiet — no date,
 * no count, no copy.
 */
export function domainsByLastWritten(entries: Entry[] = ENTRIES, before?: string): Domain[] {
  return domainsOf(entries, before).sort((a, b) => b.lastWritten.localeCompare(a.lastWritten))
}

/** Every line written under a domain, in time. All of it — there is no limit. */
export function linesIn(domain: string, before?: string): Line[] {
  return linesOf().filter((l) => l.domain === domain && (!before || l.date < before))
}

/** The lines under a domain that end in a question mark. Punctuation, not meaning. */
export function questionsIn(domain: string, before?: string): Line[] {
  return linesIn(domain, before).filter((l) => l.text.trim().endsWith('?'))
}

/** The last thing the writer said in this domain before now. */
export function lastLineIn(domain: string, before: string = TODAY): Line | null {
  const lines = linesIn(domain, before)
  return lines.length ? lines[lines.length - 1]! : null
}

/**
 * The headings this writer has used, most recently used first. This is what the
 * `##` completion offers. Its job is spelling, not meaning: it exists so that
 * `frontier` does not become frontier / Frontier / Front.
 */
export function headingsUsed(before: string = TODAY): string[] {
  return domainsByLastWritten(ENTRIES, before).map((d) => d.label)
}

/** The other writer, for the house scene. Same derivation, nothing shared. */
export function otherDomains(): Domain[] {
  return domainsByFirstOpened(OTHER_ENTRIES)
}

// ── The model's one job ────────────────────────────────────────────────────
//
// It picks a pair of the writer's own lines from the same domain, years apart.
// It is stored as POINTERS — entry id and paragraph index. The text below is
// what the model returned, kept only so the validator can prove it is a
// verbatim substring of the entry. That is the same check the real pipeline
// runs before it will persist anything a model produced.

export const RHYME = {
  domain: 'frontier',
  then: {
    entryId: 'e-2022-11-05',
    para: 1,
    text: 'I still do the parts nobody sees, which I notice I like more than I should.',
  },
  now: {
    entryId: 'e-2026-08-22',
    para: 1,
    text: 'Sat in the back again and not once wanted the headset back.',
  },
} as const

/** What we will not render. Kept as a fixture so the refusal can be shown, not claimed. */
export const REFUSED =
  'Over the past four years you have gradually released control at Frontier, moving from a hands-on operator to a trusting delegator. This growth suggests a healthy spiritual maturation around identity and service.'

// ── Formatting ─────────────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${MONTHS[Number(m) - 1]} ${Number(d)}, ${y}`
}

export function formatMonthYear(iso: string): string {
  const [y, m] = iso.split('-')
  return `${MONTHS[Number(m) - 1]} ${y}`
}

/** 0..1 across the whole journal, for placing a mark on a band. */
export function positionOf(iso: string, from: string, to: string): number {
  const t = Date.parse(iso)
  const a = Date.parse(from)
  const b = Date.parse(to)
  return b === a ? 0 : (t - a) / (b - a)
}

export function span(entries: Entry[] = ENTRIES): { from: string; to: string } {
  const dates = entries.map((e) => e.date).sort()
  return { from: dates[0]!, to: dates[dates.length - 1]! }
}

// ── Invariants ─────────────────────────────────────────────────────────────

/**
 * Loud in dev. Three of these are the product's own rules, and a fixture that
 * quietly breaks one is a prototype that proves nothing.
 */
export function validateDomains(): string[] {
  const problems: string[] = []
  const entryById = new Map(ENTRIES.map((e) => [e.id, e]))

  // Every heading is followed by something written. The app never shows an
  // empty domain because an empty domain cannot exist.
  for (const entry of [...ENTRIES, ...OTHER_ENTRIES]) {
    entry.paragraphs.forEach((p, i) => {
      if (headingLabel(p) === null) return
      const next = entry.paragraphs[i + 1]
      if (next === undefined || headingLabel(next) !== null) {
        problems.push(`${entry.id}: heading "${p}" has nothing written under it`)
      }
    })
  }

  // Chronological, so "in time" means what it says.
  for (let i = 1; i < ENTRIES.length; i++) {
    if (ENTRIES[i]!.date < ENTRIES[i - 1]!.date) {
      problems.push(`${ENTRIES[i]!.id}: out of order`)
    }
  }

  // The model's pick is a pointer. Its text must be verbatim.
  for (const side of [RHYME.then, RHYME.now]) {
    const entry = entryById.get(side.entryId)
    const actual = entry?.paragraphs[side.para]
    if (actual === undefined) {
      problems.push(`rhyme: ${side.entryId}[${side.para}] does not exist`)
    } else if (!actual.includes(side.text)) {
      problems.push(`rhyme: not verbatim in ${side.entryId}[${side.para}] — "${side.text}"`)
    }
  }

  // Both halves of the rhyme must actually be in the domain it claims.
  for (const side of [RHYME.then, RHYME.now]) {
    const inDomain = linesIn(RHYME.domain).some(
      (l) => l.entryId === side.entryId && l.para === side.para,
    )
    if (!inDomain) problems.push(`rhyme: ${side.entryId}[${side.para}] is not under ${RHYME.domain}`)
  }

  return problems
}
