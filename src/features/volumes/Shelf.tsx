import { useMemo } from 'react'
import type { Entry } from '@/lib/types'
import { photosIn, type SpanPhoto } from '@/features/ascent/ledger/extras'
import { CoverArt, CoverStyle } from './Cover'
import { volumeTitle, type Volume } from './volumes'
import './Volumes.css'

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export function fmtVolumeRange(v: Volume): string {
  const f = (d: string) => `${MON[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`
  if (!v.closed) return `${f(v.from)} – now`
  return f(v.from) === f(v.to) ? f(v.from) : `${f(v.from)} – ${f(v.to)}`
}

/** The first photo on a volume's pages, for its cover. */
export function coverPhotos(volumes: Volume[], entries: Entry[]): Map<number, SpanPhoto> {
  const byId = new Map(entries.map((e) => [e.id, e]))
  const out = new Map<number, SpanPhoto>()
  for (const v of volumes) {
    for (const id of v.ids) {
      const e = byId.get(id)
      if (!e || !e.body_markdown.includes('attachment:')) continue
      const p = photosIn([e], '0000-01-01', '9999-12-31')[0]
      if (p) {
        out.set(v.n, p)
        break
      }
    }
  }
  return out
}

/**
 * THE SHELF — Pages, from as far back as you can stand. Every volume you've
 * filled, covers facing out, on the calendar: a row per year (the latest year
 * first) and, within a year, left to right in the order they were written — so
 * the shelf reads like the dates on it. Looking for something marks every
 * volume it runs through with a ribbon; bracketed dates keep the volumes in
 * them; tap a cover to read the volume back.
 */
export function Shelf({
  volumes,
  all,
  bracketed = false,
  entries,
  names,
  lit,
  onOpen,
}: {
  /** The volumes to show (the dates bracketed above may narrow them). */
  volumes: Volume[]
  /** Every volume — titles look at their neighbours. */
  all?: Volume[] | undefined
  bracketed?: boolean | undefined
  entries: Entry[]
  names: Record<string, string> | undefined
  lit: Set<string> | null
  onOpen: (n: number) => void
}) {
  const photos = useMemo(() => coverPhotos(volumes, entries), [volumes, entries])
  // A row per year a volume BEGAN in, latest year first; within it, in order.
  const byYear = useMemo(() => {
    const m = new Map<string, Volume[]>()
    for (const v of volumes) {
      const y = v.from.slice(0, 4)
      m.set(y, [...(m.get(y) ?? []), v])
    }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [volumes])
  const ribboned = useMemo(() => {
    if (!lit) return null
    return new Set(volumes.filter((v) => v.ids.some((id) => lit.has(id))).map((v) => v.n))
  }, [volumes, lit])

  return (
    <div className={`vol-shelf${ribboned ? ' is-looking' : ''}`}>
      <div className="vol-shelf__top">
      <p className="vol-shelf__note">
        {volumes.length === 0 && bracketed
          ? 'No volume was being written in those dates.'
          : ribboned
            ? ribboned.size > 0
              ? 'A ribbon in every volume it runs through.'
              : 'None of these volumes carry it.'
            : ''}
      </p>
      <CoverStyle />
      </div>
      {byYear.map(([year, vs]) => (
        <section key={year} className="vol-shelf__year">
          <h3 className="vol-shelf__yearname">{year}</h3>
          <div className="vol-shelf__grid">
            {vs.map((v) => (
              <button
                key={v.firstId}
                type="button"
                className={`vol-card${v.closed ? '' : ' is-open'}${ribboned?.has(v.n) ? ' has-ribbon' : ''}`}
                onClick={() => onOpen(v.n)}
              >
                {ribboned?.has(v.n) ? <span className="vol-card__ribbon" aria-hidden /> : null}
                <span className="vol-card__cover">
                  <CoverArt volume={v} photo={photos.get(v.n) ?? null} />
                  <span className="vol-card__n">{v.n}</span>
                </span>
                <span className="vol-card__title">{volumeTitle(v, names, all ?? volumes)}</span>
                <span className="vol-card__dates">
                  {names?.[v.firstId]?.trim() ? fmtVolumeRange(v) : v.closed ? '' : 'being written'}
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
