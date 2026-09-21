import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useSettings } from '@/hooks/useSettings'
import { useSwipeToDismiss } from '@/hooks/useSwipeToDismiss'
import type { Entry } from '@/lib/types'
import { computeVolumes, spanName, volumeColour, volumeTitle, type Volume } from '@/features/volumes/volumes'
import type { LedgerLine, LedgerThread } from './build'
import { KIND_COPY, LEDGER_COPY } from './copy'
import { loadArchive, loadThreadAcross } from './load'
import { fmtDay } from './Passage'
import { WriteSheet } from './WriteSheet'
import type { Seed } from './write'

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const range = (v: Volume) => {
  const f = (d: string) => `${MON[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`
  return v.closed ? `${f(v.from)} – ${f(v.to)}` : `${f(v.from)} – now`
}

type Chapter = { type: 'chapter'; volume: Volume; lines: LedgerLine[] } | { type: 'gap'; from: Volume; to: Volume }

/** Lines grouped by the volume they were written in, with the volumes a thread
 *  skipped kept as gaps — "not in Volume 23; then you came back to it". */
export function chapters(lines: LedgerLine[], volumes: Volume[]): Chapter[] {
  const byId = new Map<string, Volume>()
  for (const v of volumes) for (const id of v.ids) byId.set(id, v)
  const groups: { volume: Volume; lines: LedgerLine[] }[] = []
  for (const l of lines) {
    const v = byId.get(l.entryId)
    if (!v) continue
    const last = groups[groups.length - 1]
    if (last && last.volume.n === v.n) last.lines.push(l)
    else groups.push({ volume: v, lines: [l] })
  }
  const out: Chapter[] = []
  groups.forEach((g, i) => {
    const prev = groups[i - 1]
    if (prev && g.volume.n - prev.volume.n > 1) {
      out.push({ type: 'gap', from: volumes[prev.volume.n]!, to: volumes[g.volume.n - 2]! })
    }
    out.push({ type: 'chapter', volume: g.volume, lines: g.lines })
  })
  return out
}

/** Enough lines per chapter to read; the page itself is one tap away. */
const PER_CHAPTER = 5

/**
 * A THREAD, ACROSS VOLUMES — the whole life of something you kept returning
 * to, told in the notebooks it passed through. Volumes give a thread its
 * chapters; the thread gives the volumes their continuity.
 */
export function ThreadAcross({
  thread,
  focus,
  onClose,
  onOpenEntry,
}: {
  /** The thread as the calling view has it — shown until its whole life loads. */
  thread: LedgerThread
  /** Opened from a card that stands for many pages: those pages first ("In
   *  Fall 2026" — why it's on the card), then its whole life below. */
  focus?: { label: string; why: string; lines: LedgerLine[] } | undefined
  onClose: () => void
  onOpenEntry?: ((entryId: string) => void) | undefined
}) {
  const { settings } = useSettings()
  const [whole, setWhole] = useState<LedgerThread | null>(null)
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [seed, setSeed] = useState<Seed | null>(null)

  useEffect(() => {
    let alive = true
    void Promise.all([loadThreadAcross(thread.id), loadArchive()]).then(
      ([t, es]) => {
        if (!alive) return
        setWhole(t)
        setEntries(es)
      },
      () => alive && setEntries([]),
    )
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      alive = false
      window.removeEventListener('keydown', onKey)
    }
  }, [thread.id, onClose])

  // On a phone this is a pushed view covering the whole screen, and a pushed
  // view is left by dragging it off to the right — the same gesture the Altar
  // strand, the Lamp book and the page reader answer to. Without it the only
  // way back was a 10px "close" in the corner, which is the one place a thumb
  // never reaches.
  const isMobile = useIsMobile()
  const { handlers, dragX, dragging } = useSwipeToDismiss({ onDismiss: onClose, enabled: isMobile })

  const t = whole ?? thread
  const volumes = useMemo(() => (entries ? computeVolumes(entries, settings.volumeClosings).volumes : []), [entries, settings.volumeClosings])
  const parts = useMemo(() => chapters(t.lines, volumes), [t.lines, volumes])
  const inVolumes = parts.filter((p) => p.type === 'chapter').length

  return createPortal(
    <div className="across" role="dialog" aria-modal="true" aria-label={t.label}>
      <button type="button" className="across__scrim" aria-label={LEDGER_COPY.close} onClick={onClose} />
      <div
        className="across__sheet"
        data-sheet-scroll
        data-dragging={dragging ? 'true' : undefined}
        {...handlers}
        style={dragging ? { transform: `translateX(${dragX}px)` } : undefined}
      >
        <div className="across__bar">
          <span>A thread, across your volumes</span>
          <button type="button" onClick={onClose}>
            {LEDGER_COPY.close}
          </button>
        </div>
        <h2 className="across__title">{t.label}</h2>
        <p className="across__sub">
          {LEDGER_COPY.kind[t.kind]}
          {inVolumes > 0 ? ` · runs through ${inVolumes} volume${inVolumes === 1 ? '' : 's'}` : ''}
        </p>
        {focus && focus.lines.length > 0 ? (
          <section className="across__focus">
            <div className="across__chname">In {focus.label}</div>
            <p className="across__why">{focus.why}</p>
            <ol className="across__lines">
              {focus.lines.map((l, j) => (
                <li key={`${l.entryId}${j}`}>
                  <button type="button" onClick={() => onOpenEntry?.(l.entryId)}>
                    <span className="across__when">{fmtDay(l.date)}</span>
                    <span className="across__text">{l.text}</span>
                    {l.kind !== 'story' ? <span className="across__kind">{KIND_COPY[l.kind]}</span> : null}
                  </button>
                </li>
              ))}
            </ol>
            <div className="across__whole">The whole thread, across your volumes</div>
          </section>
        ) : null}
        {inVolumes > 0 ? (
          <div className="across__spines" aria-hidden>
            {volumes.slice(Math.max(0, parts.find((p) => p.type === 'chapter') ? (parts.find((p) => p.type === 'chapter') as { volume: Volume }).volume.n - 3 : 0)).map((v) => (
              <span
                key={v.firstId}
                className={`across__spine${parts.some((p) => p.type === 'chapter' && p.volume.n === v.n) ? ' is-on' : ''}`}
                style={{ background: volumeColour(v) }}
                title={volumeTitle(v, settings.volumeNames, volumes)}
              />
            ))}
          </div>
        ) : null}

        {!entries ? <p className="across__quiet">Reading the archive…</p> : null}

        {parts.map((p, i) =>
          p.type === 'gap' ? (
            <p key={`gap${i}`} className="across__gap">
              — not in {p.from.n === p.to.n ? volumeTitle(p.from, settings.volumeNames, volumes) : spanName(p.from.from, p.to.to)}; then you came back to it —
            </p>
          ) : (
            <section key={p.volume.firstId} className="across__chapter">
              <div className="across__ch">
                <i style={{ background: volumeColour(p.volume) }} />
                <div>
                  <div className="across__chname">In {volumeTitle(p.volume, settings.volumeNames, volumes)}</div>
                  <div className="across__chdates">{range(p.volume)}</div>
                </div>
              </div>
              <ol className="across__lines">
                {(p.lines.length > PER_CHAPTER ? [...p.lines.slice(0, 2), ...p.lines.slice(-(PER_CHAPTER - 2))] : p.lines).map((l, j) => (
                  <li key={`${l.entryId}${j}`}>
                    <button type="button" onClick={() => onOpenEntry?.(l.entryId)}>
                      <span className="across__when">
                        {fmtDay(l.date)} {l.date.slice(0, 4)}
                      </span>
                      <span className="across__text">{l.text}</span>
                      {l.kind !== 'story' ? <span className="across__kind">{KIND_COPY[l.kind]}</span> : null}
                    </button>
                  </li>
                ))}
              </ol>
              {p.lines.length > PER_CHAPTER ? <p className="across__more">and more in this volume</p> : null}
            </section>
          ),
        )}

        <div className="across__write">
          <button
            type="button"
            className="story__write is-solid"
            onClick={() =>
              setSeed({
                title: t.label,
                groups: parts
                  .filter((p): p is Extract<Chapter, { type: 'chapter' }> => p.type === 'chapter')
                  .slice(-3)
                  .map((p) => ({
                    label: `In ${volumeTitle(p.volume, settings.volumeNames, volumes)}`,
                    lines: [p.lines[0]!, ...(p.lines.length > 1 ? [p.lines[p.lines.length - 1]!] : [])].map((l) => ({ date: l.date, text: l.text })),
                  })),
              })
            }
          >
            {LEDGER_COPY.writeAbout}
          </button>
        </div>
      </div>
      {seed ? <WriteSheet seed={seed} onClose={() => setSeed(null)} onOpenEntry={onOpenEntry} /> : null}
    </div>,
    document.body,
  )
}
