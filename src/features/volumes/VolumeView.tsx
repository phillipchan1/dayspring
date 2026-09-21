import { useEffect, useMemo, useState } from 'react'
import { entryContentLines } from '@/lib/entryLabels'
import { stripMarkdownMarkers } from '@/lib/inlineMarkers'
import type { Entry } from '@/lib/types'
import { clip, type LedgerThread, type RangeLedger } from '@/features/ascent/ledger/build'
import type { SpanExtras } from '@/features/ascent/ledger/load'
import { loadRangeLedger, loadSpanExtras } from '@/features/ascent/ledger/load'
import { fmtDay } from '@/features/ascent/ledger/Passage'
import { SpanPhotos } from '@/features/ascent/ledger/SpanPhotos'
import { WriteSheet } from '@/features/ascent/ledger/WriteSheet'
import { ThreadAcross } from '@/features/ascent/ledger/ThreadAcross'
import type { Seed } from '@/features/ascent/ledger/write'
import { CoverArt } from './Cover'
import { coverPhotos, fmtVolumeRange } from './Shelf'
import { volumeTitle, type Volume } from './volumes'
import './Volumes.css'

const MON_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const fullDay = (d: string) => `${MON_LONG[+d.slice(5, 7) - 1]} ${+d.slice(8, 10)}, ${d.slice(0, 4)}`

/** The first line of a page as the writer reads it. */
export function firstLine(e: Entry | undefined): string {
  if (!e) return ''
  const l = entryContentLines(e.body_markdown)
    .map((x) => stripMarkdownMarkers(x).replace(/^#{1,6}\s+/, '').trim())
    .find((x) => x.length > 0)
  return l ? clip(l) : ''
}

/** Neighbours placed at their shelf positions, for volumeTitle's lookup. */
function spread(vs: Volume[]): Volume[] {
  const out: Volume[] = []
  for (const v of vs) out[v.n - 1] = v
  return out
}

const EMPTY: RangeLedger = { from: '', to: '', months: [], threads: [], stones: [] }

/**
 * A VOLUME, READ BACK — what an app never hands you: a finished notebook to
 * pick up. Its first page and its last; what it opened carrying from the one
 * before; its photos; who was new in its pages; what ran through it; what it
 * carried into the next. Then a page of your own about it.
 */
export function VolumeView({
  volume,
  prev,
  next,
  entries,
  names,
  onClose,
  onOpenPage,
  onWalk,
  onOpenEntry,
  onName,
  lit,
  looking,
  backLabel = '← the shelf',
}: {
  /** Says where the way up goes — the shelf, or the pages it was opened from. */
  backLabel?: string | undefined
  volume: Volume
  /** Pages lit by the filter above, if one is set. */
  lit?: Set<string> | null | undefined
  /** What the filter is looking for, said plainly ("Meghan + prayer"). */
  looking?: string | undefined
  prev: Volume | undefined
  next: Volume | undefined
  entries: Entry[]
  names: Record<string, string> | undefined
  onClose: () => void
  /** Open a page over the wall (the reader). */
  onOpenPage: (entryId: string) => void
  /** Zoom into the wall at this volume's first page. */
  onWalk: (v: Volume) => void
  /** Open a page in the editor. */
  onOpenEntry: (entryId: string) => void
  onName: (v: Volume, name: string) => void
}) {
  const byId = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries])
  const first = byId.get(volume.firstId)
  const last = byId.get(volume.lastId)
  const photo = useMemo(() => coverPhotos([volume], entries).get(volume.n) ?? null, [volume, entries])
  const [ledger, setLedger] = useState<RangeLedger | null>(null)
  const [carriedIn, setCarriedIn] = useState<LedgerThread[]>([])
  const [carriedOut, setCarriedOut] = useState<LedgerThread[]>([])
  const [extras, setExtras] = useState<SpanExtras | null>(null)
  const [seed, setSeed] = useState<Seed | null>(null)
  const [naming, setNaming] = useState(false)
  const [across, setAcross] = useState<LedgerThread | null>(null)
  const around = [prev, volume, next].filter((v): v is Volume => !!v)
  const title = volumeTitle(volume, names, spread(around))
  // The filter above reaches into the volume: the pages in it that match.
  const found = useMemo(
    () => (lit ? volume.ids.filter((id) => lit.has(id)).map((id) => byId.get(id)).filter((e): e is Entry => !!e) : []),
    [lit, volume, byId],
  )

  useEffect(() => {
    let alive = true
    setLedger(null)
    setExtras(null)
    const all = { keep: Infinity, minMentions: 1 }
    void Promise.all([
      loadRangeLedger(volume.from, volume.to, all),
      prev ? loadRangeLedger(prev.from, prev.to, all) : Promise.resolve(EMPTY),
      next ? loadRangeLedger(next.from, next.to, all) : Promise.resolve(EMPTY),
      loadSpanExtras(volume.from, volume.to),
    ]).then(
      ([here, before, after, x]) => {
        if (!alive) return
        const beforeIds = new Set(before.threads.map((t) => t.id))
        const afterIds = new Set(after.threads.map((t) => t.id))
        setLedger({ ...here, threads: here.threads.slice(0, 6) })
        setCarriedIn(here.threads.filter((t) => beforeIds.has(t.id)).slice(0, 5))
        setCarriedOut(here.threads.filter((t) => afterIds.has(t.id)).slice(0, 5))
        setExtras(x)
      },
      () => {
        if (!alive) return
        setLedger(EMPTY)
        setExtras({ photos: [], news: [] })
      },
    )
    return () => {
      alive = false
    }
  }, [volume, prev, next])

  function write() {
    const lines = [first, last]
      .filter((e): e is Entry => !!e)
      .map((e) => ({ date: e.created_at.slice(0, 10), text: firstLine(e) }))
      .filter((l) => l.text)
    setSeed({
      title,
      groups: [
        { label: 'The first page', lines: lines.slice(0, 1) },
        { label: volume.closed ? 'The last page' : 'The latest page', lines: lines.slice(1, 2) },
      ],
    })
  }

  return (
    <div className="vol-view">
      <button type="button" className="vol-view__back" onClick={onClose}>
        {backLabel}
      </button>

      <header className="vol-view__head">
        <span className="vol-view__cover">
          <CoverArt volume={volume} photo={photo} />
          <span className="vol-card__n">{volume.n}</span>
        </span>
        <div>
          <div className="vol-eyebrow">{volume.closed ? 'Closed when it was full' : 'Being written'}</div>
          {naming ? (
            <input
              className="vol-view__nameinput"
              autoFocus
              defaultValue={names?.[volume.firstId] ?? ''}
              placeholder="Call it something — or leave it"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onName(volume, (e.target as HTMLInputElement).value)
                  setNaming(false)
                }
                if (e.key === 'Escape') setNaming(false)
              }}
              onBlur={(e) => {
                onName(volume, e.target.value)
                setNaming(false)
              }}
            />
          ) : (
            <h2 className="vol-view__title">{title}</h2>
          )}
          <p className="vol-view__range">
            {names?.[volume.firstId] ? fmtVolumeRange(volume) : ''}
            {!naming ? (
              <button type="button" className="vol-view__name" onClick={() => setNaming(true)}>
                {names?.[volume.firstId] ? 'rename' : '+ give it a name'}
              </button>
            ) : null}
          </p>
          {carriedIn.length > 0 ? (
            <p className="vol-view__carried">Opened carrying: {carriedIn.map((t) => t.label).join(' · ')}</p>
          ) : null}
          <button type="button" className="vol-view__walk" onClick={() => onWalk(volume)}>
            Walk its pages →
          </button>
        </div>
      </header>

      {lit ? (
        <section className="vol-mod vol-found">
          <span className="vol-eyebrow">{looking ? `${looking} — in these pages` : 'What you’re looking for — in these pages'}</span>
          {found.length === 0 ? (
            <p className="vol-quiet">Not in this one.</p>
          ) : (
            <div className="vol-found__list">
              {found.map((e) => (
                <button key={e.id} type="button" className="vol-found__row" onClick={() => onOpenPage(e.id)}>
                  <span className="vol-found__d">{fmtDay(e.created_at.slice(0, 10))}</span>
                  <span className="vol-found__t">{firstLine(e)}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      ) : null}

      <section className="vol-mod">
        <span className="vol-eyebrow">Its first page, and its {volume.closed ? 'last' : 'latest'}</span>
        <div className="vol-ends">
          {[first, last].map((e, i) =>
            e ? (
              <button key={e.id + i} type="button" className="vol-end" onClick={() => onOpenPage(e.id)}>
                <span className="vol-end__k">{i === 0 ? 'The first page' : volume.closed ? 'The last page' : 'The latest page'}</span>
                <span className="vol-end__d">{fullDay(e.created_at.slice(0, 10))}</span>
                <span className="vol-end__t">{firstLine(e)}</span>
              </button>
            ) : null,
          )}
        </div>
      </section>

      <section className="vol-mod">
        <span className="vol-eyebrow">Photos from these pages</span>
        {extras ? <SpanPhotos photos={extras.photos} onOpenEntry={onOpenPage} empty="No photos in this volume." /> : null}
      </section>

      <section className="vol-mod">
        <span className="vol-eyebrow">New in these pages</span>
        {extras ? (
          extras.news.length === 0 ? (
            <p className="vol-quiet">No one new came into these pages.</p>
          ) : (
            <div className="vol-news">
              {extras.news.map((n) => (
                <button key={n.label} type="button" className="vol-new" onClick={() => onOpenPage(n.entryId)}>
                  <span className="vol-new__label">{n.label}</span>
                  <span className="vol-new__first">first on {fmtDay(n.date)}</span>
                  <span className="vol-new__line">{n.line}</span>
                </button>
              ))}
            </div>
          )
        ) : null}
      </section>

      <section className="vol-mod">
        <span className="vol-eyebrow">What ran through it</span>
        {!ledger ? (
          <p className="vol-quiet">Reading the volume…</p>
        ) : ledger.threads.length === 0 ? (
          <p className="vol-quiet">Only its pages — nothing you were carrying ran through it.</p>
        ) : (
          <div className="vol-ran">
            {ledger.threads.map((t) => {
              const l = t.lines[t.lines.length - 1]
              return (
                <div key={t.id} className="vol-ran__row">
                  <button type="button" className="vol-ran__name" onClick={() => setAcross(t)} title="The whole thread, across your volumes">
                    {t.label}
                  </button>
                  {l ? (
                    <button type="button" className="vol-ran__line" onClick={() => onOpenPage(l.entryId)}>
                      “{l.text}”<small>{fmtDay(l.date)}</small>
                    </button>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {carriedOut.length > 0 && next ? (
        <section className="vol-mod">
          <span className="vol-eyebrow">Carried into {volumeTitle(next, names, spread(around))}</span>
          <p className="vol-view__carriedout">{carriedOut.map((t) => t.label).join(' · ')}</p>
        </section>
      ) : null}

      <section className="vol-write">
        <h3>Read it back, then write</h3>
        <p>A new page with this volume’s first and last lines above it, and a question you choose.</p>
        <button type="button" className="vol-btn is-solid" onClick={write}>
          Write about {title} →
        </button>
      </section>

      {seed ? <WriteSheet seed={seed} onClose={() => setSeed(null)} onOpenEntry={onOpenEntry} /> : null}
      {across ? <ThreadAcross thread={across} onClose={() => setAcross(null)} onOpenEntry={onOpenPage} /> : null}
    </div>
  )
}
