import { useEffect, useMemo, useRef, useState } from 'react'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { SurfaceLoader } from '@/components/SurfaceLoader'
import { fetchAnniversarySenses, type AnniversarySense } from '@/lib/echoes'
import { buildFacts } from './weather'
import type { EntryMenuAction } from '@/features/journal/EntryContextMenu'
import type { Mark } from '@/lib/marks'
import type { Settings } from '@/lib/settings'
import type { Entry } from '@/lib/types'
import { deriveTitle } from '@/lib/entryLabels'
import { PageWall } from './PageWall'
import { clampZoom, densityLabel } from './zoom'
import {
  allSubjects,
  keysFromSubjects,
  matchSubjects,
  subjectMatcher,
  wordSubject,
  type Subject,
} from './subjects'
import { markingChips, matchFacets } from './facets'
import { facetIndexFor, subjectIndexFor } from './derived'
import { LookFor } from './LookFor'
import { LitChips, type LookChip } from './LitChips'
import { ReadingView } from './ReadingView'
import { Chapter } from './Chapter'
import { Stretch } from './Stretch'
import { inSpan, monthsAcross, type Span } from './band'
import { PageReader } from './PageReader'
import { defaultSplit, type Reading } from './readings'
import {
  dropSubject,
  keepSubject,
  listKeptSubjects,
  partitionKept,
  withVocabulary,
  type KeptSubject,
} from './keptSubjects'
import {
  listMarkings,
  markingsForEntries,
  markingsForEntry,
  type MarkingRef,
  type PageMarking,
} from '@/lib/spiritual'
import { litSentence } from './litSentence'
import './Pages.css'

/** The chip that stands for a question, since a question has no key of its own. */
const ASK_CHIP_KEY = 'asked'

function isToday(iso: string): boolean {
  const date = new Date(iso)
  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

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
  spreadId,
  onSpread,
  onOpenEntry,
  onEntryMenuAction,
  onDeleteEntries,
  settings,
  updateSettings,
}: Props) {
  const [vocabulary, setVocabulary] = useState<Subject[]>([])
  const [senses, setSenses] = useState<AnniversarySense[]>([])
  /**
   * A bracketed stretch of months, or the whole archive.
   *
   * This replaced a `month` fold that nothing could set any more — the years
   * panel that produced it went with D-025, and it had been dead state ever
   * since. A stretch is the better shape anyway: "every November" is a question
   * about the calendar, and "that winter" is a question about a life.
   */
  const [span, setSpan] = useState<Span | null>(null)
  const [onlyLit, setOnlyLit] = useState(false)
  const [kept, setKept] = useState<KeptSubject[]>([])
  // How the lit pages are arranged. Local rather than a history frame: it is a
  // way of looking at what is already on screen, not somewhere you went.
  const [reading, setReading] = useState<Reading>('order')
  const [split, setSplit] = useState<number | null>(null)
  const [markings, setMarkings] = useState<MarkingRef[]>([])
  // How many pages the wall is currently showing at once — measured there,
  // where the column count and the scroller's height both live, and said beside
  // the slider as a count rather than a name for a stop it does not have.
  const [perScreen, setPerScreen] = useState(0)
  // The markings on the page currently open, WITH their text. The corpus-wide
  // read deliberately carries none (see `markingsForEntry`); one page's worth
  // is a handful of short rows, and it is what lets an open page show the
  // scripture where it sits instead of asserting one is in here somewhere.
  const [openMarkings, setOpenMarkings] = useState<PageMarking[]>([])
  // Markings WITH their text for the pages on screen, fetched only for the one
  // reading that needs the join rather than the page. See `nearby.ts`.
  const [nearMarkings, setNearMarkings] = useState<PageMarking[]>([])
  const [nearLoading, setNearLoading] = useState(false)
  // The last page opened in the Spread, kept so the wall knows which card the
  // reader should shrink back into when it closes.
  const lastSpreadRef = useRef<string | null>(null)
  if (spreadId) lastSpreadRef.current = spreadId
  /*
   * One zoom, and it belongs to the pointer.
   *
   * There were two — a phone's and a display's — because the same number across
   * both meant every trip between devices landed on a wall arranged for the
   * other one. The phone's has gone with the phone's slider (see `zoom.ts`): a
   * phone renders rows at every setting, so a second stored number was recording
   * a preference that could no longer change anything.
   */
  const narrow = useIsMobile()
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


  /*
   * The page's markings.
   *
   * Cleared before the fetch, not after: holding the last page's markings while
   * the next one loads would draw them onto a page that does not carry them.
   *
   * **A failure is retried, never swallowed.** This used to end in
   * `.catch(() => {})`, so a transient miss — a dropped request, a token being
   * refreshed — left the state at `[]` and the page rendered as though the
   * writer had never marked anything on it. That is not a quiet failure, it is
   * a confident wrong answer about someone's own journal, and it is
   * indistinguishable from the truth. One retry after a short pause covers the
   * transient case; if it still fails the margin stays empty, which is the
   * honest end of the road, and the error is left on the console rather than
   * dropped on the floor.
   */
  useEffect(() => {
    setOpenMarkings([])
    if (!spreadId) return
    let alive = true
    const load = (attempt: number) => {
      void markingsForEntry(spreadId)
        .then((m) => {
          if (alive) setOpenMarkings(m)
        })
        .catch((err: unknown) => {
          if (!alive) return
          if (attempt === 0) {
            setTimeout(() => {
              if (alive) load(1)
            }, 600)
            return
          }
          console.warn('markings failed to load for', spreadId, err)
        })
    }
    load(0)
    return () => {
      alive = false
    }
  }, [spreadId])

  /** The page being read, if one is open. */
  const openPage = useMemo(
    () => (spreadId ? (entries.find((e) => e.id === spreadId) ?? null) : null),
    [spreadId, entries],
  )
  /**
   * The way back to now.
   *
   * The wall is better than the old entries panel at coming across something
   * you did not have in mind. The panel was better at one different job:
   * orienting you immediately around the page you were most recently in.
   * Making cards larger cannot solve that — every card is still a preview.
   *
   * So the newest page gets one quiet door in the header. It opens at reading
   * size like every other page on this surface; Write remains beside it in the
   * reader. This is an anchor, not a second list.
   */
  const latest = entries[0] ?? null
  const latestTitle = latest
    ? deriveTitle(latest.body_markdown) || latest.title || 'Blank page'
    : ''

  /*
   * A page that is no longer there closes itself.
   *
   * Deleting the page you are reading, or a sync that removes it, leaves
   * `spreadId` pointing at nothing: the reader renders none, and what is left
   * is a reader's bar sitting over the wall with no page under it. Gated on
   * `ready`, because before the archive loads EVERY id finds nothing and this
   * would throw away a page opened from a link while it was still arriving.
   */
  useEffect(() => {
    if (!ready || spreadId === null || openPage !== null) return
    onSpread(null)
  }, [ready, spreadId, openPage, onSpread])

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

  /*
   * Both go through `derived.ts` rather than being built here.
   *
   * A `useMemo` only survives as long as the component, and this one is
   * unmounted every time you leave Pages — so tapping the Journal tab rebuilt
   * the whole corpus index each time, which on a phone is most of a second of
   * nothing happening after the tap. The caches there are keyed per page on the
   * text they were derived from, so a return visit costs assembly and a visit
   * after writing one entry costs one page.
   */
  /** The archive's months — one timeline the Stretch and every subject band share. */
  const months = useMemo(() => monthsAcross(entries), [entries])

  /**
   * TWO subject indexes, and the difference between them is the whole feature.
   *
   * `fullIndex` covers the archive and is what the subject BANDS are drawn from,
   * so a chapter always shows where a name appears across every year you have —
   * including outside the bracket you are holding. Being able to see what a
   * bracket excludes is what stops it lying to you.
   *
   * `index` covers the bracket and is what LIGHTS the wall and COUNTS the pills.
   * Bracket a winter and Tiffany's count becomes her count that winter; a name
   * with nothing in it goes to zero and dims. Nothing is reordered — order stays
   * first-appearance, never count, because a ranking of what someone carried in
   * a year of their life is a verdict rendered as a sort (D-016).
   *
   * Two builds cost one, near enough: `derived.ts` memoises per page, so the
   * bracketed index re-uses every derivation the full one already did.
   */
  const fullIndex = useMemo(() => subjectIndexFor(entries), [entries])
  const markedIds = useMemo(() => marks.map((m) => m.entryId), [marks])

  /** The pages inside the bracket — what every count and every light is about. */
  const bracketed = useMemo(
    () => (span ? entries.filter((e) => inSpan(e.created_at, span, months)) : entries),
    [entries, span, months],
  )
  const index = useMemo(
    () => (span ? subjectIndexFor(bracketed) : fullIndex),
    [span, bracketed, fullIndex],
  )
  const facetIndex = useMemo(
    () => facetIndexFor(bracketed, markedIds, markings),
    [bracketed, markedIds, markings],
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
      out.push({
        key: pill.key,
        label: pill.label,
        kind: 'marking',
        tone: pill.tone,
        mark: pill.kind,
      })
    }
    return out
  }, [asked, subjects, markPills, keys])

  const anyLit = keys.length > 0 || asked !== null
  /** The declared kinds currently lit, for the sentence the surface says. */
  const litMarkings = useMemo(
    () => markPills.filter((p) => keys.includes(p.key)).map((p) => p.kind),
    [markPills, keys],
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
  const wallEntries = useMemo(() => {
    /*
     * A bracket FILTERS where a subject only dims, and that is the difference
     * between the two controls: a subject asks "where is this", so the pages
     * that don't carry it are the shape it stands against; a stretch asks
     * "what about then", and the answer cannot include now.
     */
    let list = bracketed
    // "only these" is the one thing that turns lighting into filtering, and it
    // is a visible toggle sitting beside the lit chips — which is what makes it
    // different from a query left behind in a panel you can't see.
    if (onlyLit && lit) list = list.filter((e) => lit.has(e.id))
    return list
  }, [bracketed, onlyLit, lit])

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

  const facts = useMemo(() => buildFacts(shown.map((e) => e.created_at)), [shown])

  /**
   * The markings for `marked near it`, fetched when that reading is chosen.
   *
   * Only then, and only for the pages on screen. `listMarkings` deliberately
   * carries no text because it lights the whole wall; this one carries text
   * because the reader has asked a question that cannot be answered without it,
   * and the subject has already narrowed the set the question is about — so the
   * cost is bounded by the question rather than by the archive.
   */
  const nearKey = useMemo(
    () => (reading === 'near' && subjects.length > 0 ? shown.map((e) => e.id).join(',') : ''),
    [reading, subjects.length, shown],
  )
  useEffect(() => {
    if (!nearKey) {
      setNearMarkings([])
      setNearLoading(false)
      return
    }
    let alive = true
    setNearLoading(true)
    void markingsForEntries(nearKey.split(','))
      .then((m) => {
        if (alive) setNearMarkings(m)
      })
      // Silence, the same contract every other read on this surface has: the
      // reading shows "nothing marked near it", which is what an empty result
      // looks like anyway, and nothing the writer wrote is at stake.
      .catch(() => {
        if (alive) setNearMarkings([])
      })
      .finally(() => {
        if (alive) setNearLoading(false)
      })
    return () => {
      alive = false
    }
  }, [nearKey])

  /**
   * Where the open page sits in the list you came from, and how to move along it.
   *
   * This is what makes a filter a READING rather than a lookup. You did not
   * arrive at this page on its own — you arrived at it seventh of three hundred
   * that say Esther, and the other pages are the reason the seventh is
   * interesting. Without a way along them, every one of them costs a trip back
   * to the wall to find your place again.
   *
   * ── Which list, and why there are two answers ───────────────────────────────
   *
   * The lit set, when the page is in it. But lighting DIMS rather than filters,
   * so with a subject on you can still open any page on the wall — and most
   * cards on screen are dimmed ones. Answering "not in the lit set, so no
   * position" left the arrows missing for the commonest click there is.
   *
   * So the list is the lit set if this page is in it, and the wall otherwise.
   * Either way it is the list you were actually looking at, and `lit` records
   * which one it was so the surface can say so rather than leaving the reader
   * to guess what the count counts.
   *
   * Newest first, because both lists are: the arrows are older and newer, which
   * is true whatever is lit and whatever arrangement the wall is in.
   */
  const within = useMemo(() => {
    if (!spreadId) return null
    let list = shown
    let at = list.findIndex((e) => e.id === spreadId)
    let inLit = true
    if (at < 0) {
      list = wallEntries
      at = list.findIndex((e) => e.id === spreadId)
      inLit = false
    }
    // Reached from somewhere off the wall entirely — a sense from an earlier
    // year, say, while a month is folded. Inventing a position for it would be
    // worse than having none.
    if (at < 0) return null
    return {
      at,
      total: list.length,
      lit: inLit && anyLit,
      newer: at > 0 ? list[at - 1]!.id : null,
      older: at < list.length - 1 ? list[at + 1]!.id : null,
    }
  }, [spreadId, shown, wallEntries, anyLit])

  /**
   * The neighbouring pages themselves, for the reader's edges.
   *
   * Resolved from `within`, so they are neighbours IN THE SET YOU CAME FROM —
   * the next page that says Esther, not the next page you wrote. That is the
   * same list the arrows and the count use, which is the point: three ways of
   * moving that disagreed about what "next" meant would be worse than one.
   */
  const byId = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries])
  const neighbours = useMemo(
    () => ({
      newer: within?.newer ? byId.get(within.newer) ?? null : null,
      older: within?.older ? byId.get(within.older) ?? null : null,
    }),
    [within, byId],
  )


  /*
   * The arrows, from the keyboard.
   *
   * Left and right rather than up and down: they do not scroll a page, so
   * taking them costs the reader nothing, and moving along a list is a
   * horizontal idea everywhere else in the world. Skipped whenever something
   * is being typed into, and whenever a modifier is held — ⌘← is the browser's.
   */
  useEffect(() => {
    if (!within) return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(?:INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      if (e.key === 'ArrowLeft' && within.newer) {
        e.preventDefault()
        onSpread(within.newer)
      } else if (e.key === 'ArrowRight' && within.older) {
        e.preventDefault()
        onSpread(within.older)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [within, onSpread])

  /** Add or remove one key. The wall never has a "clear all" it can't undo. */
  function toggleKey(key: string) {
    const next = keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]
    onSubject(next.length > 0 ? next.join('\u0000') : null)
  }

  function addSubject(next: Subject) {
    if (keys.includes(next.key)) return
    onSubject(keysFromSubjects([...subjects, next]) === null ? null : [...keys, next.key].join('\u0000'))
  }

  function clearAll() {
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

  /*
   * THE READER'S OWN BAR — the way out, the way in, and the way along.
   *
   * ── THE THROUGH LINE: what is still on, above the page you opened ──────────
   *
   * Opening a page used to empty the header: the chips went, the count went,
   * and the way out said "All entries" while a filter was still on. That is a
   * lie the reader cannot catch, and it threw away the one thing that explains
   * why they are looking at THIS page — they are not reading a page, they are
   * reading the seventh of thirty-four that say Esther.
   *
   * The chips, not the sheet. `look for` is a control for arranging the wall
   * and belongs to the wall; what is ON is a fact about what you are reading,
   * and it belongs here. Every one of them still comes off the same way it does
   * upstairs.
   *
   * Where it is RENDERED depends on the form factor, and that is the whole
   * reason it is a value rather than JSX in place.
   *
   * Beside a cursor it belongs in the surface header, above the page: the wall
   * is still there behind, the header is the surface's, and what is lit is a
   * fact about the whole surface.
   *
   * On a phone the reader is a pushed view, and half of it was being left
   * behind. The page slid out from under a bar that stayed put — so the thing
   * that said "All entries" sat still while you went to all entries, which is
   * the tell that this is a panel in a frame rather than a view on a stack.
   * There it travels with the page, sticky to the top of the reader's own
   * scroller, and the surface header goes away entirely.
   */
  const readerBar =
    spreadId === null ? null : (
      <div className="pg__through">
        <button type="button" className="pg__back" onClick={() => onSpread(null)}>
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden>
            <path
              d="M10 3 5 8l5 5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          All entries
        </button>

        {chips.length > 0 ? (
          <div className="pg__through-on">
            <LitChips
              chips={chips}
              onRemove={(key) => {
                if (key === ASK_CHIP_KEY) onClearAsked()
                else toggleKey(key)
              }}
            />
          </div>
        ) : null}

        {/*
          THE WAY IN, beside the way out.

          Clicking the page has always opened it for writing, and nothing
          said so — the old "Open to write" link was removed as "a label
          explaining what the page already is", which is true of the label
          and not true of the affordance. A page you can write on and a
          page you cannot look identical, and the one that reads back
          eleven years of someone's journal should not make them guess.

          In the header with the way out, never over the writing, and set
          as a word beside a nib rather than an icon on its own: a lone
          glyph in a corner is a thing to decode.
        */}
        {/*
          Only when there is a page to write on.
          
          `openPage` is `entries.find(...)`, and a `spreadId` does not promise a
          hit: the page can be deleted while it is open, or by a sync from
          another device, or the id can be restored from history after the entry
          is gone. The non-null assertion that used to be here threw
          `Cannot read properties of null` on the click. The way OUT stays
          rendered either way — a bar with no way back is the one thing worse
          than a bar with no Write.
        */}
        {openPage ? (
        <button
          type="button"
          className="pg__write"
          onClick={() => onOpenEntry(openPage.id)}
        >
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden>
            {/* A nib: the shoulders, the point, and the slit down it. */}
            <path
              d="M8 2.4 11.1 8.7 8 13.2 4.9 8.7Z"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinejoin="round"
            />
            <path
              d="M8 7.2v4"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
            />
          </svg>
          Write
        </button>
        ) : null}

        {within && within.total > 1 ? (
          <div className="pg__through-nav">
            <button
              type="button"
              className="pg__step"
              disabled={!within.newer}
              onClick={() => within.newer && onSpread(within.newer)}
              aria-label="The page after this one"
            >
              <svg viewBox="0 0 16 16" width="12" height="12" fill="none" aria-hidden>
                <path
                  d="M10 3 5 8l5 5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {/*
              A position, not a progress bar — nothing here is finishable.

              It carries `data-lit` when the arrows are walking the lit
              set rather than the whole wall, which is the difference
              between "seventh of the pages that say Esther" and "seventh
              of the archive". Colour rather than a word: it lands in the
              same accent the chips beside it are already in, so the two
              read as one statement.
            */}
            <span
              className="pg__through-at"
              data-lit={within.lit ? 'true' : undefined}
              aria-label={
                within.lit
                  ? `Page ${within.at + 1} of ${within.total.toLocaleString()} lit`
                  : `Page ${within.at + 1} of ${within.total.toLocaleString()}`
              }
            >
              {within.at + 1} of {within.total.toLocaleString()}
            </span>
            <button
              type="button"
              className="pg__step"
              disabled={!within.older}
              onClick={() => within.older && onSpread(within.older)}
              aria-label="The page before this one"
            >
              <svg viewBox="0 0 16 16" width="12" height="12" fill="none" aria-hidden>
                <path
                  d="M6 3l5 5-5 5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        ) : null}
      </div>
    )

  return (
    <div className="pg" data-reading-page={openPage ? 'true' : undefined}>
      <div className="pg__head-wrap">
        <div className="pg__inner pg__inner--head">

          {senses.length > 0 && !openPage ? (
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

          {/* The reader's bar, when there is a header for it to sit in. On a
              phone it travels with the page instead — see `readerBar`. */}
          {narrow ? null : readerBar}

          {openPage ? null : (
          <div className="pg__head-tools">
            {!narrow && latest ? (
              <button
                type="button"
                className="pg-now"
                onClick={() => onSpread(latest.id)}
                aria-label={`Open ${isToday(latest.created_at) ? "today's page" : `latest page from ${shortDate(latest.created_at)}`}`}
              >
                <span className="pg-now__when">
                  {isToday(latest.created_at) ? 'Today' : `Latest · ${shortDate(latest.created_at)}`}
                </span>
                <span className="pg-now__title">{latestTitle}</span>
                <svg viewBox="0 0 16 16" width="12" height="12" fill="none" aria-hidden>
                  <path
                    d="m6 3 5 5-5 5"
                    stroke="currentColor"
                    strokeWidth="1.35"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            ) : null}
            <LookFor
              kept={held}
              offered={offered}
              index={index}
              markings={markPills}
              zoom={zoom}
              onZoom={setZoom}
              narrow={narrow}
              standLabel={densityLabel(perScreen)}
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
          </div>
          )}

          {/*
            The stretch — the archive's months, and a way to bracket them.

            Above `look for` rather than inside it, because it is not one of the
            things you are looking FOR: it is WHEN, and it changes what every
            option in that sheet is counted over.
          */}
          {openPage ? null : (
            <Stretch
              entries={entries}
              months={months}
              span={span}
              onSpan={setSpan}
              caption={`${facts.count.toLocaleString()} ${facts.count === 1 ? 'page' : 'pages'}`}
            />
          )}

          {/*
            The chapter. Present only when a subject is lit, because it is the
            subject's own masthead — on the whole archive there is nothing for
            it to be about.

            Drawn from the FULL index, never the bracketed one: a chapter's job
            is to show where a name appears across every year you have, and
            being able to see what your bracket is leaving out is what keeps the
            bracket from lying to you.
          */}
          {subjects.length > 0 && !openPage ? (
            <Chapter
              subjects={subjects}
              entries={entries}
              index={fullIndex}
              kept={keptKeys}
            />
          ) : null}

          {/*
            The filter, stated — and ONLY when there is a filter to state.

            Two things were wrong with this as a permanent row. It named only
            the subjects, so lighting Tiffany AND Scripture narrowed the wall to
            twelve pages while the sentence still said "carrying Tiffany". And
            at rest it was a bare count, left-aligned above a grid, which is the
            shape of a dashboard — the wall IS the archive, and it does not need
            a line above it saying how much of one. The bare count sits in the
            middle of the timeline now, where it annotates something instead of
            heading a table.
          */}
          {anyLit && !openPage ? (
            <div className="pg__meta">
              <span className="pg__meta-b">
                {litSentence({
                  count: facts.count,
                  subjects: subjects.map((sub) => sub.label),
                  markings: litMarkings,
                  question: asked?.question ?? null,
                })}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="pg__body">
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
          <div className="pg__inner pg__inner--read">
            <ReadingView
              reading={reading}
              entries={shown}
              terms={subjects.flatMap((sub) => sub.terms)}
              match={match}
              narrowed={anyLit || span !== null}
              markings={nearMarkings}
              markingsLoading={nearLoading}
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
            narrow={narrow}
            markQuotes={markQuotes}
            lit={onlyLit ? null : lit}
            match={match}
            facetIndex={facetIndex}
            activeId={activeId}
            // An echo is a page out of its own order. Interleaving one while the
            // wall is already rearranged — dimmed by a subject, or folded to a
            // single month — would make the arrangement impossible to read.
            echoes={!anyLit && span == null}
            // Opening a page is its own view now, so it leaves the zoom alone —
            // reading something is not a statement about how you like the wall
            // arranged, and that zoom is a persisted setting.
            onOpen={onSpread}
            returningId={spreadId ?? lastSpreadRef.current}
            onDensity={setPerScreen}
            onEdit={onOpenEntry}
            onMenuAction={onEntryMenuAction}
            onDeleteEntries={onDeleteEntries}
          />
        )}

        {/*
          A page, open — OVER the wall rather than instead of it.
        
          Replacing the wall unmounted it, and a scroller that unmounts forgets
          where it was: you opened a page from four years deep and came back to
          the top of the archive. Covering it keeps the position for free, and
          the wall behind is made inert so nothing under the page can be tabbed
          into or clicked through to.
        */}
        {openPage ? (
          <PageReader
            bar={narrow ? readerBar : null}
            entry={openPage}
            markQuotes={markQuotes.get(openPage.id) ?? []}
            markings={openMarkings}
            match={match}
            firstLineTitle={settings.firstLineTitle}
            onEdit={onOpenEntry}
            onBack={() => onSpread(null)}
            leaves={settings.readerLeaves}
            newer={neighbours.newer}
            older={neighbours.older}
            onTurn={onSpread}
          />
        ) : null}
      </div>
    </div>
  )
}


