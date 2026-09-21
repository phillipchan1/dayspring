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
 * filled, newest first, covers facing out. Looking for something marks every
 * volume it runs through with a ribbon; tap a cover to read the volume back.
 */
export function Shelf({
  volumes,
  entries,
  names,
  lit,
  onOpen,
}: {
  volumes: Volume[]
  entries: Entry[]
  names: Record<string, string> | undefined
  lit: Set<string> | null
  onOpen: (n: number) => void
}) {
  const photos = useMemo(() => coverPhotos(volumes, entries), [volumes, entries])
  const ribboned = useMemo(() => {
    if (!lit) return null
    return new Set(volumes.filter((v) => v.ids.some((id) => lit.has(id))).map((v) => v.n))
  }, [volumes, lit])

  return (
    <div className={`vol-shelf${ribboned ? ' is-looking' : ''}`}>
      <div className="vol-shelf__top">
      <p className="vol-shelf__note">
        {ribboned
          ? ribboned.size > 0
            ? 'A ribbon in every volume it runs through.'
            : 'None of your volumes carry it.'
          : 'Every volume you’ve filled. Each closed when it was full, the way a notebook does.'}
      </p>
      <CoverStyle />
      </div>
      <div className="vol-shelf__grid">
        {volumes
          .slice()
          .reverse()
          .map((v) => (
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
              <span className="vol-card__title">{volumeTitle(v, names)}</span>
              <span className="vol-card__dates">
                {fmtVolumeRange(v)}
                {v.closed ? '' : ' · being written'}
              </span>
            </button>
          ))}
      </div>
    </div>
  )
}
