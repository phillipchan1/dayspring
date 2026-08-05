import { useEffect, useMemo, useRef, useState } from 'react'
import { bookByOsis } from '@/lib/bible/canon'
import { formatOsisRef, osisChapterOf } from '@/lib/scripture/format'
import {
  getBookChapterHeat,
  getBookEntries,
  getBookSummary,
  getReturning,
  type BookChapterHeat,
  type BookEntry,
  type BookSummary,
  type ReturningRef,
} from '@/lib/scripture/query'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useSwipeToDismiss } from '@/hooks/useSwipeToDismiss'
import { heatColor, intensity, useHeatRamp } from './heat'

/** The book the panel is showing — optionally focused on one verse's thread. */
export interface BookTarget {
  osis: string
  focusVerse?: string | undefined
}

interface Props {
  /** Non-null opens the panel; null slides it closed (last book stays during the slide-out). */
  target: BookTarget | null
  onClose: () => void
  onOpenEntry: (entryId: string) => void
}

type Filter = { kind: 'chapter'; chapter: number } | { kind: 'verse'; osisRef: string } | null

// ── date helpers (browser-local; this view is client-only) ───────────────────
function monthYear(iso: string): string {
  return new Date(iso)
    .toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    .toLowerCase()
}

function relativeRecent(iso: string): string {
  const then = new Date(iso).getTime()
  const days = Math.floor((Date.now() - then) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  return monthYear(iso)
}

/** One restrained line about the user's relationship to this book — evidence, not verdict. */
function relationshipLine(book: string, s: BookSummary): string {
  if (s.distinctEntries === 0) return `You haven't written near ${book} yet.`
  const span =
    s.firstDate && s.lastDate && new Date(s.firstDate).getFullYear() !== new Date(s.lastDate).getFullYear()
      ? ` — across ${new Date(s.firstDate).getFullYear()}–${new Date(s.lastDate).getFullYear()}`
      : ''
  let lead: string
  if (s.rank === 1) lead = `The book you return to most`
  else if (s.rank <= 3) lead = `One of the few books you keep coming back to`
  else if (s.rank <= 8) lead = `A book you return to often`
  else if (s.distinctEntries >= 3) lead = `A book you've come back to now and then`
  else lead = `A book you've turned to a handful of times`
  return `${lead}${span}.`
}

export function ScriptureBookView({ target, onClose, onOpenEntry }: Props) {
  useHeatRamp()
  // Latch the displayed book so the panel can slide out showing its last content.
  const [display, setDisplay] = useState<BookTarget | null>(target)
  useEffect(() => {
    if (target) setDisplay(target)
  }, [target])

  const open = target !== null
  const bookOsis = display?.osis ?? null
  const book = bookOsis ? bookByOsis(bookOsis) : undefined

  // Mobile: let a rightward swipe close the book, tracking the finger.
  const isMobile = useIsMobile()
  const { handlers, dragX, dragging } = useSwipeToDismiss({ onDismiss: onClose, enabled: isMobile && open })

  const [entries, setEntries] = useState<BookEntry[] | null>(null)
  const [chapterHeat, setChapterHeat] = useState<BookChapterHeat | null>(null)
  const [summary, setSummary] = useState<BookSummary | null>(null)
  const [returning, setReturning] = useState<ReturningRef[]>([])
  const [filter, setFilter] = useState<Filter>(null)
  const entryRefs = useRef(new Map<string, HTMLButtonElement>())
  const reqId = useRef(0)

  // Load (and reset the filter) whenever a different book / verse is opened.
  useEffect(() => {
    if (!bookOsis) return
    const id = ++reqId.current
    setEntries(null)
    setChapterHeat(null)
    setSummary(null)
    setReturning([])
    setFilter(display?.focusVerse ? { kind: 'verse', osisRef: display.focusVerse } : null)
    Promise.all([
      getBookEntries(bookOsis, {}),
      getBookChapterHeat(bookOsis, {}),
      getBookSummary(bookOsis, {}),
      getReturning(8, {}, bookOsis),
    ]).then(([e, h, s, r]) => {
      if (id !== reqId.current) return
      setEntries(e)
      setChapterHeat(h)
      setSummary(s)
      setReturning(r)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookOsis, display?.focusVerse])

  // Esc closes the panel when open.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, onClose])

  const decorated = useMemo(() => {
    if (!entries) return []
    return entries.map((e) => {
      const chapters = new Set(e.refs.map(osisChapterOf))
      const warmthSource = chapterHeat
        ? Math.max(0, ...e.refs.map((r) => chapterHeat.chapters.get(osisChapterOf(r)) ?? 0))
        : 0
      const warmth = chapterHeat && chapterHeat.max > 0 ? warmthSource / chapterHeat.max : 0
      return { ...e, chapters, osisRefs: new Set(e.refs), warmth }
    })
  }, [entries, chapterHeat])

  const visible = useMemo(() => {
    if (!filter) return decorated
    if (filter.kind === 'chapter') return decorated.filter((e) => e.chapters.has(filter.chapter))
    return decorated.filter((e) => e.osisRefs.has(filter.osisRef))
  }, [decorated, filter])

  const loading = entries === null || chapterHeat === null || summary === null
  const filterLabel =
    filter?.kind === 'chapter' && book
      ? `${book.name} ${filter.chapter}`
      : filter?.kind === 'verse'
        ? formatOsisRef(filter.osisRef)
        : null

  function toggleChapter(chapter: number) {
    setFilter((f) => (f?.kind === 'chapter' && f.chapter === chapter ? null : { kind: 'chapter', chapter }))
  }
  function toggleVerse(osisRef: string) {
    setFilter((f) => (f?.kind === 'verse' && f.osisRef === osisRef ? null : { kind: 'verse', osisRef }))
  }
  function scrollToEntry(entryId: string) {
    const el = entryRefs.current.get(entryId)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el?.classList.add('scripture-book__entry--flash')
    window.setTimeout(() => el?.classList.remove('scripture-book__entry--flash'), 900)
  }

  return (
    <>
      <div
        className={`scripture-book__scrim${open ? ' scripture-book__scrim--open' : ''}`}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={`scripture-book${open ? ' scripture-book--open' : ''}`}
        aria-hidden={!open}
        aria-label={book ? book.name : undefined}
        {...handlers}
        style={dragging ? { transform: `translateX(${dragX}px)`, transition: 'none' } : undefined}
      >
        <div className="scripture-book__inner">
          {book && (
            <>
              <button type="button" className="scripture-book__back" onClick={onClose}>
                ← the canon
              </button>

              <h1 className="scripture-book__title">{book.name}</h1>
              {summary && summary.distinctEntries > 0 && (
                <p className="scripture-book__rel">{relationshipLine(book.name, summary)}</p>
              )}
              {summary && (
                <div className="scripture-book__meta">
                  {summary.distinctEntries === 0
                    ? 'unvisited · at rest'
                    : `appears in ${summary.distinctEntries} ${summary.distinctEntries === 1 ? 'entry' : 'entries'}` +
                      (summary.firstDate ? ` · first ${monthYear(summary.firstDate)}` : '') +
                      (summary.lastDate ? ` · most recent ${relativeRecent(summary.lastDate)}` : '')}
                </div>
              )}

              {loading ? (
                <p className="scripture-book__loading">Reading…</p>
              ) : summary!.distinctEntries === 0 ? (
                <p className="scripture-book__loading">
                  When you write near {book.name}, it will begin to light here.
                </p>
              ) : (
                <>
                  <ChapterStrip book={book} heat={chapterHeat!} filter={filter} onToggle={toggleChapter} />

                  <Timeline entries={decorated} onDot={scrollToEntry} />

                  {returning.length > 0 && (
                    <section className="scripture-book__section">
                      <div className="scripture-book__slabel">Verses you return to</div>
                      <div className="scripture-book__verses">
                        {returning.map((r) => (
                          <button
                            key={r.osis_ref}
                            type="button"
                            className="scripture-book__vchip"
                            data-on={filter?.kind === 'verse' && filter.osisRef === r.osis_ref ? 'true' : undefined}
                            onClick={() => toggleVerse(r.osis_ref)}
                          >
                            {formatOsisRef(r.osis_ref)}
                            <span className="scripture-book__vchip-n">×{r.count}</span>
                          </button>
                        ))}
                      </div>
                    </section>
                  )}

                  <section className="scripture-book__section">
                    <div className="scripture-book__slabel">Entries</div>
                    {filterLabel && (
                      <div className="scripture-book__fbar">
                        <span>Showing {filterLabel}</span>
                        <button type="button" className="scripture-book__clear" onClick={() => setFilter(null)}>
                          clear ✕
                        </button>
                      </div>
                    )}
                    <div className="scripture-book__count">
                      {visible.length} {visible.length === 1 ? 'entry' : 'entries'}
                    </div>
                    <div>
                      {visible.map((e) => (
                        <button
                          key={e.entry_id}
                          type="button"
                          ref={(el) => {
                            if (el) entryRefs.current.set(e.entry_id, el)
                            else entryRefs.current.delete(e.entry_id)
                          }}
                          className="scripture-book__entry"
                          onClick={() => onOpenEntry(e.entry_id)}
                        >
                          <span className="scripture-book__entry-top">
                            <span className="scripture-book__entry-verse">
                              {e.refs.map((r) => formatOsisRef(r)).join(' · ')}
                            </span>
                            <span className="scripture-book__entry-date">
                              {new Date(e.entry_created_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                          </span>
                          <span className="scripture-book__entry-text">{e.excerpt || '—'}</span>
                          <span className="scripture-book__entry-open">open in journal →</span>
                        </button>
                      ))}
                    </div>
                  </section>
                </>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  )
}

function ChapterStrip({
  book,
  heat,
  filter,
  onToggle,
}: {
  book: NonNullable<ReturnType<typeof bookByOsis>>
  heat: BookChapterHeat
  filter: Filter
  onToggle: (chapter: number) => void
}) {
  const cols = Math.min(30, book.chapters)
  return (
    <section className="scripture-book__section">
      <div className="scripture-book__slabel">Where you go in {book.name}</div>
      <div className="scripture-book__chapters" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: book.chapters }, (_, i) => {
          const chapter = i + 1
          const count = heat.chapters.get(chapter) ?? 0
          const t = intensity(count, heat.max)
          const lit = t > 0
          const selected = filter?.kind === 'chapter' && filter.chapter === chapter
          const color = lit ? heatColor(t) : undefined
          return (
            <button
              key={chapter}
              type="button"
              className={`scripture-book__ch${lit ? ' scripture-book__ch--lit' : ''}${selected ? ' scripture-book__ch--sel' : ''}`}
              aria-label={`${book.name} ${chapter}${lit ? ', returned to' : ', unvisited'}`}
              disabled={!lit}
              onClick={() => lit && onToggle(chapter)}
              style={color ? { background: color, boxShadow: `0 0 ${Math.round(4 + 9 * t)}px ${color}` } : undefined}
            />
          )
        })}
      </div>
      <div className="scripture-book__cap">
        each square is a chapter · brighter = returned to more often · click a lit one to filter
      </div>
    </section>
  )
}

interface DecoratedEntry extends BookEntry {
  warmth: number
}

function Timeline({ entries, onDot }: { entries: DecoratedEntry[]; onDot: (entryId: string) => void }) {
  const times = entries.map((e) => new Date(e.entry_created_at).getTime())
  const t0 = Math.min(...times)
  const now = Date.now()
  const t1 = Math.max(now, ...times)
  const span = Math.max(1, t1 - t0)
  const xf = (t: number) => ((t - t0) / span) * 100

  const startYear = new Date(t0).getFullYear()
  const endYear = new Date(t1).getFullYear()
  const years: number[] = []
  for (let y = startYear; y <= endYear; y++) years.push(y)

  // Shade the rolling seasons that intersect the axis (our auto-windows, not
  // named life-chapters yet). Quiet shading only — no labels, since these align
  // with calendar years and would collide with the year ticks. When named
  // life-chapters land (the deferred seam), bring back offset labels here.
  const nowD = new Date(now)
  const thisYearStart = new Date(nowD.getFullYear(), 0, 1).getTime()
  const lastYearStart = new Date(nowD.getFullYear() - 1, 0, 1).getTime()
  const bands = [
    { label: 'last year', from: lastYearStart, to: thisYearStart, tone: 'rgba(197,106,110,.12)' },
    { label: 'this year', from: thisYearStart, to: now, tone: 'rgba(243,189,118,.14)' },
  ].filter((b) => b.to > t0 && b.from < t1)

  return (
    <section className="scripture-book__section">
      <div className="scripture-book__slabel">When you came here</div>
      <div className="scripture-book__tl">
        <div className="scripture-book__tl-axis" />
        {bands.map((b) => {
          const left = Math.max(0, xf(b.from))
          const right = Math.min(100, xf(b.to))
          return (
            <div
              key={b.label}
              className="scripture-book__tl-band"
              style={{ left: `${left}%`, width: `${Math.max(0, right - left)}%`, background: b.tone }}
            />
          )
        })}
        {years.map((y) => {
          const left = xf(new Date(y, 0, 1).getTime())
          if (left < 0 || left > 100) return null
          return (
            <div key={y} className="scripture-book__tl-yr" style={{ left: `${left}%` }}>
              {y}
            </div>
          )
        })}
        {entries.map((e) => {
          const color = heatColor(0.4 + 0.6 * e.warmth)
          return (
            <button
              key={e.entry_id}
              type="button"
              className="scripture-book__tl-dot"
              style={{ left: `${xf(new Date(e.entry_created_at).getTime())}%`, background: color, boxShadow: `0 0 8px ${color}` }}
              aria-label={`${e.refs.map((r) => formatOsisRef(r)).join(', ')} — ${new Date(e.entry_created_at).toLocaleDateString()}`}
              onClick={() => onDot(e.entry_id)}
            />
          )
        })}
      </div>
    </section>
  )
}
