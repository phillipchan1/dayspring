import { ENTRIES, formatDate, formatMonthYear, yearOf, type Entry } from '../corpus'
import { COMMON, allMonths, burstsFor, hits, plural, quietSpell } from '../lib'
import { Wall, type Why } from '../Wall'
import type { Held } from '../subjects'

/**
 * The readings.
 *
 * Shared by the wall and by a subject's chapter, because a reading is a way of
 * arranging pages and it should not care how the pages were chosen. That is
 * also what makes `the words you used` reachable without picking a subject
 * first — and archive-scoped is its safest form anyway, since RECALL takes a
 * vocabulary comparison OFF person pages and leaves it on the archive.
 */

/**
 * Every month it appears, one row per subject.
 *
 * Rhythm and gaps, and NO HEIGHT ANYWHERE. A bar chart of mentions-per-month
 * has a Y axis, and a falling one reads as "you care less about your mother
 * now" — a verdict on a relationship rendered by a machine. Every cell is the
 * same size; only its warmth changes, and warmth has no better and worse.
 *
 * With two subjects on there are two rows against the same months, which is the
 * one thing this shape can do that a list cannot: where they overlap is visible
 * without anybody computing an overlap.
 */
export function Band({ series }: { series: { label: string; dates: string[] }[] }) {
  const months = allMonths()
  return (
    <div className="bands">
      {series.map((s) => {
        const per = new Map<string, number>()
        for (const d of s.dates) per.set(d.slice(0, 7), (per.get(d.slice(0, 7)) ?? 0) + 1)
        const most = Math.max(1, ...per.values())
        return (
          <div className="bandrow" key={s.label}>
            {series.length > 1 ? <span className="bandrow__who">{s.label}</span> : null}
            <div className="band" role="img" aria-label={`${s.label}: ${s.dates.length} pages across the months`}>
              {months.map((m) => {
                const n = per.get(m) ?? 0
                const t = n === 0 ? 0 : 0.35 + (n / most) * 0.65
                return (
                  <span
                    className="band__m"
                    key={m}
                    title={`${formatMonthYear(`${m}-01`)}${n ? ` · ${n}` : ''}`}
                    data-on={n > 0 ? 'true' : undefined}
                    style={n > 0 ? ({ ['--t' as string]: t } as React.CSSProperties) : undefined}
                  />
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function SpanPick({ split, years, onSplit }: { split: number; years: number[]; onSplit: (y: number) => void }) {
  return (
    <div className="spanpick">
      <span>divide at</span>
      {years.map((y) => (
        <button type="button" key={y} data-on={split === y ? 'true' : undefined} onClick={() => onSplit(y)}>
          {y}
        </button>
      ))}
    </div>
  )
}

/**
 * Then, and now. Two columns of pages, and nothing between them.
 *
 * No arrow, ever — an arrow from the left column to the right one is a vertical
 * axis laid on its side, the app asserting a direction of travel through
 * someone's life.
 *
 * The page count for each span stays on screen. A comparison across uneven
 * spans is not a finding, it is a volume difference, and it reads as a verdict
 * on the thinner side. Normalising into a rate would be worse: a rate is a
 * metric and a metric is a score.
 */
export function ThenNow({
  entries,
  split,
  years,
  onSplit,
  why,
  match,
  onOpen,
}: {
  entries: Entry[]
  split: number
  years: number[]
  onSplit: (y: number) => void
  why?: Map<string, Why>
  match: RegExp | null
  onOpen?: (id: string) => void
}) {
  const before = entries.filter((e) => yearOf(e.date) < split)
  const after = entries.filter((e) => yearOf(e.date) >= split)
  const wroteBefore = ENTRIES.filter((e) => yearOf(e.date) < split).length
  const wroteAfter = ENTRIES.filter((e) => yearOf(e.date) >= split).length

  return (
    <>
      <SpanPick split={split} years={years} onSplit={onSplit} />
      <div className="twospan">
        <section>
          <p className="pair__h">before {split}</p>
          <p className="pair__count">
            {plural(before.length, 'page', 'pages')} · out of {wroteBefore} written
          </p>
          <Wall entries={before} why={why} match={match} cols={2} maxLines={8} glyphs onOpen={onOpen} />
        </section>
        <section>
          <p className="pair__h">{split} onward</p>
          <p className="pair__count">
            {plural(after.length, 'page', 'pages')} · out of {wroteAfter} written
          </p>
          <Wall entries={after} why={why} match={match} cols={2} maxLines={8} glyphs onOpen={onOpen} />
        </section>
      </div>
    </>
  )
}

/**
 * Stretches bounded by silence.
 *
 * A story in a journal is not a theme, it is an EPISODE — and an episode has a
 * detectable shape: a burst of entries with quiet on both sides. That is
 * arithmetic. A gap opens a burst; a burst has to be dense enough that five
 * entries spread across three months does not count, because that is a season
 * and calling it an episode would be the app deciding something happened.
 *
 * **Every heading is a count.** "Five entries in 59 days, after 10 quiet
 * months" is a fact anyone can check against the pages below it. A title would
 * be a claim about what it was, and the writer is the only one who gets to make
 * that claim.
 */
export function Bursts({
  subjects,
  entries,
  why,
  match,
  onOpen,
}: {
  subjects: Held[]
  entries: Entry[]
  why?: Map<string, Why>
  match: RegExp | null
  onOpen?: (id: string) => void
}) {
  const ids = new Set(entries.map((e) => e.id))
  const groups = subjects.length
    ? subjects.flatMap((s) => burstsFor(s))
    : burstsFor({ key: 'all', label: 'all', terms: [], kind: 'matter' }, { quiet: 40, min: 3, maxGap: 12 })

  const real = groups
    .map((b) => ({ ...b, entries: b.entries.filter((e) => ids.has(e.id)) }))
    .filter((b) => b.entries.length >= 2)
    .sort((a, b) => a.entries[0]!.date.localeCompare(b.entries[0]!.date))

  if (real.length === 0) {
    return (
      <div className="empty">
        <h2>Nothing clustered.</h2>
        <p>You have written about this steadily rather than in stretches.</p>
      </div>
    )
  }

  return (
    <div className="bursts">
      {real.map((b, i) => (
        <section className="burst" key={i}>
          {/* plural() already carries the number — see lib.ts. */}
          <p className="burst__count">
            {plural(b.entries.length, 'entry', 'entries')} in {plural(b.days, 'day', 'days')}
            {b.quietDaysBefore > 60 ? <>, after {quietSpell(b.quietDaysBefore)}</> : null}
          </p>
          <Wall entries={b.entries} why={why} match={match} cols={5} maxLines={7} glyphs onOpen={onOpen} />
        </section>
      ))}
    </div>
  )
}

/**
 * The words she used, then and now.
 *
 * ── This is the sentiment question, answered the only legal way ─────────────
 *
 * The obvious build is a mood line: score each entry, plot it, show the curve.
 * It is forbidden three times over and every one is load-bearing:
 *
 *   · GUARDRAILS H2 — never infer someone's interior state.
 *   · Principle 1 — no vertical axis, because a vertical axis implies better
 *     and worse. A falling curve over a subject called "Mom" reads as *you care
 *     less about your mother now*.
 *   · D-016 — the writer supplies the signal.
 *
 * What IS sanctioned is her own vocabulary. GUARDRAILS' approved example is
 * literally "'Angry' appears in 7 entries this month".
 *
 * ── The rules that keep it there ────────────────────────────────────────────
 *
 *   · NO NUMBER beside any word, and no ordering by frequency. First
 *     appearance is the order; a ranking turns order into significance.
 *   · No sorting into good and bad. Sorting by valence is scoring by the back
 *     door.
 *   · The page count for each span is always on screen.
 *   · Nothing says "more", "less" or "instead". The columns sit side by side
 *     and the reader draws the conclusion — which per RECALL is "theirs to
 *     draw, and the most meaningful thing in the product precisely because the
 *     app didn't hand it to them."
 *
 * ── Scope ───────────────────────────────────────────────────────────────────
 *
 * RECALL keeps this **archive-scoped and off person pages**: on a matter it is
 * a portrait of her own interior life; on her husband it reads as a portrait of
 * the marriage, and a bad month puts a bad word at the top. It runs on the
 * whole archive here by default, which is the sanctioned form. Narrowed to a
 * subject it is the argument still to have.
 */
/** A word has to turn up in this many separate entries in a span to count. */
const FLOOR = 2

export function WordsUsed({
  entries,
  terms,
  split,
  years,
  onSplit,
}: {
  entries: Entry[]
  terms: string[]
  split: number
  years: number[]
  onSplit: (y: number) => void
}) {
  const before = entries.filter((e) => yearOf(e.date) < split)
  const after = entries.filter((e) => yearOf(e.date) >= split)

  /*
   * A word has to appear in more than one entry in its span.
   *
   * Without a floor this returns every noun in four years and reads as a word
   * cloud, which is unreadable and therefore useless. The floor is the ONLY
   * legal way to shorten it: "appears in at least two entries" is arithmetic
   * about the text, where "the most significant thirty" would be selection, and
   * selection is significance, and significance is a verdict (D-016).
   *
   * It also happens to be the truer question. A word said once is a word she
   * used; a word said in two separate sittings is a word she uses.
   */
  const words = (list: Entry[]) => {
    const seen = new Map<string, { n: number; first: string }>()
    for (const e of list) {
      const here = new Set<string>()
      for (const p of e.paragraphs) {
        // With a subject on, only the lines that name it — otherwise the whole page.
        if (terms.length && !hits(p, terms)) continue
        for (const w of p.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/)) {
          if (w.length > 3 && !COMMON.has(w) && !terms.includes(w)) here.add(w)
        }
      }
      for (const w of here) {
        const held = seen.get(w)
        if (held) held.n += 1
        else seen.set(w, { n: 1, first: e.date })
      }
    }
    const out = new Map<string, string>()
    for (const [w, v] of seen) if (v.n >= FLOOR) out.set(w, v.first)
    return out
  }

  const wasThen = words(before)
  const isNow = words(after)
  // Ordered by first appearance. Never by count — there is no count.
  const byFirst = (a: [string, string], b: [string, string]) => a[1].localeCompare(b[1])
  const started = [...isNow.entries()].filter(([w]) => !wasThen.has(w)).sort(byFirst)
  const stopped = [...wasThen.entries()].filter(([w]) => !isNow.has(w)).sort(byFirst)

  return (
    <>
      <SpanPick split={split} years={years} onSplit={onSplit} />
      <div className="twospan">
        <Column head={`you were saying, before ${split}`} pages={before.length} words={stopped} none="Nothing you stopped saying." />
        <Column head={`you are saying, since ${split}`} pages={after.length} words={started} none="Nothing new." />
      </div>
    </>
  )
}

function Column({
  head,
  pages,
  words,
  none,
}: {
  head: string
  pages: number
  words: [string, string][]
  none: string
}) {
  return (
    <section>
      <p className="pair__h">{head}</p>
      {/* The floor is stated, not hidden. A rule you cannot see is a rule you cannot check. */}
      <p className="pair__count">
        out of {plural(pages, 'page', 'pages')} · words you wrote on more than one day
      </p>
      <p className="words">
        {words.length ? (
          words.map(([w]) => (
            <span className="words__w" key={w}>
              {w}
            </span>
          ))
        ) : (
          <span className="words__none">{none}</span>
        )}
      </p>
    </section>
  )
}

export { formatDate }
