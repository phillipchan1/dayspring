// Life Map — the surface.
//
// Four flat lists: People · Places · Domains · Matters. Type into any of them;
// what Dayspring found is amber. See docs/LIFE_MAP.md, and
// docs/prototypes/life-map.html for the design this is built from.

import { useEffect, useRef, useState } from 'react'
import { useLifeMap, type LifeMap, type LifeMapNotice } from './useLifeMap'
import type { LifeMapItem, LifeMapSection, SectionId } from './lifeMap'
import { tallies } from './lifeMap'
import { LifeMapCanvas } from './LifeMapCanvas'
import { Glyph } from './Glyph'
import './LifeMap.css'

function Chip({
  item,
  onDrop,
  onOpen,
}: {
  item: LifeMapItem
  onDrop: () => void
  onOpen: () => void
}) {
  const found = item.provenance === 'found'
  return (
    <span
      className="lifemap__chip"
      data-found={found}
      title={found ? 'Dayspring found this — remove it if it is wrong' : 'You added this'}
    >
      {/*
        The name is the door. Clicking it opens Pages already filtered to this
        subject — the Life Map is where the vocabulary is tended, Pages is where
        it gets used, and this is the one gesture that says so.
      */}
      <button
        type="button"
        className="lifemap__open"
        onClick={onOpen}
        title={`Show the pages about ${item.label}`}
      >
        <Glyph kind={item.section} found={found} />
        <span className="lb">{item.label}</span>
        {item.pages > 0 && <span className="n">{item.pages}</span>}
      </button>
      <button type="button" className="x" onClick={onDrop} aria-label={`Remove ${item.label}`}>
        ×
      </button>
    </span>
  )
}

/**
 * The line under a section after something changed in it: a removal that can
 * still be taken back, or a write that did not land (and has been undone on
 * screen). In the room's own voice — plain, and never an alarm.
 */
function Notice({ notice, onUndo }: { notice: LifeMapNotice; onUndo?: (() => void) | undefined }) {
  return (
    <p className="lifemap__notice" role="status" data-kind={notice.kind}>
      {notice.kind === 'removed' ? (
        <>
          <span>{notice.label} is off your map.</span>
          {onUndo ? (
            <button type="button" className="lifemap__undo" onClick={onUndo}>
              Undo
            </button>
          ) : null}
        </>
      ) : (
        <span>{notice.text}</span>
      )}
    </p>
  )
}

/**
 * The ⓘ's explainer, pinned open by a tap, lets go the way an iOS popover
 * does: a tap anywhere outside it, or the page moving under it.
 */
function useLetGoOutside(open: boolean, ref: React.RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    const onScroll = () => close()
    document.addEventListener('pointerdown', onDown, true)
    window.addEventListener('scroll', onScroll, { capture: true, passive: true })
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('scroll', onScroll, { capture: true })
    }
  }, [open, ref, close])
}

function Section({
  section,
  notice,
  onAdd,
  onRemove,
  onUndo,
  onOpenSubject,
}: {
  section: LifeMapSection
  notice: LifeMapNotice | null
  onAdd: (label: string, section: SectionId) => void
  onRemove: (item: LifeMapItem) => void
  onUndo?: (() => void) | undefined
  onOpenSubject: (key: string) => void
}) {
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const infoRef = useRef<HTMLSpanElement>(null)
  const unpin = useRef(() => setPinned(false)).current
  useLetGoOutside(pinned, infoRef, unpin)

  // Shown at once; the hook writes it behind and takes it back if that fails.
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const label = draft.trim()
    if (label.length < 2) return
    setDraft('')
    onAdd(label, section.id)
  }

  return (
    <section className="lifemap__sec">
      <div className="lifemap__sec-head">
        <Glyph kind={section.id} found={false} />
        <span className="lifemap__sec-name">{section.label}</span>
        <span ref={infoRef} className="lifemap__info-wrap" data-open={pinned}>
          <button
            type="button"
            className="lifemap__info"
            aria-label={`What are ${section.label}?`}
            aria-expanded={pinned}
            onClick={() => setPinned((p) => !p)}
          >
            i
          </button>
          <span className="lifemap__pop" role="tooltip">
            {section.what}
          </span>
        </span>
        <span className="lifemap__sec-count">
          {section.items.length > 0 && (
            <>
              {section.items.length}
              {section.found > 0 && (
                <>
                  {' · '}
                  <b>{section.found}</b>
                </>
              )}
            </>
          )}
        </span>
      </div>

      <div className="lifemap__items">
        {section.items.map((item) => (
          <Chip
            key={item.key}
            item={item}
            onDrop={() => onRemove(item)}
            onOpen={() => onOpenSubject(item.key)}
          />
        ))}
        <form className="lifemap__add" onSubmit={submit}>
          <span aria-hidden>+</span>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={section.ask}
            aria-label={section.ask}
            // Return adds it: the keyboard says Done. Names are names —
            // capitalised as words, never "corrected".
            enterKeyHint="done"
            autoCorrect="off"
            autoCapitalize="words"
            autoComplete="off"
          />
        </form>
      </div>

      {notice ? <Notice notice={notice} onUndo={notice.kind === 'removed' ? onUndo : undefined} /> : null}

      {/*
        Earlier: filed, not hidden. One expander, and it says WHY the list is
        short — a stated rule the reader can overrule, never a ranking.
      */}
      {section.earlier.length > 0 && (
        <>
          <button
            type="button"
            className="lifemap__earlier"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <span className="lifemap__chev" aria-hidden>
              ›
            </span>
            {section.earlier.length} more, last written over a year ago
          </button>
          {open && (
            <div className="lifemap__past">
              {section.earlier.map((item) => (
                <Chip
                  key={item.key}
                  item={item}
                  onDrop={() => onRemove(item)}
                  onOpen={() => onOpenSubject(item.key)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}

export function LifeMapView({ onOpenSubject }: { onOpenSubject: (key: string) => void }) {
  const { map, error, notice, add, remove, undo } = useLifeMap()

  if (!map && error) return <div className="lifemap__state">{error}</div>
  if (!map) return <div className="lifemap__state">Reading your journal…</div>

  return (
    <LifeMapBody
      map={map}
      notice={notice}
      onAdd={add}
      onRemove={remove}
      onUndo={undo}
      onOpenSubject={onOpenSubject}
    />
  )
}

/**
 * The surface with its data handed in.
 *
 * Split from the hook so `?__preview=lifemap` can render it against fixtures —
 * this surface sits behind OAuth, and the same reason Pages has a preview
 * applies here: you cannot design what you cannot look at.
 */
export function LifeMapBody({
  map,
  notice = null,
  onAdd,
  onRemove,
  onUndo,
  onOpenSubject,
}: {
  map: LifeMap
  notice?: LifeMapNotice | null
  onAdd: (label: string, section: SectionId) => void
  onRemove: (item: LifeMapItem) => void
  onUndo?: () => void
  onOpenSubject: (key: string) => void
}) {
  const t = tallies(map.sections)

  return (
    <div className="lifemap">
      <div className="lifemap__inner">
        <div className="lifemap__head">
          <div>
            <h1 className="lifemap__title">Life Map</h1>
            <p className="lifemap__why">
              Name what&rsquo;s in your journal. It&rsquo;s how Dayspring can show it back to you
              with some intelligence.
            </p>
          </div>
        </div>

        <LifeMapCanvas sections={map.sections} />
        <div className="lifemap__legend">
          <span>
            older<i className="lifemap__ramp" />recent
          </span>
          <span>
            <svg className="lifemap__glyph" viewBox="0 0 12 12" aria-hidden>
              <circle cx="6" cy="6" r="3.4" fill="var(--dayspring-amber)" />
            </svg>
            <i className="lifemap__spec">found</i>
          </span>
        </div>

        {map.sections.map((section) => (
          <Section
            key={section.id}
            section={section}
            notice={notice && notice.section === section.id ? notice : null}
            onAdd={onAdd}
            onRemove={onRemove}
            onUndo={onUndo}
            onOpenSubject={onOpenSubject}
          />
        ))}

        <div className="lifemap__foot">
          <span>
            <b>{map.pages.toLocaleString()}</b> pages
          </span>
          <span title="You added these">
            <i className="lifemap__pip lifemap__pip--mine" />
            <b>{t.mine}</b>
          </span>
          <span title="Found by Dayspring">
            <i className="lifemap__pip lifemap__pip--auto" />
            <b>{t.found}</b>
          </span>
          {/*
            The floor, stated. A floor is filtering and can be overruled; "the
            most significant thirty" would be ranking, and ranking is a verdict.
          */}
          <span title="Anything you keep stays, however rarely it comes up">
            offered from {map.floor} pages up
          </span>
        </div>
      </div>
    </div>
  )
}
