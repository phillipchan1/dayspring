// Life Map — the surface.
//
// Four flat lists: People · Places · Domains · Matters. Type into any of them;
// what Dayspring found is amber. See docs/LIFE_MAP.md, and
// docs/prototypes/life-map.html for the design this is built from.

import { useState } from 'react'
import { useLifeMap, keepItem, addTyped, dropItem } from './useLifeMap'
import type { LifeMapItem, LifeMapSection, SectionId } from './lifeMap'
import { tallies } from './lifeMap'
import './LifeMap.css'

/**
 * One geometric mark per kind, and its COLOUR carries provenance.
 *
 * Deliberately not a second icon. Every chip already has this glyph, so a wand
 * or a sparkle beside it would compete with the mark that says what a thing is —
 * and would say the word BRANDSCRIPT rules out ("AI-powered … it frightens this
 * audience"). Amber on the glyph the chip already has costs nothing and reads at
 * a glance across forty of them.
 */
function Glyph({ kind, found }: { kind: SectionId; found: boolean }) {
  const c = found ? 'var(--dayspring-amber)' : 'var(--text-faint)'
  const common = { className: 'lifemap__glyph', viewBox: '0 0 12 12', 'aria-hidden': true } as const
  switch (kind) {
    case 'person':
      return (
        <svg {...common}>
          <circle cx="6" cy="6" r="3.4" fill={c} />
        </svg>
      )
    case 'place':
      return (
        <svg {...common}>
          <path d="M6 1.6 10 6 6 10.4 2 6Z" fill={c} />
        </svg>
      )
    case 'domain':
      return (
        <svg {...common}>
          <rect x="2.3" y="2.3" width="7.4" height="7.4" rx="1.2" fill={c} />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <circle cx="6" cy="6" r="3.6" fill="none" stroke={c} strokeWidth="1.4" strokeDasharray="2 1.6" />
        </svg>
      )
  }
}

function Chip({
  item,
  onKeep,
  onDrop,
}: {
  item: LifeMapItem
  onKeep: () => void
  onDrop: () => void
}) {
  const waiting = item.provenance === 'waiting'
  const found = item.provenance !== 'mine'
  return (
    <span
      className="lifemap__chip"
      data-found={found && !waiting}
      data-waiting={waiting}
      title={
        item.provenance === 'mine'
          ? 'You added this'
          : waiting
            ? 'Dayspring found this — not yours until you keep it'
            : 'Dayspring found this — you kept it'
      }
    >
      <Glyph kind={item.section} found={found} />
      <span className="lb">{item.label}</span>
      {item.pages > 0 && <span className="n">{item.pages}</span>}
      {waiting && (
        <button type="button" className="keep" onClick={onKeep}>
          keep
        </button>
      )}
      <button type="button" className="x" onClick={onDrop} aria-label={`Remove ${item.label}`}>
        ×
      </button>
    </span>
  )
}

function Section({
  section,
  onChanged,
}: {
  section: LifeMapSection
  onChanged: () => void
}) {
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const label = draft.trim()
    if (label.length < 2) return
    setDraft('')
    await addTyped(label, section.id)
    onChanged()
  }

  const act = (fn: () => Promise<void>) => () => {
    void fn().then(onChanged)
  }

  return (
    <section className="lifemap__sec">
      <div className="lifemap__sec-head">
        <Glyph kind={section.id} found={false} />
        <span className="lifemap__sec-name">{section.label}</span>
        <span className="lifemap__info-wrap" data-open={pinned}>
          <button
            type="button"
            className="lifemap__info"
            aria-label={`What are ${section.label}?`}
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
            onKeep={act(() => keepItem(item))}
            onDrop={act(() => dropItem(item.key))}
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
          />
        </form>
      </div>

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
                  onKeep={act(() => keepItem(item))}
                  onDrop={act(() => dropItem(item.key))}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}

export function LifeMapView() {
  const { map, error, refresh } = useLifeMap()

  if (error) return <div className="lifemap__state">{error}</div>
  if (!map) return <div className="lifemap__state">Reading your journal…</div>

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

        {map.sections.map((section) => (
          <Section key={section.id} section={section} onChanged={refresh} />
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
            <b>{t.found + t.waiting}</b>
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
