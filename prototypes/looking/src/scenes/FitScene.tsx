import { useMemo, useState } from 'react'
import { ENTRIES, allMarkings, formatDate, type MarkingKind } from '../corpus'
import { hits } from '../lib'
import { Rail } from '../Shell'
import { FilterBar, type Chip, type Reading } from '../FilterBar'
import { Wall, matcherFor } from '../Wall'
import { Rows } from '../Rows'
import { STAND_LABEL, colsAt, linesAt, standAt } from '../zoom'
import { SubjectPage } from './SubjectPage'
import { offered, type Held } from '../subjects'

type Where = 'writing' | 'pages'

/**
 * Where this fits.
 *
 * ── The recommendation, on screen ───────────────────────────────────────────
 *
 * **No fifth surface, and no new key.** Looking-back is Entries, grown.
 *
 * SURFACES is explicit that Pages sits under Write because "it is a way of
 * looking at your entries, not a fifth thing to return to — so the rail still
 * shows four ways back." The Write/Return split is called the product's whole
 * thesis rather than a nav convenience, and a fifth Return item spends that
 * thesis on a feature.
 *
 * Two walls would also be the exact failure D-017 warned about — "two indexes
 * of the same archive on screen at once" — which is D-018's mistake wearing new
 * clothes.
 *
 * Almost everything here is a better version of something Pages already does:
 * the lighting bar becomes `look for`, the facets become the marking group, the
 * wall stays the wall. Only two things are new, and neither is a place you go
 * cold: **the chapter** and **the readings**. You arrive at Mom's chapter by
 * naming Mom, so the chapter is a STATE of Pages, not a sibling of it.
 *
 * ── They are two acts, not two modes ────────────────────────────────────────
 *
 * D-022 made List and Pages two reading modes of one panel and kept the panel
 * open across the switch, so they would read as siblings. They do not. Finding
 * a thing you already have in mind and coming across a thing you don't are
 * different acts, and holding a list of titles beside a wall of pages puts two
 * indexes of the same archive on screen at once — the clutter D-017 warned
 * about, arriving by the other door.
 *
 * So **Pages owns the canvas and the panel closes behind it**, exactly as the
 * other Return surfaces do. Entries goes back to being what it always was: a
 * list, beside the editor.
 *
 * ── Which puts it in Return ─────────────────────────────────────────────────
 *
 * Once it owns the canvas it behaves like a Return surface, so it should be
 * labelled as one. SURFACES' own words: the other three "all interpret... None
 * of them hands back the archive. This does." Being the Return surface that
 * does NOT interpret is the distinguishing virtue, and it already obeys the
 * Return rule to the letter — you go there to see, never to do.
 *
 * ── Where the kept subjects live now ────────────────────────────────────────
 *
 * Inside `look for`, and nowhere else. They were briefly at the top of the
 * entries list, which was RECALL Act two put in the panel — and that only made
 * sense while the panel came along. It doesn't, so they belong on the surface
 * they open.
 */
export function FitScene({ onOpen }: { onOpen?: (id: string) => void }) {
  const [where, setWhere] = useState<Where>('pages')
  const [chips, setChips] = useState<Chip[]>([])
  const [kept, setKept] = useState<Held[]>(() => offered().slice(0, 3).map((s) => ({ ...s, kept: true })))
  const [openId] = useState<string | null>(ENTRIES[ENTRIES.length - 1]!.id)
  const [reading, setReading] = useState<Reading>('order')
  const [split, setSplit] = useState(2025)
  const [zoom, setZoom] = useState(0.6)

  const offers = useMemo(() => offered(), [])
  const marks = useMemo(() => allMarkings(), [])
  const markCounts = useMemo(() => {
    const m = new Map<MarkingKind, number>()
    for (const k of marks) m.set(k.kind, (m.get(k.kind) ?? 0) + 1)
    return m
  }, [marks])

  const subjectChips = chips.filter((c) => c.kind === 'subject')
  const markKinds = chips.filter((c) => c.kind === 'mark').map((c) => c.mark)
  const terms = subjectChips.flatMap((c) => c.subject.terms)

  const lit = useMemo(() => {
    if (chips.length === 0) return null
    let set = new Set(ENTRIES.map((e) => e.id))
    if (terms.length) {
      const ok = new Set(ENTRIES.filter((e) => hits(e.paragraphs.join(' '), terms)).map((e) => e.id))
      set = new Set([...set].filter((id) => ok.has(id)))
    }
    for (const k of markKinds) {
      const ok = new Set(marks.filter((m) => m.kind === k).map((m) => m.entryId))
      set = new Set([...set].filter((id) => set.has(id) && ok.has(id)))
    }
    return set
  }, [chips, marks, terms])

  function add(chip: Chip) {
    setChips((prev) => (prev.some((c) => c.key === chip.key) ? prev : [...prev, chip]))
    setWhere('pages')
  }

  const open = ENTRIES.find((e) => e.id === openId) ?? ENTRIES[ENTRIES.length - 1]!

  return (
    <div className="fit" data-where={where}>
      <Rail active={where} onGo={(id) => setWhere(id === 'pages' ? 'pages' : 'writing')} />

      {/*
        Entries: the list, beside the editor. It is what it always was — a way
        to find something you already have in mind — and it does not follow you
        to Pages, because Pages is not a mode of it.
      */}
      {where === 'writing' ? (
        /*
          Writing, with nothing beside it.
          
          No panel, because the list is now the far end of the Pages zoom rather
          than a column that lives here. Nothing looking-back adds ever appears
          on this side — Principle 3, and the reason the mock draws it at all is
          to show the writing surface is untouched by every decision opposite.
        */
        <main className="canvas canvas--full">
          <div className="writing">
            <time className="writing__date">{formatDate(open.date)}</time>
            {open.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </main>
      ) : (
        /* Pages: the whole canvas, and no panel. */
        <main className="canvas canvas--full">
          <div className="canvas__scroll">
            <FilterBar
              chips={chips}
              subjects={kept}
              offered={offers}
              markCounts={markCounts}
              reading={reading}
              onReading={setReading}
              onAdd={add}
              onRemove={(key) => setChips((prev) => prev.filter((c) => c.key !== key))}
              onClear={() => setChips([])}
              onKeep={(s) => setKept((prev) => (prev.some((k) => k.key === s.key) ? prev : [...prev, { ...s, kept: true }]))}
              onDrop={(key) => setKept((prev) => prev.filter((k) => k.key !== key))}
              zoom={zoom}
              onZoom={setZoom}
              standLabel={STAND_LABEL[standAt(zoom)]}
            />

            {subjectChips.length > 0 ? (
              <SubjectPage
                key={subjectChips.map((c) => c.key).join('+')}
                subjects={subjectChips.map((c) => c.subject)}
                kinds={markKinds}
                reading={reading}
                split={split}
                onSplit={setSplit}
                onToggleKind={(k) => {
                  const key = `k:${k}`
                  setChips((prev) =>
                    prev.some((c) => c.key === key)
                      ? prev.filter((c) => c.key !== key)
                      : [...prev, { kind: 'mark', key, label: k, mark: k }],
                  )
                }}
                onKeep={(s) => setKept((prev) => [...prev, { ...s, kept: true }])}
                onOpen={onOpen}
                cols={5}
                zoom={zoom}
              />
            ) : (
              <>
                <p className="meta">
                  <b>{lit ? lit.size : ENTRIES.length}</b> pages · the years
                </p>
                {standAt(zoom) === 'rows' ? (
                  <Rows lit={lit} match={matcherFor(terms)} onOpen={onOpen} onWrite={onOpen} />
                ) : (
                  <Wall
                    lit={lit}
                    match={matcherFor(terms)}
                    cols={colsAt(zoom)}
                    maxLines={linesAt(zoom)}
                    glyphs
                    onOpen={onOpen}
                  />
                )}
              </>
            )}
          </div>
        </main>
      )}
    </div>
  )
}
