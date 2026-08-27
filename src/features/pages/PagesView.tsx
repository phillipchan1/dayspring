import { useEffect, useMemo, useRef, useState } from 'react'
import { SurfaceLoader } from '@/components/SurfaceLoader'
import { fetchAnniversarySenses, type AnniversarySense } from '@/lib/echoes'
import { buildFacts, buildWeather, MONTHS as MONTH_NAMES } from './weather'
import type { EntryMenuAction } from '@/features/journal/EntryContextMenu'
import type { Mark } from '@/lib/marks'
import type { Settings } from '@/lib/settings'
import type { Entry } from '@/lib/types'
import { PageWall } from './PageWall'
import { WeatherPanel } from './WeatherPanel'
import { clampZoom, READING_ZOOM, standLabel } from './zoom'
import {
  allSubjects,
  buildSubjectIndex,
  keysFromSubjects,
  matchSubjects,
  subjectMatcher,
  wordSubject,
  type Subject,
} from './subjects'
import { buildFacetIndex, markingChips, matchFacets } from './facets'
import { LookFor, type LookChip } from './LookFor'
import { ReadingView } from './ReadingView'
import { Chapter } from './Chapter'
import { defaultSplit, type Reading } from './readings'
import {
  dropSubject,
  keepSubject,
  listKeptSubjects,
  partitionKept,
  withVocabulary,
  type KeptSubject,
} from './keptSubjects'
import { listMarkings, type MarkingRef } from '@/lib/spiritual'
import './Pages.css'

/** The chip that stands for a question, since a question has no key of its own. */
const ASK_CHIP_KEY = 'asked'

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
  /**
   * A question asked from ⌘K, and the pages it found.
   *
   * Ask's semantic legs catch pages that circle a thing without ever naming it,
   * which literal matching can't — so its result arrives as its own lit set
   * rather than as words. It reads as a chip like everything else, and comes off
   * the same way.
   */
  asked: { question: string; entryIds: string[] } | null
  onClearAsked: () => void
  /** The weather panel, on its own history frame. */
  panel: 'weather' | null
  onPanel: (panel: 'weather' | null) => void
  /**
   * The page you zoomed to, or null.
   *
   * Opening a page is not a modal any more — it is the wall at reading zoom,
   * scrolled to that page. This is what it scrolls to, and what the
   * shared-element transition lands on.
   */
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
 * gathers verses, Altar follows prayers. Every one of them hands back a reading
 * of the archive. None of them hands back the archive.
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
  asked,
  onClearAsked,
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
  const [vocabulary, setVocabulary] = useState<Subject[]>([])
  const [senses, setSenses] = useState<AnniversarySense[]>([])
  const [month, setMonth] = useState<number | null>(null)
  const [onlyLit, setOnlyLit] = useState(false)
  const [kept, setKept] = useState<KeptSubject[]>([])
  // How the lit pages are arranged. Local rather than a history frame: it is a
  // way of looking at what is already on screen, not somewhere you went.
  const [reading, setReading] = useState<Reading>('order')
  const [split, setSplit] = useState<number | null>(null)
  const [markings, setMarkings] = useState<MarkingRef[]>([])
  // The last page opened in the Spread, kept so the wall knows which card the
  // reader should shrink back into when it closes.
  const lastSpreadRef = useRef<string | null>(null)
  if (spreadId) lastSpreadRef.current = spreadId
  const zoom = settings.pagesZoom
  const setZoom = (next: number) => updateSettings({ pagesZoom: clampZoom(next) })

  // Concordance chips are a convenience, not a requirement: the surface is fully
  // usable offline with typed words, so a failed read is silence, not an error.
  useEffect(() => {
    let alive = true
    void allSubjects()
      .then((s) => {
        if (alive) setVocabulary(s)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  // What she keeps, and every marking in the archive. Both are conveniences
  // rather than requirements — the wall reads fine with neither — so a failed
  // read is silence, the same contract the Concordance chips already have.
  useEffect(() => {
    let alive = true
    void listKeptSubjects()
      .then((k) => {
        if (alive) setKept(k)
      })
      .catch(() => {})
    void listMarkings()
      .then((m) => {
        if (alive) setMarkings(m)
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
        // Kept first: a kept subject outlives the Concordance row it came from,
        // and it has to keep lighting after a rebuild drops that row.
        const found = kept.find((sub) => sub.key === key) ?? vocabulary.find((sub) => sub.key === key)
        if (found) out.push(found)
      }
    }
    return out
  }, [keys, vocabulary, kept])

  const index = useMemo(() => buildSubjectIndex(entries), [entries])
  const facetIndex = useMemo(
    () => buildFacetIndex(entries, marks.map((m) => m.entryId), markings),
    [entries, marks, markings],
  )
  const markPills = useMemo(() => markingChips(facetIndex), [facetIndex])

  // Kept subjects keep matching against what the Concordance knows today, and
  // what is offered is everything else — so keeping something moves it between
  // two lists rather than adding it to a third.
  const held = useMemo(() => withVocabulary(kept, vocabulary), [kept, vocabulary])
  const offered = useMemo(() => partitionKept(vocabulary, held).offered, [vocabulary, held])
  const keptKeys = useMemo(() => new Set(held.map((k) => k.key)), [held])
  const match = useMemo(() => subjectMatcher(subjects), [subjects])

  /**
   * The lit set — every filter narrowing the last.
   *
   * Words and markings intersect rather than union. Lighting a second thing has
   * to mean "and also", or every filter you add hands back a bigger pile than
   * you started with.
   */
  const lit = useMemo(() => {
    const legs: (Set<string> | null)[] = [
      matchSubjects(index, subjects),
      matchFacets(facetIndex, facetKeys),
      asked ? new Set(asked.entryIds) : null,
    ]
    let hit: Set<string> | null = null
    for (const leg of legs) {
      if (leg === null) continue
      if (hit === null) {
        hit = leg
        continue
      }
      const narrowed = new Set<string>()
      for (const id of hit) if (leg.has(id)) narrowed.add(id)
      hit = narrowed
    }
    return hit
  }, [index, subjects, facetIndex, facetKeys, asked])

  /**
   * Everything on, in one list — the only place filter state is shown.
   *
   * A question, the words, then the markings. The bar renders these and nothing
   * else: what is on is visible, and every one of them comes off the same way.
   */
  const chips = useMemo(() => {
    const out: LookChip[] = []
    if (asked) out.push({ key: ASK_CHIP_KEY, label: asked.question, kind: 'subject' })
    for (const sub of subjects) out.push({ key: sub.key, label: sub.label, kind: 'subject' })
    for (const pill of markPills) {
      if (!keys.includes(pill.key)) continue
      out.push({ key: pill.key, label: pill.label, kind: 'marking', tone: pill.tone })
    }
    return out
  }, [asked, subjects, markPills, keys])

  const anyLit = keys.length > 0 || asked !== null
  const litLabel =
    asked?.question ?? (subjects.map((sub) => sub.label).join(' + ') || null)

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

  /**
   * Keep, and stop keeping.
   *
   * Both move the pill immediately and reconcile behind it. Keeping is one
   * gesture with no decision attached, and a gesture that makes you wait for a
   * network round trip has a decision in it whether it means to or not. A
   * failed write leaves the list as it was on the next read; nothing the writer
   * wrote is at stake either way.
   */
  function keep(subject: Subject) {
    if (kept.some((k) => k.key === subject.key)) return
    const optimistic: KeptSubject = { ...subject, keptAt: new Date().toISOString() }
    setKept((prev) => [...prev, optimistic])
    void keepSubject(subject).catch(() => {
      setKept((prev) => prev.filter((k) => k.key !== subject.key))
    })
  }

  function drop(key: string) {
    const previous = kept
    setKept((prev) => prev.filter((k) => k.key !== key))
    void dropSubject(key).catch(() => setKept(previous))
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

  return (
    <div className="pg">
      <div className="pg__head-wrap">
        <div className="pg__inner pg__inner--head">

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

          <LookFor
            kept={held}
            offered={offered}
            index={index}
            markings={markPills}
            zoom={zoom}
            onZoom={setZoom}
            standLabel={standLabel(zoom)}
            reading={reading}
            onReading={setReading}
            chips={chips}
            onToggleSubject={addSubject}
            onToggleMarking={toggleKey}
            onRemove={(key) => {
              if (key === ASK_CHIP_KEY) onClearAsked()
              else toggleKey(key)
            }}
            onClear={() => {
              clearAll()
              onClearAsked()
            }}
            onSomewhere={openSomewhere}
            onKeep={keep}
            onDrop={drop}
            onlyLit={onlyLit}
            onOnlyLit={setOnlyLit}
          />

          {/*
            The chapter. Present only when a subject is lit, because it is the
            subject's own masthead — on the whole archive there is nothing for
            it to be about.
          */}
          {subjects.length > 0 ? (
            <Chapter
              subjects={subjects}
              entries={entries}
              index={index}
              kept={keptKeys}
            />
          ) : null}

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
      ) : reading !== 'order' ? (
        /*
         * An arrangement other than date takes the canvas from the wall.
         *
         * It arranges what is SHOWN — the lit pages if something is lit, the
         * whole archive otherwise. Every reading works on either; greying them
         * out until a subject was chosen is exactly what made "the words you
         * used" impossible to find.
         */
        <div className="pg__inner">
          <ReadingView
            reading={reading}
            entries={shown}
            terms={subjects.flatMap((sub) => sub.terms)}
            split={split ?? defaultSplit(shown)}
            onSplit={setSplit}
            onOpen={onSpread}
          />
        </div>
      ) : (
        <PageWall
          entries={wallEntries}
          zoom={zoom}
          onZoom={setZoom}
          markQuotes={markQuotes}
          lit={onlyLit ? null : lit}
          match={match}
          facetIndex={facetIndex}
          activeId={activeId}
          // An echo is a page out of its own order. Interleaving one while the
          // wall is already rearranged — dimmed by a subject, or folded to a
          // single month — would make the arrangement impossible to read.
          echoes={!anyLit && month == null}
          // Opening a page is zooming to it — see READING_ZOOM. `spreadId` is
          // now "the page you zoomed to", which is what scrolls into view and
          // what the shared-element transition lands on.
          onOpen={(id) => {
            setZoom(READING_ZOOM)
            onSpread(id)
          }}
          returningId={spreadId ?? lastSpreadRef.current}
          single={single}
          firstLineTitle={settings.firstLineTitle}
          onEdit={onOpenEntry}
          onMenuAction={onEntryMenuAction}
          onDeleteEntries={onDeleteEntries}
        />
      )}
    </div>
  )
}


