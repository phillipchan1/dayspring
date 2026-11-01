import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { bookByOsis } from '@/lib/bible/canon'
import { formatOsisRef, osisChapterOf } from '@/lib/scripture/format'
import {
  type BookChapterHeat,
  type BookEntry,
  type BookSummary,
  type DateWindow,
  type ReturningRef,
} from '@/lib/scripture/query'
import { windowCacheKey } from '@/lib/asyncCache'
import { useIsMobile, useMediaQuery } from '@/hooks/useMediaQuery'
import { useSwipeToDismiss } from '@/hooks/useSwipeToDismiss'
import { heatColor, intensity, useHeatRamp } from './heat'
import { cachedBook, loadBook } from './bookCache'
import { nearestLit } from './nearestCell'

/** The book the panel is showing — optionally focused on one verse's thread. */
export interface BookTarget {
  osis: string
  focusVerse?: string | undefined
}

interface Props {
  /** Non-null opens the panel; null slides it closed (last book stays during the slide-out). */
  target: BookTarget | null
  /** The canon's active time range — the book reads through the same window. */
  seasonWindow: DateWindow
  /** Human label for that range ("This year"), for the scope line. */
  seasonLabel: string
  onClose: () => void
  onOpenEntry: (entryId: string) => void
}

type Filter = { kind: 'chapter'; chapter: number } | { kind: 'verse'; osisRef: string } | null

/** Nothing lit yet — the strip drawn as a placeholder while a book is read. */
const NO_HEAT: BookChapterHeat = { chapters: new Map(), max: 0 }

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

export function ScriptureBookView({
  target,
  seasonWindow,
  seasonLabel,
  onClose,
  onOpenEntry,
}: Props) {
  useHeatRamp()
  // Latch the displayed book so the panel can slide out showing its last content.
  // Layout effects here and in the load below, so a kept reading is on screen
  // in the same frame the panel starts to slide, never a frame later.
  const [display, setDisplay] = useState<BookTarget | null>(target)
  useLayoutEffect(() => {
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

  // The book reads through the canon's window, so "This year" on the map means
  // this year inside the book too. Widening to all time is per-book and resets
  // itself when another book is opened (no effect, no stale flag).
  const [widenedFor, setWidenedFor] = useState<string | null>(null)
  const widened = widenedFor !== null && widenedFor === bookOsis
  const scoped = Boolean(seasonWindow.from || seasonWindow.to)
  // "this year" reads in a sentence; a stepped-back "Summer 2026" or
  // "October 2026" keeps its capitals.
  const said = /^This /.test(seasonLabel) ? seasonLabel.toLowerCase() : seasonLabel
  const activeWindow: DateWindow = widened ? {} : seasonWindow
  const windowKey = windowCacheKey(activeWindow)

  /*
   * Load (and reset the filter) whenever a different book / verse / window
   * opens — painting the last reading of this book at once, if there is one,
   * and refreshing behind it (see bookCache). Only a book never read through
   * this window starts empty, and then the strip holds its place (`pending`).
   */
  useLayoutEffect(() => {
    if (!bookOsis) return
    const id = ++reqId.current
    const kept = cachedBook(bookOsis, activeWindow)
    setEntries(kept?.entries ?? null)
    setChapterHeat(kept?.heat ?? null)
    setSummary(kept?.summary ?? null)
    setReturning(kept?.returning ?? [])
    setFilter(display?.focusVerse ? { kind: 'verse', osisRef: display.focusVerse } : null)
    loadBook(bookOsis, activeWindow).then(
      (page) => {
        if (id !== reqId.current) return
        setEntries(page.entries)
        setChapterHeat(page.heat)
        setSummary(page.summary)
        setReturning(page.returning)
      },
      () => {
        // A failed refresh leaves what was painted; a failed cold read leaves
        // the placeholder, which is no worse than the panel it replaced.
      },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookOsis, display?.focusVerse, windowKey])

  /*
   * A different book opens at its own top. The panel is one scroller kept
   * mounted across books (it slides out still showing the last), so without
   * this the second book opened at the first one's scroll offset.
   */
  const panelRef = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    if (panelRef.current) panelRef.current.scrollTop = 0
  }, [bookOsis])

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
        ref={panelRef}
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

              {scoped && (
                <div className="scripture-book__scope">
                  <span>{widened ? 'All time' : `Showing ${said}`}</span>
                  <button
                    type="button"
                    className="scripture-book__clear"
                    onClick={() => setWidenedFor(widened ? null : bookOsis)}
                  >
                    {widened ? `back to ${said}` : 'see all time'}
                  </button>
                </div>
              )}

              {loading ? (
                /*
                 * A book never read through this window: the strip and the
                 * timeline hold their places, unlit, rather than a "Reading…"
                 * that the whole panel then jumps down from (N5). The strip is
                 * the real grid for this book, so it is exactly as tall.
                 */
                <div className="scripture-book__pending" aria-busy="true" aria-label={`Reading ${book.name}`}>
                  <ChapterStrip book={book} heat={NO_HEAT} filter={null} onToggle={() => {}} />
                  <section className="scripture-book__section" aria-hidden>
                    <div className="scripture-book__slabel">When you came here</div>
                    <div className="scripture-book__tl">
                      <div className="scripture-book__tl-axis" />
                    </div>
                  </section>
                </div>
              ) : summary!.distinctEntries === 0 ? (
                <p className="scripture-book__loading">
                  {scoped && !widened
                    ? `Nothing from ${book.name} in ${said} — it may still be lit further back.`
                    : `When you write near ${book.name}, it will begin to light here.`}
                </p>
              ) : (
                <>
                  <ChapterStrip book={book} heat={chapterHeat!} filter={filter} onToggle={toggleChapter} />

                  <Timeline entries={decorated} bounds={activeWindow} onDot={scrollToEntry} />

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
  /*
   * On touch the grid takes the tap, not the cell: a ~26px square is half a
   * fingertip, so a tap goes to the nearest lit cell within a 44pt reach
   * (`nearestLit`) — including a tap that lands on an unlit square beside it.
   * Unlit cells drop out of hit-testing on touch (Scripture.css) so their taps
   * reach the grid too. A pointer clicks the cell it is on, as before.
   */
  const coarse = useMediaQuery('(pointer: coarse)')
  const gridRef = useRef<HTMLDivElement>(null)
  const onGridClick = (e: React.MouseEvent) => {
    const grid = gridRef.current
    if (!coarse || !grid) return
    const cell = (e.target as HTMLElement).closest<HTMLElement>('[data-ch]')
    let chapter: number | null
    if (e.detail === 0) {
      // A keyboard press (Enter / Space on a focused cell) has no position.
      chapter = cell?.dataset.lit === 'true' ? Number(cell.dataset.ch) : null
    } else {
      const boxes = [...grid.querySelectorAll<HTMLElement>('[data-ch]')].map((el) => {
        const r = el.getBoundingClientRect()
        return { chapter: Number(el.dataset.ch), left: r.left, top: r.top, width: r.width, height: r.height, lit: el.dataset.lit === 'true' }
      })
      chapter = nearestLit(e.clientX, e.clientY, boxes)
    }
    if (chapter !== null) onToggle(chapter)
  }
  return (
    <section className="scripture-book__section">
      <div className="scripture-book__slabel">Where you go in {book.name}</div>
      <div
        ref={gridRef}
        className="scripture-book__chapters"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        onClick={coarse ? onGridClick : undefined}
      >
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
              data-ch={chapter}
              data-lit={lit ? 'true' : undefined}
              className={`scripture-book__ch${lit ? ' scripture-book__ch--lit' : ''}${selected ? ' scripture-book__ch--sel' : ''}`}
              aria-label={`${book.name} ${chapter}${lit ? ', returned to' : ', unvisited'}`}
              disabled={!lit}
              onClick={coarse ? undefined : () => lit && onToggle(chapter)}
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

function Timeline({
  entries,
  bounds,
  onDot,
}: {
  entries: DecoratedEntry[]
  /** The window the entries were read through — the axis spans it, not all history. */
  bounds: DateWindow
  onDot: (entryId: string) => void
}) {
  const times = entries.map((e) => new Date(e.entry_created_at).getTime())
  const now = Date.now()
  const t0 = bounds.from ? bounds.from.getTime() : Math.min(...times)
  const t1 = bounds.to ? bounds.to.getTime() : Math.max(now, ...times)
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
