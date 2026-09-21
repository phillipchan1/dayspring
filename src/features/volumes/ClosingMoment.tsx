import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { loadRangeLedger } from '@/features/ascent/ledger/load'
import type { Entry } from '@/lib/types'
import { CoverArt } from './Cover'
import { coverPhotos, fmtVolumeRange } from './Shelf'
import type { Volume } from './volumes'
import './Volumes.css'

/**
 * THE VOLUME CLOSES — the paper moment. You ran out of pages; the cover shuts.
 *
 * Shown on arriving in Pages, never in the editor (the writing surface is
 * sacred — Principle 3), and only after the page that filled it was written.
 * It names what is still going as the volume closes — carried into the next,
 * the way a paper journaler copies open prayers onto a new notebook's first
 * page. "Still going" is a date fact: written about in the volume's last weeks.
 */
export function ClosingMoment({
  volume,
  entries,
  onName,
  onRead,
  onDone,
}: {
  volume: Volume
  entries: Entry[]
  onName: (name: string) => void
  onRead: () => void
  onDone: () => void
}) {
  const [shut, setShut] = useState(false)
  const [name, setName] = useState('')
  const [carried, setCarried] = useState<string[]>([])
  const photo = coverPhotos([volume], entries).get(volume.n) ?? null

  useEffect(() => {
    const t = requestAnimationFrame(() => requestAnimationFrame(() => setShut(true)))
    // What's still going: threads written about in the volume's final month.
    const end = new Date(`${volume.to}T00:00:00Z`)
    end.setUTCDate(end.getUTCDate() - 30)
    const from = end.toISOString().slice(0, 10) > volume.from ? end.toISOString().slice(0, 10) : volume.from
    let alive = true
    loadRangeLedger(from, volume.to, { keep: 5, minMentions: 1 }).then(
      (l) => alive && setCarried(l.threads.map((t) => t.label)),
      () => {},
    )
    return () => {
      alive = false
      cancelAnimationFrame(t)
    }
  }, [volume])

  function finish(then: () => void) {
    if (name.trim()) onName(name.trim())
    then()
  }

  return createPortal(
    <div className="vol-closing" role="dialog" aria-modal="true" aria-label={`Volume ${volume.n} is full`}>
      <div className="vol-closing__scrim" />
      <div className="vol-closing__card">
        <div className={`vol-book${shut ? ' is-shut' : ''}`}>
          <span className="vol-book__back" />
          <span className="vol-book__cover">
            <CoverArt volume={volume} photo={photo} />
            <span className="vol-book__n">{volume.n}</span>
          </span>
        </div>
        <h2>This volume is full.</h2>
        <p className="vol-closing__sub">
          Volume {volume.n} · {fmtVolumeRange(volume)}. You wrote its last page on{' '}
          {new Date(`${volume.to}T12:00:00Z`).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}.
        </p>
        <label className="vol-closing__name">
          <span>What would you call this one? (optional — it goes on the cover)</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Leave it, or name it" />
        </label>
        {carried.length > 0 ? (
          <div className="vol-closing__carry">
            <span className="vol-eyebrow">Still going as it closes — carried into Volume {volume.n + 1}</span>
            <p>{carried.join(' · ')}</p>
          </div>
        ) : null}
        <div className="vol-closing__acts">
          <button type="button" className="vol-btn is-solid" onClick={() => finish(onRead)}>
            Read it back
          </button>
          <button type="button" className="vol-btn" onClick={() => finish(onDone)}>
            Put it on the shelf
          </button>
        </div>
        <p className="vol-closing__fine">Nothing changes where you write. Your next page begins Volume {volume.n + 1}.</p>
      </div>
    </div>,
    document.body,
  )
}
