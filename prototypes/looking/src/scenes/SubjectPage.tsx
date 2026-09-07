import { useMemo } from 'react'
import { ENTRIES, formatDate, type MarkingKind } from '../corpus'
import { hits, plural, spanOf } from '../lib'
import { DECLARED } from '../kinds'
import { Glyph } from '../Glyph'
import { Wall, matcherFor, type Why } from '../Wall'
import { Rows } from '../Rows'
import { colsAt, linesAt, standAt } from '../zoom'
import { Band, Bursts, ThenNow, WordsUsed } from './Results'
import type { Held } from '../subjects'
import type { Reading } from '../FilterBar'

/**
 * A chapter — one subject, or a few, and the pages that carry them.
 *
 * ── Several subjects, and why they UNION ────────────────────────────────────
 *
 * An earlier version allowed exactly one, on the reasoning that a chapter is
 * about one thing. That is true of a chapter and false of a life: Mom and David
 * are not a query, they are the two people in most of these pages, and wanting
 * to see both is the most ordinary thing a person could ask.
 *
 * Subjects UNION; markings INTERSECT. That split is not arbitrary — it is what
 * the words mean when you say them out loud. "Mom and David" means pages about
 * either of them, because you are naming the people you want to read about.
 * "Mom and prayers" means the prayers, because the second word is narrowing the
 * first. Intersecting two people on a real archive returns almost nothing, and
 * an empty screen reads as broken rather than as accurate.
 *
 * ── What two subjects buy you that a list cannot ────────────────────────────
 *
 * One band per subject, against the same months. Where they overlap is visible
 * without anybody computing an overlap, and where one is loud while the other
 * is silent is visible too. Still no vertical axis anywhere — every cell is the
 * same size and only its warmth changes.
 */
export function SubjectPage({
  subjects,
  kinds,
  reading,
  split,
  onSplit,
  onToggleKind,
  onKeep,
  onOpen,
  cols = 5,
  zoom,
}: {
  subjects: Held[]
  kinds: MarkingKind[]
  reading: Reading
  split: number
  onSplit: (y: number) => void
  onToggleKind: (k: MarkingKind) => void
  onKeep: (s: Held) => void
  onOpen?: (id: string) => void
  /** Fewer columns when the chapter shares the screen with something else. */
  cols?: number
  /** How close you are standing. A chapter obeys the slider like the wall does. */
  zoom?: number
}) {
  const terms = useMemo(() => subjects.flatMap((s) => s.terms), [subjects])

  /** Union across subjects — see the note above. */
  const pages = useMemo(() => ENTRIES.filter((e) => hits(e.paragraphs.join(' '), terms)), [terms])

  /*
   * Why each page is here.
   *
   * Entry-scoped for the subject, and that is a finding rather than a shortcut:
   * she does not write "Mom" in the sentence she is praying, she writes "I keep
   * bringing her". Every prayer she has prayed about her mother says HER.
   * Matching the paragraph is not strict, it is blind — and blind exactly on
   * the most intimate lines, because that is where people stop using names.
   */
  const why = useMemo(() => {
    const m = new Map<string, Why>()
    for (const e of pages) {
      const mark = kinds.length ? (e.markings ?? []).find((k) => kinds.includes(k.kind)) : undefined
      if (kinds.length && !mark) continue
      const para = mark ? mark.para : e.paragraphs.findIndex((p) => hits(p, terms))
      m.set(e.id, { para: para >= 0 ? para : 0, ...(mark ? { mark } : {}) })
    }
    return m
  }, [pages, kinds, terms])

  const shown = useMemo(() => pages.filter((e) => why.has(e.id)), [pages, why])
  const marks = useMemo(() => pages.flatMap((e) => e.markings ?? []), [pages])

  const counts = useMemo(() => {
    const m = new Map<MarkingKind, number>()
    for (const k of marks) m.set(k.kind, (m.get(k.kind) ?? 0) + 1)
    return m
  }, [marks])

  const span = spanOf(shown.map((p) => p.date))
  const match = matcherFor(terms)
  const years = [...new Set(ENTRIES.map((e) => Number(e.date.slice(0, 4))))].sort().slice(1)
  const lines = shown.reduce((n, e) => n + e.paragraphs.filter((p) => hits(p, terms)).length, 0)
  const unkept = subjects.filter((s) => !s.kept)

  const series = subjects.map((s) => ({
    label: s.label,
    dates: shown.filter((e) => hits(e.paragraphs.join(' '), s.terms)).map((e) => e.date),
  }))

  return (
    <div className="chapter">
      <header className="chapter__head">
        <h1 className="chapter__name">
          {subjects.map((s, i) => (
            <span key={s.key}>
              {i > 0 ? <em> &amp; </em> : null}
              {s.label}
            </span>
          ))}
        </h1>

        {/*
          Provenance, then counts. "Noticed" is arithmetic — she capitalised it
          mid-sentence, in this many entries. "Kept" is her.
        */}
        <p className="chapter__facts">
          {subjects.every((s) => s.kept) ? 'kept' : 'noticed'} · <b>{shown.length}</b>{' '}
          {shown.length === 1 ? 'page' : 'pages'} · <b>{lines}</b> {lines === 1 ? 'line' : 'lines'}
          {span ? (
            <>
              {' '}
              · {formatDate(span.first)} to {formatDate(span.last)}
            </>
          ) : null}
        </p>

        {unkept.length > 0 ? (
          <div className="keeprow">
            {unkept.map((s) => (
              <button type="button" className="keepbtn" key={s.key} onClick={() => onKeep(s)}>
                keep {s.label}
              </button>
            ))}
          </div>
        ) : null}
      </header>

      <Band series={series} />

      <div className="rails">
        {DECLARED.filter((k) => (counts.get(k.kind) ?? 0) > 0).map((k) => (
          <button
            type="button"
            className="rail"
            key={k.kind}
            data-on={kinds.includes(k.kind) ? 'true' : undefined}
            style={{ ['--rail-tone' as string]: `var(--k-${k.tone})` } as React.CSSProperties}
            onClick={() => onToggleKind(k.kind)}
          >
            <Glyph kind={k.kind} size={15} />
            {k.label}
            <span className="rail__n">{counts.get(k.kind)}</span>
          </button>
        ))}
      </div>

      {reading === 'thennow' ? (
        <ThenNow entries={shown} split={split} years={years} onSplit={onSplit} why={why} match={match} onOpen={onOpen} />
      ) : reading === 'words' ? (
        <WordsUsed entries={shown} terms={terms} split={split} years={years} onSplit={onSplit} />
      ) : reading === 'bursts' ? (
        <Bursts subjects={subjects} entries={shown} why={why} match={match} onOpen={onOpen} />
      ) : zoom !== undefined && standAt(zoom) === 'rows' ? (
        /*
         * Standing right back inside a chapter gives you that subject's pages
         * as a list — which is the thing the entries panel would have had to
         * become, delivered as a distance instead of as a second surface.
         */
        <Rows entries={shown} why={why} match={match} onOpen={onOpen} onWrite={onOpen} />
      ) : (
        <Wall
          entries={shown}
          why={why}
          match={match}
          cols={zoom !== undefined ? colsAt(zoom, cols <= 3 ? 'shared' : 'full') : cols}
          maxLines={zoom !== undefined ? linesAt(zoom) : 7}
          glyphs
          onOpen={onOpen}
        />
      )}
    </div>
  )
}

export { plural }
