import { useMemo, useState } from 'react'
import { ENTRIES, allMarkings, type MarkingKind } from '../corpus'
import { hits } from '../lib'
import { FilterBar, type Chip, type Reading } from '../FilterBar'
import { Wall } from '../Wall'
import { Rows } from '../Rows'
import { STAND_LABEL, colsAt, linesAt, standAt } from '../zoom'
import { leavesFor } from '../page'
import { formatDate } from '../corpus'
import { SubjectPage } from './SubjectPage'
import { Bursts, ThenNow, WordsUsed } from './Results'
import { Lines } from './Lines'
import { offered, type Held } from '../subjects'

/**
 * Looking.
 *
 * ── There is no mode switcher ───────────────────────────────────────────────
 *
 * The previous pass had `pages · lines · braid` along the top. Naming three
 * arrangements made you choose one before you had a question, which is the same
 * mistake the ten-scene bar made one level up: it asks you to know the shape of
 * the answer in order to ask.
 *
 * So the arrangement is a CONSEQUENCE now, and there are only three cases:
 *
 *   nothing on          → the wall. Come across something you don't have in mind.
 *   a subject on        → that subject's page. The chapter.
 *   only markings on    → those lines, oldest first, across everything.
 *
 * A marking never changes WHERE you are — it narrows what you are already
 * looking at. Mom, then Prayer, stays on Mom's page and leaves the prayers.
 *
 * ── then / now moved ────────────────────────────────────────────────────────
 *
 * It is on the subject page, where it belongs. "How has this changed" is a
 * question about a thing, not about an archive, and at the top of the app it
 * was a global control for a local idea.
 */
/**
 * The same wall, at whatever distance you are standing.
 *
 * Rows at the far end is the entries list — not as a surface and not as a mode,
 * but as standing far enough back that a card becomes a row. D-018's own kill
 * note asked for exactly this and nobody built it: "an argument for a list-tight
 * end of the zoom rather than for a second surface."
 */
function Stood({
  zoom,
  lit,
  match,
  onOpen,
}: {
  zoom: number
  lit: Set<string> | null
  match: RegExp | null
  onOpen?: (id: string) => void
}) {
  const stand = standAt(zoom)
  if (stand === 'rows') return <Rows lit={lit} match={match} onOpen={onOpen} onWrite={onOpen} />
  if (stand === 'reading') {
    const leaves = leavesFor(lit ? ENTRIES.filter((e) => lit.has(e.id)) : ENTRIES, { rows: 17, cols: 52 })
    return (
      <div className="leaves">
        {leaves.map((leaf, i) => (
          <button type="button" className="leaf" key={`${leaf.entry.id}-${leaf.part}-${i}`} onClick={() => onOpen?.(leaf.entry.id)}>
            {leaf.part === 0 ? (
              <time className="leaf__date" dateTime={leaf.entry.date}>
                {formatDate(leaf.entry.date)}
              </time>
            ) : null}
            {leaf.paras.map((p) => (
              <p className="leaf__p" key={p}>
                {leaf.entry.paragraphs[p]}
              </p>
            ))}
          </button>
        ))}
      </div>
    )
  }
  return <Wall lit={lit} match={match} cols={colsAt(zoom)} maxLines={linesAt(zoom)} glyphs onOpen={onOpen} />
}

export function LookingScene({ onOpen }: { onOpen?: (id: string) => void }) {
  const [chips, setChips] = useState<Chip[]>([])
  /*
   * Nothing is kept at the start.
   *
   * The fixture used to open with five subjects already held, which quietly
   * skipped the only part of this anyone has to be taught: what it looks like
   * the first time, when the journal has noticed some names and she has not
   * decided about any of them. Keeping them live is the demonstration.
   */
  const [kept, setKept] = useState<Held[]>([])
  /** How to read a thread. Lives here so the filter can set it — see FilterBar. */
  const [reading, setReading] = useState<Reading>('order')
  const [split, setSplit] = useState(2025)
  /** 0 = a list, 1 = reading one page. See zoom.ts. */
  const [zoom, setZoom] = useState(0.6)
  /** Set when she asks for the pages behind a subject rather than its chapter. */
  const [asPages, setAsPages] = useState(false)

  const offers = useMemo(() => offered(), [])
  const marks = useMemo(() => allMarkings(), [])

  const markCounts = useMemo(() => {
    const m = new Map<MarkingKind, number>()
    for (const k of marks) m.set(k.kind, (m.get(k.kind) ?? 0) + 1)
    return m
  }, [marks])

  const subjectChips = chips.filter((c) => c.kind === 'subject')
  const markKinds = chips.filter((c) => c.kind === 'mark').map((c) => c.mark)

  function add(chip: Chip) {
    setChips((prev) => {
      if (prev.some((c) => c.key === chip.key)) return prev
      // Several subjects are allowed and they UNION — "Mom and David" names the
      // people you want to read about, not a query for pages carrying both.
      if (chip.kind === 'subject') setAsPages(false)
      return [...prev, chip]
    })
  }

  /** Kept in the order kept — never by count. A ranking of what someone carries is a verdict. */
  function keep(s: Held) {
    setKept((prev) => (prev.some((k) => k.key === s.key) ? prev : [...prev, { ...s, kept: true }]))
  }

  /** Dropping is safe: the journal still notices it, and nothing she wrote changes. */
  function drop(key: string) {
    setKept((prev) => prev.filter((k) => k.key !== key))
  }

  /** The lit set, for the wall. Every filter narrowing the last. */
  const lit = useMemo(() => {
    if (chips.length === 0) return null
    let set = new Set(ENTRIES.map((e) => e.id))
    if (subjectChips.length) {
      const terms = subjectChips.flatMap((c) => c.subject.terms)
      const ok = new Set(ENTRIES.filter((e) => hits(e.paragraphs.join(' '), terms)).map((e) => e.id))
      set = new Set([...set].filter((id) => ok.has(id)))
    }
    for (const k of markKinds) {
      const ok = new Set(marks.filter((m) => m.kind === k).map((m) => m.entryId))
      set = new Set([...set].filter((id) => ok.has(id)))
    }
    return set
  }, [chips, marks])

  const match = useMemo(() => {
    const terms = subjectChips.flatMap((c) => c.subject.terms)
    if (!terms.length) return null
    const safe = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    return new RegExp(`\\b(?:${safe.join('|')})\\b`, 'gi')
  }, [chips])

  /* Markings on their own — those lines, across everything. */
  const markLines = useMemo(() => {
    if (subjectChips.length || markKinds.length === 0) return []
    return marks
      .filter((m) => markKinds.includes(m.kind))
      .map((m) => ({ entryId: m.entryId, date: m.date, text: m.quote, kind: m.kind }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [chips, marks])

  /** What the readings arrange when no subject is chosen. */
  const wallSet = useMemo(() => (lit ? ENTRIES.filter((e) => lit.has(e.id)) : ENTRIES), [lit])
  const years = [...new Set(ENTRIES.map((e) => Number(e.date.slice(0, 4))))].sort().slice(1)

  const bar = (
    <FilterBar
      chips={chips}
      subjects={kept}
      offered={offers}
      markCounts={markCounts}
      onAdd={add}
      onRemove={(key) => setChips((prev) => prev.filter((c) => c.key !== key))}
      onClear={() => {
        setChips([])
        setAsPages(false)
      }}
      onKeep={keep}
      onDrop={drop}
      zoom={zoom}
      onZoom={setZoom}
      standLabel={STAND_LABEL[standAt(zoom)]}
      reading={reading}
      onReading={setReading}
    />
  )

  return (
    <div className="surface">
      <div className="dawn" aria-hidden />
      <div className="inner">
        {bar}

        {subjectChips.length > 0 && !asPages ? (
          <SubjectPage
            key={subjectChips.map((c) => c.key).join('+')}
            subjects={subjectChips.map((c) => c.subject)}
            kinds={markKinds}
            reading={reading}
            split={split}
            onSplit={setSplit}
            onToggleKind={(k) => {
              const key = `k:${k}`
              setChips((prev) =>
                prev.some((c) => c.key === key)
                  ? prev.filter((c) => c.key !== key)
                  : [...prev, { kind: 'mark', key, label: k, mark: k }],
              )
            }}
            onKeep={keep}
            onOpen={onOpen}
            zoom={zoom}
          />
        ) : markLines.length > 0 ? (
          <Lines
            lines={markLines}
            head={
              <>
                <b>{markLines.length}</b> {markLines.length === 1 ? 'line' : 'lines'} · everything you marked
                that way · oldest first
              </>
            }
            onOpen={onOpen}
          />
        ) : (
          <>
            {asPages && subjectChips.length ? (
              <button type="button" className="ghost backlink" onClick={() => setAsPages(false)}>
                ← {subjectChips.map((c) => c.label).join(' & ')}
              </button>
            ) : null}
            <p className="meta">
              <b>{lit ? lit.size : ENTRIES.length}</b> {(lit ? lit.size : ENTRIES.length) === 1 ? 'page' : 'pages'}
              {chips.length ? ` carrying ${chips.map((c) => c.label).join(' + ')}` : ''} · the years
            </p>

            {/*
              The readings work on the whole archive too, not only inside a
              subject. That is what makes "the words you used" reachable at all
              — it was buried behind choosing a subject first, which is exactly
              backwards, because RECALL keeps a vocabulary comparison
              ARCHIVE-scoped and takes it off person pages.
            */}
            {reading === 'thennow' ? (
              <ThenNow entries={wallSet} split={split} years={years} onSplit={setSplit} match={match} onOpen={onOpen} />
            ) : reading === 'words' ? (
              <WordsUsed entries={wallSet} terms={[]} split={split} years={years} onSplit={setSplit} />
            ) : reading === 'bursts' ? (
              <Bursts subjects={[]} entries={wallSet} match={match} onOpen={onOpen} />
            ) : (
              <Stood zoom={zoom} lit={lit} match={match} onOpen={onOpen} />
            )}
          </>
        )}
      </div>
    </div>
  )
}
