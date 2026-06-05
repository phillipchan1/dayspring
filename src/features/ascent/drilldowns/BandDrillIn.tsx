import { useEffect, useId, useState } from 'react'
import { getBandTimeline, loadEntry } from '@/features/threads/data'
import type { BandTended, EntryDetail } from '@/features/threads/data'
import { SurfaceLoader } from '@/components/SurfaceLoader'
import { warmthSvg, shortLens } from '../warmth'
import { DrillSheet } from './DrillSheet'

interface Props {
  bandId: string
  bandKind: 'rope' | 'thread'
  label: string
  onClose: () => void
}

/**
 * Click-in for a warmth band (rope or standalone thread). The band reappears
 * small at the top — the encoding confirming itself — then its whole tended life:
 * member moments ordered by entry_created_at, `bringing` a muted hollow node,
 * `meeting` a gold lit node, and a deterministic reframe (template, never LLM).
 * Tapping a moment opens its source entry inline — real text, never rewritten.
 * Tending actions stay parked ("held lightly"); the app asks "where was He?",
 * it never answers. No Echoes, no counts.
 */
export function BandDrillIn({ bandId, bandKind, label, onClose }: Props) {
  const [band, setBand] = useState<BandTended | null | undefined>(undefined)
  const miniId = useId().replace(/:/g, '')

  useEffect(() => {
    let alive = true
    setBand(undefined)
    getBandTimeline(bandId, bandKind).then(
      (b) => alive && setBand(b),
      () => alive && setBand(null),
    )
    return () => { alive = false }
  }, [bandId, bandKind])

  return (
    <DrillSheet title={label} onClose={onClose}>
      {band === undefined ? (
        <SurfaceLoader label="Walking the thread…" />
      ) : !band ? (
        <p className="ascent-dim__empty">This thread has rested — nothing to walk just now.</p>
      ) : (
        <div className="ascent-tended">
          {/* the band, small — the encoding confirms itself */}
          <div
            className="ascent-tended__mini"
            aria-hidden
            dangerouslySetInnerHTML={{ __html: warmthSvg(band.heft, band.lenses, band.pools, 'm' + miniId) }}
          />
          {band.lenses.length ? (
            <p className="ascent-tended__lenses">{band.lenses.map(shortLens).join(' · ')}</p>
          ) : null}

          <p className="ascent-tended__reframe">{band.reframe}</p>

          <ol className="ascent-path">
            {band.moments.map((m, i) => (
              <Moment key={m.entryId + i} entryId={m.entryId} date={m.date} register={m.register} excerpt={m.excerpt} />
            ))}
          </ol>

          <p className="ascent-tended__where">Where was He, here? — a question, not a verdict. Yours to name.</p>

          <div className="ascent-tended__tend">
            <span className="ascent-tended__tendlabel">held lightly — still deciding:</span>
            <button type="button" className="ascent-tended__tendact" onClick={() => { /* parked */ }}>rename</button>
            <button type="button" className="ascent-tended__tendact" onClick={() => { /* parked */ }}>hold privately</button>
          </div>
        </div>
      )}
    </DrillSheet>
  )
}

// ── one moment — muted (bringing) or gold (meeting), opening its entry inline ──

function Moment({ entryId, date, register, excerpt }: { entryId: string; date: string; register: string; excerpt: string }) {
  const [open, setOpen] = useState(false)
  const [entry, setEntry] = useState<EntryDetail | null | undefined>(undefined)

  function toggle() {
    const next = !open
    setOpen(next)
    if (next && entry === undefined) {
      loadEntry(entryId).then((e) => setEntry(e ?? null), () => setEntry(null))
    }
  }

  const when = (() => {
    try { return new Date(date).toLocaleDateString(undefined, { year: 'numeric', month: 'short' }) }
    catch { return date.slice(0, 7) }
  })()
  const kindLabel = register === 'meeting' ? 'where He met you' : register === 'bringing' ? 'you brought it again' : ''

  return (
    <li className={`ascent-path__moment ascent-tended__moment is-${register}`}>
      <span className="ascent-path__dot" aria-hidden />
      <div className="ascent-path__body">
        <span className="ascent-tended__when">
          {when}
          {kindLabel ? <span className="ascent-tended__kind">{kindLabel}</span> : null}
        </span>
        <button type="button" className="ascent-path__excerpt" onClick={toggle}>
          “{excerpt}”
          <span className="ascent-tended__open"> {open ? '— close' : '→ open entry'}</span>
        </button>
        {open ? (
          <div className="ascent-tended__entry">
            {entry === undefined ? (
              <span className="ascent-tended__loading">opening…</span>
            ) : !entry ? (
              <span className="ascent-tended__loading">entry not found.</span>
            ) : (
              <>
                <div className="ascent-tended__edate">
                  {(() => { try { return new Date(entry.date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) } catch { return entry.date.slice(0, 10) } })()}
                </div>
                <div className="ascent-tended__ebody">{entry.body}</div>
              </>
            )}
          </div>
        ) : null}
      </div>
    </li>
  )
}
