import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppNavigation } from '@/context/AppNavigation'
import { NT_BOOKS, OT_BOOKS, type BibleBook } from '@/lib/bible/canon'
import { formatOsisRef, osisBookOf } from '@/lib/scripture/format'
import { getCache, windowCacheKey } from '@/lib/asyncCache'
import {
  invalidateScriptureCache,
  loadScriptureCanonPage,
  type CanonHeat,
  type DateWindow,
  type ReturningRef,
  type SeasonSummary,
} from '@/lib/scripture/query'
import { SurfaceLoader } from '@/components/SurfaceLoader'
import { SurfaceArrival } from '@/features/journal/SurfaceArrival'
import { peekSurfaceUpdates } from '@/features/journal/surfaceUpdates'
import { ScriptureBookView, type BookTarget } from './ScriptureBookView'
import { heatColor, intensity, useHeatRamp } from './heat'
import { useScriptureScan } from './useScriptureScan'
import './Scripture.css'

interface Props {
  /** Open an entry in the journal — wired through the book view's entry cards. */
  onOpenEntry: (entryId: string) => void
}

/** Accessible descriptor for a whole book, relative to the busiest book. */
function bookDescriptor(total: number, maxBook: number): string {
  if (total <= 0) return 'unvisited'
  const t = maxBook <= 0 ? 0 : total / maxBook
  if (t >= 0.6) return 'returned to often'
  if (t >= 0.25) return 'returned to'
  return 'visited a few times'
}

/**
 * Map the labels of newly-cited verses ("John 3:16") back to the books they
 * touched, so the canon can pulse those tiles on arrival. The Lamp is a heatmap,
 * not a list — the book is the finest stable target a citation has. Lenient by
 * design: an unmatched label simply doesn't pulse (the arrival line still names
 * it), never a wrong tile.
 */
function newlyCitedBooks(labels: string[], books: BibleBook[]): Set<string> {
  const osis = new Set<string>()
  for (const label of labels) {
    const lower = label.toLowerCase()
    let best: BibleBook | null = null
    for (const book of books) {
      const name = book.name.toLowerCase()
      const singular = name.endsWith('s') ? name.slice(0, -1) : name
      if (lower.startsWith(name) || lower.startsWith(singular)) {
        if (!best || book.name.length > best.name.length) best = book
      }
    }
    if (best) osis.add(best.osis)
  }
  return osis
}

// ── seasons ─────────────────────────────────────────────────────────────────
// Auto-derived rolling windows for now. The seam to swap these for user-named
// life-chapters later is a single array — labels + windows live in one place.

interface Season {
  id: string
  label: string
  window: DateWindow
}

function buildSeasons(): Season[] {
  const now = new Date()
  const y = now.getFullYear()
  const season = new Date(now)
  season.setDate(season.getDate() - 90)
  return [
    { id: 'all', label: 'All time', window: {} },
    { id: 'season', label: 'This season', window: { from: season } },
    { id: 'year', label: 'This year', window: { from: new Date(y, 0, 1) } },
    {
      id: 'last',
      label: 'Last year',
      window: { from: new Date(y - 1, 0, 1), to: new Date(y - 1, 11, 31, 23, 59, 59) },
    },
  ]
}

function humanList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

/** One descriptive line — evidence about where the season leaned, never a verdict. */
function seasonNote(season: Season, s: SeasonSummary): string {
  if (s.totalRefs === 0) {
    return season.id === 'all'
      ? ''
      : 'No scripture surfaced in your writing here — a quieter stretch.'
  }
  const books = s.topBooks.map((b) => b.name)
  if (s.distinctVerses <= 4) {
    return `A quieter stretch — a few passages, mostly ${books[0]}.`
  }
  const lead =
    season.id === 'all' ? 'Across all your writing, you’ve leaned toward' : 'Here you leaned toward'
  const verse = s.topVerse ? formatOsisRef(s.topVerse.osis_ref) : null
  return verse
    ? `${lead} ${humanList(books)} — ${verse} surfaced most.`
    : `${lead} ${humanList(books)}.`
}

export function ScriptureView({ onOpenEntry }: Props) {
  useHeatRamp()
  const { state, go, back } = useAppNavigation()
  const seasons = useMemo(() => buildSeasons(), [])
  const initialCanon = useMemo(() => {
    const all = seasons.find((s) => s.id === 'all')!
    return getCache<Awaited<ReturnType<typeof loadScriptureCanonPage>>>(
      `scripture:canon:${windowCacheKey(all.window)}`,
    )
  }, [seasons])
  const [seasonId, setSeasonId] = useState('year')
  const [heat, setHeat] = useState<CanonHeat | null>(initialCanon?.heat ?? null)
  const [summary, setSummary] = useState<SeasonSummary | null>(initialCanon?.summary ?? null)
  const [returning, setReturning] = useState<ReturningRef[]>(initialCanon?.returning ?? [])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const reqId = useRef(0)
  const freshLoad = useRef(false)

  // Books that gained a verse since the last visit — pulsed once on arrival.
  // Captured before SurfaceArrival's effect consumes the pending updates.
  const [newBooks] = useState<Set<string>>(() =>
    newlyCitedBooks(
      peekSurfaceUpdates('scripture').map((i) => i.label),
      [...OT_BOOKS, ...NT_BOOKS],
    ),
  )

  // Scan orchestration (also available in Settings → Import & backup).
  const scan = useScriptureScan(() => {
    invalidateScriptureCache()
    freshLoad.current = true
    setReloadKey((k) => k + 1)
  })

  // Auto-light the Lamp: imported entries skip the editor, so scan them for refs
  // automatically (cheap on-device regex) — the unified "forming" experience, no
  // "Scan now" wall. Runs once when there are pending imports.
  const autoScannedRef = useRef(false)
  useEffect(() => {
    if (scan.pending > 0 && !scan.scanning && !autoScannedRef.current) {
      autoScannedRef.current = true
      void scan.run()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scan.pending, scan.scanning])

  // The open book panel is its own history frame, so Back / Esc / the rail all
  // close it predictably (browser back pops straight here).
  const bookTarget: BookTarget | null = state.scriptureBook
    ? { osis: state.scriptureBook, focusVerse: state.scriptureVerse ?? undefined }
    : null
  const openBook = (sel: BookTarget) =>
    go({ scriptureBook: sel.osis, scriptureVerse: sel.focusVerse ?? null })

  const season = seasons.find((s) => s.id === seasonId) ?? seasons[0]!

  useEffect(() => {
    const cacheKey = `scripture:canon:${windowCacheKey(season.window)}`
    const cached = getCache<Awaited<ReturnType<typeof loadScriptureCanonPage>>>(cacheKey)
    if (cached) {
      setHeat(cached.heat)
      setSummary(cached.summary)
      setReturning(cached.returning)
      setLoadError(null)
    } else {
      setHeat(null)
      setSummary(null)
      setReturning([])
    }

    const id = ++reqId.current
    let cancelled = false
    const fresh = freshLoad.current
    freshLoad.current = false
    loadScriptureCanonPage(season.window, { fresh })
      .then((page) => {
        if (cancelled || id !== reqId.current) return
        setHeat(page.heat)
        setSummary(page.summary)
        setReturning(page.returning)
        setLoadError(null)
      })
      .catch((e) => {
        if (!cancelled && id === reqId.current) {
          setLoadError(e instanceof Error ? e.message : 'Could not load')
        }
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season, reloadKey])

  const maxBook = useMemo(() => {
    if (!heat) return 0
    let m = 0
    for (const v of heat.books.values()) if (v > m) m = v
    return m
  }, [heat])

  const note = summary ? seasonNote(season, summary) : ''

  if (loadError) {
    return <p className="scripture__error">{loadError}</p>
  }
  if (!heat) {
    return (
      <div className="scripture">
        <div className="scripture__bg" aria-hidden />
        <SurfaceLoader label="Lighting the lamp…" />
      </div>
    )
  }

  return (
    <div className="scripture">
      <div className="scripture__bg" aria-hidden />
      <div className="scripture__scroll" data-dim={bookTarget ? 'true' : undefined}>
        <div className="scripture__column">
          <header className="scripture__header">
            <h1 className="scripture__title">Where your heart has been leaning</h1>
            {scan.result && !scan.scanning && !scan.error && (
              <p className="scripture__lit">
                Lit {scan.result.refsWritten.toLocaleString()}{' '}
                {scan.result.refsWritten === 1 ? 'reference' : 'references'} across{' '}
                {scan.result.booksTouched} {scan.result.booksTouched === 1 ? 'book' : 'books'}.
              </p>
            )}
          </header>

          <SurfaceArrival surface="scripture" />

          {/* Boxed status ONLY while transient (scanning / error). Once it's done,
              the count is a quiet fact in the header above, not a notification. */}
          {(scan.scanning || scan.error) && (
            <div className="scripture__scan" role="status">
              {scan.scanning ? (
                <div className="scripture__forming">
                  <span className="scripture__forming-mark" aria-hidden />
                  <span className="scripture__scan-text">Lighting your scripture map…</span>
                  <div className="scripture__forming-bar" aria-hidden>
                    <div
                      className="scripture__forming-fill"
                      style={{
                        width: `${
                          scan.scanning.total > 0
                            ? Math.min(100, Math.round((scan.scanning.done / scan.scanning.total) * 100))
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <span className="scripture__forming-pct">
                    {scan.scanning.total > 0
                      ? Math.min(100, Math.round((scan.scanning.done / scan.scanning.total) * 100))
                      : 0}
                    %
                  </span>
                </div>
              ) : (
                <>
                  <span className="scripture__scan-text">
                    Couldn’t finish lighting the map — {scan.error}
                  </span>
                  <button type="button" className="scripture__scan-btn" onClick={() => void scan.run()}>
                    Try again
                  </button>
                </>
              )}
            </div>
          )}

          <div className="scripture__seasons" role="group" aria-label="Time range">
            {seasons.map((s) => (
              <button
                key={s.id}
                type="button"
                className="scripture__chip"
                data-on={s.id === seasonId ? 'true' : undefined}
                onClick={() => setSeasonId(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
          <p className={`scripture__season-note${note ? ' scripture__season-note--show' : ''}`}>
            {note}
          </p>

          <Testament label="Old Testament" books={OT_BOOKS} heat={heat} maxBook={maxBook} newBooks={newBooks} onOpen={openBook} />
          <Testament label="New Testament" books={NT_BOOKS} heat={heat} maxBook={maxBook} newBooks={newBooks} onOpen={openBook} />

          <div className="scripture__legend" aria-hidden>
            <span>seldom</span>
            <span className="scripture__ramp">
              {[0.2, 0.4, 0.6, 0.8, 1].map((t) => (
                <i
                  key={t}
                  style={{ background: heatColor(t), boxShadow: `0 0 ${4 + 8 * t}px ${heatColor(t)}` }}
                />
              ))}
            </span>
            <span>often</span>
            <span className="scripture__legend-note">· each square is one chapter</span>
          </div>

          {returning.length > 0 && (
            <div className="scripture__returning">
              <h3 className="scripture__returning-title">You keep returning to…</h3>
              <div className="scripture__verses">
                {returning.map((r) => (
                  <button
                    key={r.osis_ref}
                    type="button"
                    className="scripture__verse-chip"
                    onClick={() => openBook({ osis: osisBookOf(r.osis_ref), focusVerse: r.osis_ref })}
                  >
                    {formatOsisRef(r.osis_ref)}
                    <span>returned {r.count}×</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <ScriptureBookView
        target={bookTarget}
        seasonWindow={season.window}
        seasonLabel={season.label}
        onClose={back}
        onOpenEntry={onOpenEntry}
      />
    </div>
  )
}

function Testament({
  label,
  books,
  heat,
  maxBook,
  newBooks,
  onOpen,
}: {
  label: string
  books: BibleBook[]
  heat: CanonHeat
  maxBook: number
  newBooks: Set<string>
  onOpen: (sel: BookTarget) => void
}) {
  return (
    <>
      <div className="scripture__testament">{label}</div>
      <div className="scripture__canon">
        {books.map((book) => (
          <BookTile
            key={book.osis}
            book={book}
            heat={heat}
            maxBook={maxBook}
            isNew={newBooks.has(book.osis)}
            onOpen={onOpen}
          />
        ))}
      </div>
    </>
  )
}

function BookTile({
  book,
  heat,
  maxBook,
  isNew,
  onOpen,
}: {
  book: BibleBook
  heat: CanonHeat
  maxBook: number
  isNew: boolean
  onOpen: (sel: BookTarget) => void
}) {
  const total = heat.books.get(book.osis) ?? 0
  const lit = total > 0
  const cols = Math.min(10, Math.max(4, Math.ceil(Math.sqrt(book.chapters))))
  const label = `${book.name}, ${bookDescriptor(total, maxBook)}${isNew ? ', new' : ''}`

  return (
    <button
      type="button"
      className={`scripture__book${lit ? ' scripture__book--lit' : ''}${isNew ? ' scripture__book--new' : ''}`}
      aria-label={label}
      onClick={() => onOpen({ osis: book.osis })}
    >
      <span className="scripture__bname">{book.name}</span>
      <span className="scripture__cells" style={{ gridTemplateColumns: `repeat(${cols}, 7px)` }}>
        {Array.from({ length: book.chapters }, (_, i) => {
          const count = heat.chapters.get(`${book.osis}:${i + 1}`) ?? 0
          const t = intensity(count, heat.max)
          if (t <= 0) {
            return <span key={i} className="scripture__cell" />
          }
          const color = heatColor(t)
          return (
            <span
              key={i}
              className="scripture__cell"
              style={{ background: color, boxShadow: `0 0 ${Math.round(4 + 10 * t)}px ${color}` }}
            />
          )
        })}
      </span>
    </button>
  )
}
