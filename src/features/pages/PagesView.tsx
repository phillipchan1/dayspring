import { useEffect, useMemo, useRef, useState } from 'react'
import { SurfaceLoader } from '@/components/SurfaceLoader'
import { fetchAnniversarySenses, type AnniversarySense } from '@/lib/echoes'
import { WeatherGrid } from '@/features/remember/WeatherGrid'
import { buildFacts, buildWeather } from '@/features/remember/weather'
import type { EntryMenuAction } from '@/features/journal/EntryContextMenu'
import type { Mark } from '@/lib/marks'
import type { Settings } from '@/lib/settings'
import type { Entry } from '@/lib/types'
import { PageWall } from './PageWall'
import { Spread } from './Spread'
import { clampZoom, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from './zoom'
import {
  buildSubjectIndex,
  matchSubject,
  suggestedSubjects,
  wordSubject,
  type Subject,
} from './subjects'
import './Pages.css'

interface Props {
  /** The whole archive, newest first. */
  entries: Entry[]
  marks: Mark[]
  ready: boolean
  activeId: string | null
  /** Subject key from history, or null at rest. */
  subjectKey: string | null
  onSubject: (key: string | null) => void
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
   * The chosen subject. A typed word rebuilds from its own key, so lighting
   * survives a reload with no round trip; a concordance subject waits for the
   * list, which is why the key alone isn't enough to light the wall.
   */
  const subject: Subject | null = useMemo(() => {
    if (!subjectKey) return null
    if (subjectKey.startsWith('word:')) return wordSubject(subjectKey.slice(5))
    return suggested.find((s) => s.key === subjectKey) ?? null
  }, [subjectKey, suggested])

  const index = useMemo(() => buildSubjectIndex(entries), [entries])
  const lit = useMemo(
    () => (subject ? matchSubject(index, subject) : null),
    [index, subject],
  )

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
  const wallEntries = useMemo(
    () => (month == null ? entries : entries.filter((e) => new Date(e.created_at).getMonth() === month)),
    [entries, month],
  )

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

  function pickSubject(next: Subject | null) {
    setMonth(null)
    onSubject(next ? next.key : null)
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
                  pickSubject(next)
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
            {suggested.slice(0, 10).map((s) => (
              <button
                key={s.key}
                type="button"
                className="pg__chip"
                data-on={subjectKey === s.key ? 'true' : undefined}
                aria-pressed={subjectKey === s.key}
                onClick={() => pickSubject(subjectKey === s.key ? null : s)}
              >
                {s.label}
              </button>
            ))}
            {/* A typed word has no chip of its own, so it needs somewhere to be shown and let go of. */}
            {subject && !suggested.some((s) => s.key === subject.key) ? (
              <button type="button" className="pg__clear" onClick={() => pickSubject(null)}>
                {subject.label} ✕
              </button>
            ) : null}
          </div>

          {/*
            The density picture. With no subject this is writing activity, which
            Principle 2 would normally forbid — see D-017 in docs/product. What the
            override does NOT license: totals, goals, a current streak, or any copy
            about not having written. Empty cells stay quiet.

            Held to a narrow column deliberately. Stretched across a wide canvas
            the same grid stops reading as weather and starts reading as a
            scoreboard — the contributions-graph failure the guardrail names. It
            is a small strip beside the facts, never the thing you see first.
          */}
          <div className="pg__reading">
            <div className="pg__wx">
              <WeatherGrid
                weather={weather}
                month={month}
                onMonth={setMonth}
                noun="entry"
                nounPlural="entries"
              />
            </div>

            <div className="pg__facts">
              <Fact value={String(facts.count)} label={facts.count === 1 ? 'page' : 'pages'} />
              {facts.first ? <Fact value={facts.first} label="first" /> : null}
              {facts.latest ? <Fact value={facts.latest} label="most recent" /> : null}
              {/*
                The sharpest element on this surface. Over passages "longest silence"
                is a fact; over writing activity it edges toward telling someone how
                long they failed to show up. Kept because the override was deliberate —
                delete these three lines if the dry-season test ever fails.
              */}
              {facts.longestSilence >= 2 ? (
                <Fact value={`${facts.longestSilence} mo`} label="longest silence" />
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {subject && shown.length === 0 ? (
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
          lit={lit}
          activeId={activeId}
          // An echo is a page out of its own order. Interleaving one while the
          // wall is already rearranged — dimmed by a subject, or folded to a
          // single month — would make the arrangement impossible to read.
          echoes={!subject && month == null}
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

function Fact({ value, label }: { value: string; label: string }) {
  return (
    <div className="pg__fact">
      <div className="pg__fact-n">{value}</div>
      <div className="pg__fact-k">{label}</div>
    </div>
  )
}
