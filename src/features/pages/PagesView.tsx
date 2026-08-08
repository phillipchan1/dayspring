import { useEffect, useMemo, useRef, useState } from 'react'
import { SurfaceLoader } from '@/components/SurfaceLoader'
import { fetchAnniversarySenses, type AnniversarySense } from '@/lib/echoes'
import { buildFacts, buildWeather, MONTHS as MONTH_NAMES } from '@/features/remember/weather'
import type { EntryMenuAction } from '@/features/journal/EntryContextMenu'
import type { Mark } from '@/lib/marks'
import type { Settings } from '@/lib/settings'
import type { Entry } from '@/lib/types'
import { PageWall } from './PageWall'
import { Spread } from './Spread'
import { WeatherPanel } from './WeatherPanel'
import { clampZoom, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from './zoom'
import {
  buildSubjectIndex,
  keysFromSubjects,
  matchSubjects,
  subjectMatcher,
  suggestedSubjects,
  wordSubject,
  type Subject,
} from './subjects'
import { buildFacetIndex, facetChips, matchFacets } from './facets'
import './Pages.css'

interface Props {
  /** The whole archive, newest first. */
  entries: Entry[]
  marks: Mark[]
  ready: boolean
  activeId: string | null
  /**
   * Everything lit, from history: subject keys and facet keys in one
   * NUL-joined string. One field because they are one control — you don't think
   * "a word filter and a markings filter", you think "pages that say Naomi and
   * that I highlighted".
   */
  subjectKey: string | null
  onSubject: (key: string | null) => void
  /** The weather panel, on its own history frame. */
  panel: 'weather' | null
  onPanel: (panel: 'weather' | null) => void
  /** Entry id open in the Spread, or null on the wall. */
  spreadId: string | null
  onSpread: (entryId: string | null) => void
  /** Leave Pages for the editor. */
  onOpenEntry: (entryId: string) => void
  /** Per-entry context-menu actions — rename the date, duplicate, print, export. */
  onEntryMenuAction: (action: EntryMenuAction, entry: Entry) => void
  onDeleteEntries: (ids: string[], focusAfterId?: string | null) => void
  single: boolean
  settings: Settings
  updateSettings: (patch: Partial<Settings>) => void
}

/**
 * PAGES — the read surface.
 *
 * Dayspring's other Return surfaces all interpret: Ascent arranges seasons, Lamp
 * gathers verses, Altar follows prayers, Remember answers questions. Every one of
 * them hands back a reading of the archive. None of them hands back the archive.
 *
 * This does. It is the only surface where the app says nothing at all — it lays
 * the pages out, lights the ones you ask for, and gets out of the way. Everything
 * on screen is either the writer's own words or a number counted in code.
 */
export function PagesView({
  entries,
  marks,
  ready,
  activeId,
  subjectKey,
  onSubject,
  panel,
  onPanel,
  spreadId,
  onSpread,
  onOpenEntry,
  onEntryMenuAction,
  onDeleteEntries,
  single,
  settings,
  updateSettings,
}: Props) {
  const [suggested, setSuggested] = useState<Subject[]>([])
  const [senses, setSenses] = useState<AnniversarySense[]>([])
  const [draft, setDraft] = useState('')
  const [month, setMonth] = useState<number | null>(null)
  const [onlyLit, setOnlyLit] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const zoom = settings.pagesZoom
  const setZoom = (next: number) => updateSettings({ pagesZoom: clampZoom(next) })

  // Concordance chips are a convenience, not a requirement: the surface is fully
  // usable offline with typed words, so a failed read is silence, not an error.
  useEffect(() => {
    let alive = true
    void suggestedSubjects()
      .then((s) => {
        if (alive) setSuggested(s)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  // What you sensed on this day in an earlier year. A line, not a card: present
  // on the days there's something for and absent otherwise, so there is nothing
  // to dismiss and nothing to fall behind on.
  useEffect(() => {
    let alive = true
    void fetchAnniversarySenses()
      .then((s) => {
        if (alive) setSenses(s)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const markQuotes = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const mark of marks) {
      const list = m.get(mark.entryId)
      if (list) list.push(mark.quote)
      else m.set(mark.entryId, [mark.quote])
    }
    return m
  }, [marks])

  /**
   * Everything currently lit, split back out of the one history field.
   *
   * A typed word rebuilds from its own key, so lighting survives a reload with
   * no round trip; a concordance subject waits for the list, which is why the
   * key alone isn't enough to light the wall.
   */
  const keys = useMemo(() => (subjectKey ? subjectKey.split('\u0000').filter(Boolean) : []), [subjectKey])
  const facetKeys = useMemo(() => keys.filter((k) => !k.startsWith('word:') && !k.startsWith('c:')), [keys])
  const subjects: Subject[] = useMemo(() => {
    const out: Subject[] = []
    for (const key of keys) {
      if (key.startsWith('word:')) {
        const w = wordSubject(key.slice(5))
        if (w) out.push(w)
      } else if (key.startsWith('c:')) {
        const found = suggested.find((sub) => sub.key === key)
        if (found) out.push(found)
      }
    }
    return out
  }, [keys, suggested])

  const index = useMemo(() => buildSubjectIndex(entries), [entries])
  const facetIndex = useMemo(
    () => buildFacetIndex(entries, marks.map((m) => m.entryId)),
    [entries, marks],
  )
  const chips = useMemo(() => facetChips(facetIndex), [facetIndex])
  const match = useMemo(() => subjectMatcher(subjects), [subjects])

  /**
   * The lit set — every filter narrowing the last.
   *
   * Words and markings intersect rather than union. Lighting a second thing has
   * to mean "and also", or every filter you add hands back a bigger pile than
   * you started with.
   */
  const lit = useMemo(() => {
    const bySubject = matchSubjects(index, subjects)
    const byFacet = matchFacets(facetIndex, facetKeys)
    if (bySubject === null) return byFacet
    if (byFacet === null) return bySubject
    const both = new Set<string>()
    for (const id of bySubject) if (byFacet.has(id)) both.add(id)
    return both
  }, [index, subjects, facetIndex, facetKeys])

  const anyLit = keys.length > 0
  const litLabel = subjects.map((sub) => sub.label).join(' + ') || null

  /**
   * Every page on the wall.
   *
   * A subject DIMS rather than filters — that is the whole idea. Eleven years of
   * pages with the ones about one thing still lit is itself the density picture,
   * and it is made of the actual pages. Filtering them out would throw away the
   * shape and leave a search result.
   *
   * Folding a month is different, and does filter: it's the one arrangement a
   * notebook can't give you — every November you've written, in one place.
   */
  const wallEntries = useMemo(() => {
    let list = entries
    if (month != null) list = list.filter((e) => new Date(e.created_at).getMonth() === month)
    // "only these" is the one thing that turns lighting into filtering, and it
    // is a visible toggle sitting beside the lit chips — which is what makes it
    // different from a query left behind in a panel you can't see.
    if (onlyLit && lit) list = list.filter((e) => lit.has(e.id))
    return list
  }, [entries, month, onlyLit, lit])

  /**
   * The set the numbers describe — and therefore what the grid draws over.
   *
   * One rule, applied everywhere: the grid never describes a set that isn't on
   * screen. With a subject chosen it covers the matches; with none it covers the
   * whole archive, which is writing activity (D-017).
   */
  const shown = useMemo(
    () => (lit ? wallEntries.filter((e) => lit.has(e.id)) : wallEntries),
    [wallEntries, lit],
  )

  // Drawn over the subject-filtered set but NOT the month-filtered one: folding a
  // month must not erase the other months you're comparing it against.
  const gridSet = useMemo(
    () => (lit ? entries.filter((e) => lit.has(e.id)) : entries),
    [entries, lit],
  )
  const weather = useMemo(() => buildWeather(gridSet.map((e) => e.created_at)), [gridSet])
  const facts = useMemo(() => buildFacts(shown.map((e) => e.created_at)), [shown])

  // The Spread turns through everything on the wall, lit or not — a dimmed page
  // is still a page, and reaching it shouldn't require clearing the subject.
  const spreadIndex = useMemo(() => {
    if (!spreadId) return -1
    return wallEntries.findIndex((e) => e.id === spreadId)
  }, [wallEntries, spreadId])

  /** Add or remove one key. The wall never has a "clear all" it can't undo. */
  function toggleKey(key: string) {
    setMonth(null)
    const next = keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]
    onSubject(next.length > 0 ? next.join('\u0000') : null)
  }

  function addSubject(next: Subject) {
    setMonth(null)
    if (keys.includes(next.key)) return
    onSubject(keysFromSubjects([...subjects, next]) === null ? null : [...keys, next.key].join('\u0000'))
  }

  function clearAll() {
    setMonth(null)
    onSubject(null)
  }

  /** Flip the notebook open. Uniformly random — no algorithm, nothing recommended. */
  function openSomewhere() {
    const pool = shown.length > 0 ? shown : wallEntries
    if (pool.length === 0) return
    const pick = pool[Math.floor(Math.random() * pool.length)]
    if (pick) onSpread(pick.id)
  }

  if (!ready) {
    return (
      <div className="pg">
        <SurfaceLoader label="Opening your pages…" />
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="pg">
        <div className="pg__inner">
          <Head />
          <div className="pg__empty">
            <p className="pg__empty-h">Nothing to read back yet.</p>
            <p className="pg__empty-s">Pages fills as you write.</p>
          </div>
        </div>
      </div>
    )
  }

  if (panel === 'weather') {
    return (
      <div className="pg">
        <WeatherPanel
          weather={weather}
          facts={facts}
          month={month}
          onMonth={setMonth}
          onClose={() => onPanel(null)}
          subjectLabel={litLabel}
        />
      </div>
    )
  }

  if (spreadIndex >= 0) {
    return (
      <div className="pg">
        <Spread
          entries={wallEntries}
          index={spreadIndex}
          onIndex={(next) => {
            const entry = wallEntries[next]
            if (entry) onSpread(entry.id)
          }}
          onClose={() => onSpread(null)}
          single={single}
          markQuotes={markQuotes}
          firstLineTitle={settings.firstLineTitle}
          onEdit={onOpenEntry}
        />
      </div>
    )
  }

  return (
    <div className="pg">
      <div className="pg__head-wrap">
        <div className="pg__inner pg__inner--head">
          <Head />

          {senses.length > 0 ? (
            <div className="pg__senses">
              {senses.map((s) => (
                <p className="pg__sense" key={s.id}>
                  <span className="pg__sense-w">
                    On this day, {s.yearsAgo} {s.yearsAgo === 1 ? 'year' : 'years'} ago, you sensed
                  </span>
                  {s.entryId ? (
                    <button
                      type="button"
                      className="pg__sense-q"
                      onClick={() => onSpread(s.entryId!)}
                    >
                      {s.content}
                    </button>
                  ) : (
                    <span className="pg__sense-q">{s.content}</span>
                  )}
                </p>
              ))}
            </div>
          ) : null}

          <div className="pg__controls">
            {/*
              One continuous move, not three named stops.
              Wall / Shelf / Open were three samples of the same act, and naming
              them made you pick a mode instead of simply standing closer. The
              slider is the discoverable form of the gesture — pinch and
              ⌘-scroll on the wall itself do the same thing.
            */}
            <label className="pg__zoom">
              <span className="pg__zoom-icon" aria-hidden>▪</span>
              <input
                type="range"
                className="pg__zoom-range"
                min={ZOOM_MIN}
                max={ZOOM_MAX}
                step={0.01}
                value={zoom}
                aria-label="How close you're standing to the wall"
                onChange={(e) => setZoom(Number(e.target.value))}
                onKeyDown={(e) => {
                  // The native range step is 0.01 — a hundred presses end to
                  // end. Arrow keys take the same notch the ⌘= shortcut does.
                  if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                    e.preventDefault()
                    setZoom(zoom + ZOOM_STEP)
                  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                    e.preventDefault()
                    setZoom(zoom - ZOOM_STEP)
                  }
                }}
              />
              <span className="pg__zoom-icon pg__zoom-icon--near" aria-hidden>▬</span>
            </label>
            <button type="button" className="pg__somewhere" onClick={openSomewhere}>
              Open somewhere
            </button>
          </div>

          <div className="pg__subjects">
            <form
              className="pg__word"
              onSubmit={(e) => {
                e.preventDefault()
                const next = wordSubject(draft)
                if (next) {
                  addSubject(next)
                  setDraft('')
                  inputRef.current?.blur()
                }
              }}
            >
              <input
                ref={inputRef}
                className="pg__word-in"
                value={draft}
                placeholder="light up a word"
                aria-label="Light up the pages that carry a word"
                onChange={(e) => setDraft(e.target.value)}
              />
            </form>

            {/*
              Everything lit, as chips you can pull off one at a time.
              This is the answer to "we don't want people clicking a huge filter
              like a hotel search": what's on is always visible and always one
              click from off, and there is no panel of switches to hunt through.
            */}
            {subjects.map((sub) => (
              <button
                key={sub.key}
                type="button"
                className="pg__clear"
                onClick={() => toggleKey(sub.key)}
                aria-label={`Stop lighting ${sub.label}`}
              >
                {sub.label} ✕
              </button>
            ))}

            {chips.map((chip) => {
              const on = keys.includes(chip.key)
              return (
                <button
                  key={chip.key}
                  type="button"
                  className={chip.color ? 'pg__swatch' : 'pg__chip'}
                  data-on={on ? 'true' : undefined}
                  data-color={chip.color}
                  aria-pressed={on}
                  title={chip.color ? `Highlighted in ${chip.label}` : chip.label}
                  aria-label={chip.color ? `Highlighted in ${chip.label}` : chip.label}
                  onClick={() => toggleKey(chip.key)}
                >
                  {chip.color ? '' : chip.label}
                </button>
              )
            })}

            {/* Concordance suggestions come last: they are a handful of ways in,
                not a taxonomy, and they must never outrank the writer's own
                markings in the eye. */}
            {suggested
              .filter((sub) => !keys.includes(sub.key))
              .slice(0, 6)
              .map((sub) => (
                <button
                  key={sub.key}
                  type="button"
                  className="pg__chip pg__chip--subject"
                  onClick={() => addSubject(sub)}
                >
                  {sub.label}
                </button>
              ))}

            {anyLit ? (
              <>
                {/*
                  Dim or filter.

                  Dimming stays the default, because the pages that DON'T carry
                  a word are what give the ones that do their shape. But
                  sometimes the question really is "show me only those" — and a
                  visible toggle sitting next to the lit chips is not the
                  invisible-query problem, it is the cure for it.
                */}
                <button
                  type="button"
                  className="pg__only"
                  data-on={onlyLit ? 'true' : undefined}
                  aria-pressed={onlyLit}
                  onClick={() => setOnlyLit((v) => !v)}
                >
                  only these
                </button>
                <button type="button" className="pg__chip" onClick={clearAll}>
                  clear
                </button>
              </>
            ) : null}
          </div>

          {/*
            The way to the density picture — a line, not the picture itself.
            It used to sit here in full, which on a phone meant the grid and four
            numbers took the screen and one page peeked in underneath.
          */}
          <div className="pg__meta">
            <button type="button" className="pg__meta-b" onClick={() => onPanel('weather')}>
              {facts.count} {facts.count === 1 ? 'page' : 'pages'}
              {litLabel ? ` carrying “${litLabel}”` : ''} · the years
            </button>
            {month !== null ? (
              <button type="button" className="pg__clear" onClick={() => setMonth(null)}>
                every {MONTH_NAMES[month]} ✕
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {anyLit && shown.length === 0 ? (
        <div className="pg__inner">
          <div className="pg__empty">
            <p className="pg__empty-h">Nothing in your pages says that.</p>
            <p className="pg__empty-s">Better to return nothing than a forced match.</p>
          </div>
        </div>
      ) : (
        <PageWall
          entries={wallEntries}
          zoom={zoom}
          onZoom={setZoom}
          markQuotes={markQuotes}
          lit={onlyLit ? null : lit}
          match={match}
          activeId={activeId}
          // An echo is a page out of its own order. Interleaving one while the
          // wall is already rearranged — dimmed by a subject, or folded to a
          // single month — would make the arrangement impossible to read.
          echoes={!anyLit && month == null}
          onOpen={(id) => onSpread(id)}
          onEdit={onOpenEntry}
          onMenuAction={onEntryMenuAction}
          onDeleteEntries={onDeleteEntries}
        />
      )}
    </div>
  )
}

function Head() {
  return (
    <div className="pg__head">
      <p className="pg__eyebrow">Pages</p>
      <h1 className="pg__title">Your own, side by side</h1>
    </div>
  )
}

