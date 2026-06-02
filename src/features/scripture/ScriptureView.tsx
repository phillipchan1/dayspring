import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppNavigation } from '@/context/AppNavigation'
import { NT_BOOKS, OT_BOOKS, type BibleBook } from '@/lib/bible/canon'
import { formatOsisRef, osisBookOf } from '@/lib/scripture/format'
import {
  getCanonHeat,
  getReturning,
  getSeasonSummary,
  type CanonHeat,
  type DateWindow,
  type ReturningRef,
  type SeasonSummary,
} from '@/lib/scripture/query'
import { getImportedEntryCount, scanAllForRefs, type ScanResult } from '@/lib/scripture/scan'
import { ScriptureBookView, type BookTarget } from './ScriptureBookView'
import { heatColor, intensity } from './heat'
import './Scripture.css'

// "Have I scanned my imports" watermark — the imported-entry count at last scan.
// Native entries are captured live on save, so only imports drive the CTA.
const SCAN_WATERMARK_KEY = 'dayspring.scriptureScannedImported'
function readScanWatermark(): number {
  if (typeof localStorage === 'undefined') return 0
  return Number(localStorage.getItem(SCAN_WATERMARK_KEY) ?? '0') || 0
}
function writeScanWatermark(n: number): void {
  if (typeof localStorage !== 'undefined') localStorage.setItem(SCAN_WATERMARK_KEY, String(n))
}

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
  const { state, go, back } = useAppNavigation()
  const seasons = useMemo(() => buildSeasons(), [])
  const [seasonId, setSeasonId] = useState('all')
  const [heat, setHeat] = useState<CanonHeat | null>(null)
  const [summary, setSummary] = useState<SeasonSummary | null>(null)
  const [returning, setReturning] = useState<ReturningRef[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [pendingScan, setPendingScan] = useState(0)
  const [scanning, setScanning] = useState<{ done: number; total: number } | null>(null)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const reqId = useRef(0)

  // Surface the scan CTA when imported entries haven't been scanned yet.
  useEffect(() => {
    let cancelled = false
    getImportedEntryCount()
      .then((imported) => {
        if (!cancelled) setPendingScan(Math.max(0, imported - readScanWatermark()))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  async function runScan() {
    setScanResult(null)
    setScanning({ done: 0, total: 0 })
    try {
      const result = await scanAllForRefs((done, total) => setScanning({ done, total }))
      writeScanWatermark(await getImportedEntryCount().catch(() => 0))
      setPendingScan(0)
      setScanResult(result)
      setReloadKey((k) => k + 1) // relight the map with the freshly-found refs
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Scan failed')
    } finally {
      setScanning(null)
    }
  }

  // The open book panel is its own history frame, so Back / Esc / the rail all
  // close it predictably (browser back pops straight here).
  const bookTarget: BookTarget | null = state.scriptureBook
    ? { osis: state.scriptureBook, focusVerse: state.scriptureVerse ?? undefined }
    : null
  const openBook = (sel: BookTarget) =>
    go({ scriptureBook: sel.osis, scriptureVerse: sel.focusVerse ?? null })

  const season = seasons.find((s) => s.id === seasonId) ?? seasons[0]!

  useEffect(() => {
    const id = ++reqId.current
    let cancelled = false
    Promise.all([
      getCanonHeat(season.window),
      getSeasonSummary(season.window),
      getReturning(6, season.window),
    ])
      .then(([h, sum, ret]) => {
        // Ignore stale responses — only the latest season wins.
        if (cancelled || id !== reqId.current) return
        setHeat(h)
        setSummary(sum)
        setReturning(ret)
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
    return <div className="scripture scripture--loading">Loading…</div>
  }

  return (
    <div className="scripture">
      <div className="scripture__bg" aria-hidden />
      <div className="scripture__scroll" data-dim={bookTarget ? 'true' : undefined}>
        <div className="scripture__column">
          <header className="scripture__header">
            <h1 className="scripture__title">Where your heart has been leaning</h1>
          </header>

          {(scanning || pendingScan > 0 || scanResult) && (
            <div className="scripture__scan" role="status">
              {scanning ? (
                <span className="scripture__scan-text">
                  Scanning your journal…
                  {scanning.total > 0
                    ? ` ${scanning.done.toLocaleString()} / ${scanning.total.toLocaleString()}`
                    : ''}
                </span>
              ) : scanResult ? (
                <span className="scripture__scan-text">
                  Lit {scanResult.refsWritten.toLocaleString()}{' '}
                  {scanResult.refsWritten === 1 ? 'reference' : 'references'} across{' '}
                  {scanResult.booksTouched} {scanResult.booksTouched === 1 ? 'book' : 'books'}.
                </span>
              ) : (
                <>
                  <span className="scripture__scan-text">
                    {pendingScan.toLocaleString()} imported{' '}
                    {pendingScan === 1 ? 'entry hasn’t' : 'entries haven’t'} been scanned for
                    scripture yet — imported writing skips the editor, so its references aren’t on
                    the map.
                  </span>
                  <button type="button" className="scripture__scan-btn" onClick={() => void runScan()}>
                    Scan now
                  </button>
                </>
              )}
            </div>
          )}

          <div className="scripture__seasons" role="group" aria-label="Season">
            <span className="scripture__seasons-label">Season</span>
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

          <Testament label="Old Testament" books={OT_BOOKS} heat={heat} maxBook={maxBook} onOpen={openBook} />
          <Testament label="New Testament" books={NT_BOOKS} heat={heat} maxBook={maxBook} onOpen={openBook} />

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

      <ScriptureBookView target={bookTarget} onClose={back} onOpenEntry={onOpenEntry} />
    </div>
  )
}

function Testament({
  label,
  books,
  heat,
  maxBook,
  onOpen,
}: {
  label: string
  books: BibleBook[]
  heat: CanonHeat
  maxBook: number
  onOpen: (sel: BookTarget) => void
}) {
  return (
    <>
      <div className="scripture__testament">{label}</div>
      <div className="scripture__canon">
        {books.map((book) => (
          <BookTile key={book.osis} book={book} heat={heat} maxBook={maxBook} onOpen={onOpen} />
        ))}
      </div>
    </>
  )
}

function BookTile({
  book,
  heat,
  maxBook,
  onOpen,
}: {
  book: BibleBook
  heat: CanonHeat
  maxBook: number
  onOpen: (sel: BookTarget) => void
}) {
  const total = heat.books.get(book.osis) ?? 0
  const lit = total > 0
  const cols = Math.min(10, Math.max(4, Math.ceil(Math.sqrt(book.chapters))))
  const label = `${book.name}, ${bookDescriptor(total, maxBook)}`

  return (
    <button
      type="button"
      className={`scripture__book${lit ? ' scripture__book--lit' : ''}`}
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
