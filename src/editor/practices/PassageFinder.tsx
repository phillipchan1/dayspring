import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGuestMode } from '@/context/GuestMode'
import { BOOKS, NT_BOOKS, OT_BOOKS, type BibleBook } from '@/lib/bible/canon'
import { formatOsisRef } from '@/lib/scripture/format'
import type { Practice } from './practicesData'
import {
  displayBook,
  parseFinderQuery,
  parseReferenceLine,
  passageLabel,
  refFromOsis,
  sizeNote,
  versesIn,
  type PassageRef,
  type Verse,
} from './passage'
import { loadChapter, loadLight, searchTopic, type PassageLight, type TopicHit } from './passageSource'
import { PassageText } from './PassageText'
import { SUGGESTION_THEMES, suggestionsFor, type SuggestionTheme } from './passageSuggestions'
import './Passage.css'

interface Props {
  practice: Practice
  /** Choosing again, over a passage already on the page. */
  current?: string | null
  /**
   * The passage chosen, with its words. `null` words mean it is read from the
   * writer's own Bible, and only when the words cannot be had: a guest (no
   * session for the ESV), or a chapter that would not open. Never a choice —
   * a page that keeps only a reference has nothing to draw quotes from, which
   * is the whole of a scripture ritual (Phil, Oct 1).
   */
  onChoose: (ref: PassageRef, verses: Verse[] | null) => void
  /** Leave without choosing. */
  onBack: () => void
  /** Where leaving goes, said plainly. */
  backLabel: string
  /** Begin on this passage straight away — the Bible door's "continue". */
  autoTake?: PassageRef | null
}

type Open = { book: BibleBook; chapter: number }

/**
 * Choosing the passage — the first thing a scripture ritual asks, and what
 * replaced Lectio's "write the passage out".
 *
 * Everything offered before a word is typed is the writer's own: the passages
 * their journal returns to and the canon lit where they have written, both the
 * Scripture surface's light. Nothing is recommended. A word search is the one
 * place a model chooses, and it only chooses references; the words are the
 * ESV's. One chapter is ever on screen — the chapter pane's licence shape.
 */
export function PassageFinder({ practice, current = null, onChoose, onBack, backLabel, autoTake = null }: Props) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Open | null>(null)
  const [browseBook, setBrowseBook] = useState<BibleBook | null>(null)
  const [sel, setSel] = useState<{ from: number; to: number } | null>(null)
  const [verses, setVerses] = useState<Verse[] | null>(null)
  const [light, setLight] = useState<PassageLight | null>(null)
  const [topic, setTopic] = useState<{ word: string; hits: TopicHit[] | null; failed?: boolean } | null>(null)
  const [kb, setKb] = useState(0)
  const [theme, setTheme] = useState<SuggestionTheme | null>(null)
  const [turn, setTurn] = useState(0)
  /** A passage chosen, its chapter still on the way. */
  const [taking, setTaking] = useState<PassageRef | null>(autoTake)
  const takingRef = useRef(false)
  const liveRef = useRef(true)
  useEffect(() => {
    liveRef.current = true
    return () => {
      liveRef.current = false
    }
  }, [])
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const size = practice.passage?.size ?? 'any'
  const { isGuest } = useGuestMode()

  useEffect(() => {
    let live = true
    void loadLight().then((l) => live && setLight(l))
    return () => {
      live = false
    }
  }, [])
  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true })
  }, [])

  // One chapter, loaded when opened. Guests have no session for the ESV
  // endpoint — skip the fetch rather than failing into an error string.
  useEffect(() => {
    if (!open) return
    if (isGuest) {
      setVerses(null)
      return
    }
    let live = true
    setVerses(null)
    void loadChapter(open.book.name, open.chapter).then((v) => live && setVerses(v))
    return () => {
      live = false
    }
  }, [open, isGuest])

  // Land on the chosen verses once they are on screen.
  useEffect(() => {
    if (!verses || !sel) return
    const el = scrollRef.current?.querySelector(`.psg__v[data-sel='true']`)
    el?.scrollIntoView({ block: 'center' })
    // Only on arrival (`verses`), not on every change of selection.
  }, [verses])

  const parsed = useMemo(() => parseFinderQuery(q), [q])

  const openRef = useCallback((book: BibleBook, chapter: number, from: number | null, to: number | null) => {
    setOpen({ book, chapter })
    setBrowseBook(null)
    setSel(from == null ? null : { from, to: to ?? from })
    setQ(`${displayBook(book.name)} ${chapter}${from == null ? '' : `:${from}${to != null && to !== from ? `–${to}` : ''}`}`)
    setTopic(null)
  }, [])

  const openPassage = useCallback(
    (ref: PassageRef) => {
      const book = BOOKS.find((b) => b.name === ref.book)
      if (book) openRef(book, ref.chapter, ref.from, ref.to)
    },
    [openRef],
  )

  /**
   * Choosing is beginning. The first time, a passage picked anywhere here —
   * a reference typed, a suggestion, a passage you return to, a chapter — is
   * the passage: the facing leaf shows it at once, and narrowing to verses is
   * one "change" away there. Only choosing AGAIN keeps the chapter preview,
   * because that is where a passage gets narrowed.
   */
  const take = (ref: PassageRef) => {
    if (current) {
      openPassage(ref)
      return
    }
    if (takingRef.current) return
    if (isGuest) {
      onChoose(ref, null)
      return
    }
    takingRef.current = true
    setTaking(ref)
    void loadChapter(ref.book, ref.chapter)
      .catch(() => [] as Verse[])
      .then((all) => {
        if (!liveRef.current) return
        const words = ref.from == null ? all : versesIn(ref, all)
        if (words.length > 0) {
          onChoose(ref, words)
          return
        }
        // It would not open: the preview says so and offers your own Bible.
        takingRef.current = false
        setTaking(null)
        openPassage(ref)
      })
  }

  // The Bible door's "continue" arrives with its passage already chosen.
  // Choosing again opens where the passage already is, verses marked, so
  // narrowing it is one click.
  useEffect(() => {
    if (autoTake) take(autoTake)
    else if (current) {
      const r = parseReferenceLine(current)
      if (r) openPassage(r)
    }
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const chosenRef = (): PassageRef | null => {
    if (!open) return null
    if (sel) return { book: open.book.name, chapter: open.chapter, from: sel.from, to: sel.to }
    return { book: open.book.name, chapter: open.chapter, from: null, to: null }
  }

  const begin = (own: boolean) => {
    const ref = chosenRef()
    if (!ref) return
    if (own || !verses || verses.length === 0) {
      onChoose(ref, null)
      return
    }
    const words = ref.from == null ? verses : verses.filter((v) => v.n >= ref.from! && v.n <= (ref.to ?? ref.from!))
    onChoose(ref, words)
  }

  const pickVerse = (n: number, extend: boolean) => {
    setSel((s) => {
      if (!s) return { from: n, to: n }
      if (s.from === s.to && s.from === n) return null
      if (extend || s.from === s.to) return { from: Math.min(s.from, n), to: Math.max(s.to, n) }
      return { from: n, to: n }
    })
  }

  const runTopic = (word: string) => {
    setTopic({ word, hits: null })
    void searchTopic(word)
      .then((hits) => setTopic((t) => (t?.word === word ? { word, hits } : t)))
      .catch(() => setTopic((t) => (t?.word === word ? { word, hits: [], failed: true } : t)))
  }

  // ── Rows the keyboard walks ───────────────────────────────────────────
  type Row = { key: string; act: () => void }
  const rows: Row[] = []
  if (!open) {
    if (parsed.type === 'ref' || parsed.type === 'typo') {
      const p = parsed
      if (p.chapter != null) {
        rows.push({ key: 'ref', act: () => take({ book: p.book.name, chapter: p.chapter!, from: p.from, to: p.to }) })
      }
      else rows.push({ key: 'book', act: () => setBrowseBook(p.book) })
    } else if (parsed.type === 'books') {
      for (const b of parsed.books) rows.push({ key: b.osis, act: () => setBrowseBook(b) })
    } else if (parsed.type === 'topic' && topic?.hits) {
      for (const h of topic.hits) rows.push({ key: passageLabel(h.ref), act: () => take(h.ref) })
    }
  }

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && rows.length) {
      e.preventDefault()
      setKb((k) => Math.min(rows.length - 1, k + 1))
    } else if (e.key === 'ArrowUp' && rows.length) {
      e.preventDefault()
      setKb((k) => Math.max(0, k - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (open) {
        if (verses) begin(false)
        return
      }
      if (parsed.type === 'book') {
        setBrowseBook(parsed.book)
        return
      }
      if (parsed.type === 'topic' && topic?.word !== parsed.word) {
        runTopic(parsed.word)
        return
      }
      rows[Math.min(kb, rows.length - 1)]?.act()
    }
  }

  // Escape steps back one level, then leaves. Stopped here so the composer
  // underneath never hears it.
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      if (open) {
        setOpen(null)
        setSel(null)
        setVerses(null)
        return
      }
      if (browseBook) {
        setBrowseBook(null)
        return
      }
      onBack()
    }
    window.addEventListener('keydown', onEsc, true)
    return () => window.removeEventListener('keydown', onEsc, true)
  }, [open, browseBook, onBack])

  // The canon and a book's chapters are plain: an earlier version lit them by
  // how often the journal cites each, and on a real archive nearly everything
  // glowed and nothing said why. "Passages you return to" carries the writer's
  // own history; these are for finding your way.
  const bookView = (book: BibleBook, also: BibleBook[] = []) => {
    return (
      <section className="pf__sec">
        <h3 className="pf__h">{book.name}</h3>
        <div className="pf__chapters">
          {Array.from({ length: book.chapters }, (_, n) => n + 1).map((c) => (
            <button
              key={c}
              type="button"
              className="pf__ch"
              onClick={() => take({ book: book.name, chapter: c, from: null, to: null })}
            >
              {c}
            </button>
          ))}
        </div>
        {also.length > 0 && (
          <p className="pf__soft">
            Or{' '}
            {also.map((b, n) => (
              <span key={b.osis}>
                {n > 0 ? ', ' : ''}
                <button type="button" className="pf__link" onClick={() => setBrowseBook(b)}>
                  {b.name}
                </button>
              </span>
            ))}
          </p>
        )}
      </section>
    )
  }

  const refRow = (key: string, n: number, label: string, meta: string, act: () => void, text?: string | null) => (
    <button
      key={key}
      type="button"
      className="pf__row"
      data-kb={n === kb ? 'true' : undefined}
      onClick={act}
    >
      <span className="pf__row-ref">{label}</span>
      <span className="pf__row-meta">{meta}</span>
      {text ? <span className="pf__row-text">{text}</span> : null}
    </button>
  )

  let body: React.ReactNode
  if (taking) {
    body = <p className="pf__soft pf__loading">Opening {passageLabel(taking)}…</p>
  } else if (open) {
    const ref = chosenRef()!
    const count = sel ? sel.to - sel.from + 1 : (verses?.length ?? 0)
    const note = sel ? sizeNote(size, count, practice.name) : null
    const prev = open.chapter > 1 ? open.chapter - 1 : null
    const next = open.chapter < open.book.chapters ? open.chapter + 1 : null
    body = (
      <>
        <div className="pf__reader-head">
          <h2 className="pf__chapter">
            {displayBook(open.book.name)} {open.chapter}
          </h2>
          <span className="pf__nav">
            {prev != null && (
              <button type="button" className="pf__link" onClick={() => openRef(open.book, prev, null, null)}>
                ‹ {prev}
              </button>
            )}
            {next != null && (
              <button type="button" className="pf__link" onClick={() => openRef(open.book, next, null, null)}>
                {next} ›
              </button>
            )}
            <button
              type="button"
              className="pf__link"
              onClick={() => {
                setOpen(null)
                setSel(null)
                setQ('')
                inputRef.current?.focus()
              }}
            >
              ← search
            </button>
          </span>
        </div>
        {isGuest ? (
          <p className="pf__soft">Open this passage in your own Bible, then continue.</p>
        ) : verses === null ? (
          <p className="pf__soft pf__loading">Opening {displayBook(open.book.name)} {open.chapter}…</p>
        ) : verses.length === 0 ? (
          <div className="pf__soft">
            <p>This chapter wouldn’t open just now.</p>
            <button type="button" className="pf__link" onClick={() => begin(true)}>
              Read {passageLabel(ref)} from your own Bible →
            </button>
          </div>
        ) : (
          <>
            <p className="pf__hint-line">
              {sel ? 'Click a verse to start again · shift-click to extend' : 'Click a verse, then another, to choose the verses between'}
            </p>
            <div className="pf__reading" data-has-sel={sel ? 'true' : undefined}>
              <PassageText verses={verses} mode="choose" selected={sel} onVerse={pickVerse} />
            </div>
          </>
        )}
        {note && !isGuest && <p className="pf__soft">{note}</p>}
        <div className="pf__bar">
          <span className="pf__bar-ref">{passageLabel(ref)}</span>
          <span className="pf__bar-count">{sel ? `${count} verse${count === 1 ? '' : 's'}` : 'the whole chapter'}</span>
          <span className="pf__bar-sp" />
          {isGuest ? (
            <button type="button" className="pf__begin" onClick={() => begin(true)}>
              Continue
            </button>
          ) : (
            <button type="button" className="pf__begin" onClick={() => begin(false)} disabled={verses === null}>
              {current ? 'Use this passage' : 'Begin'}
            </button>
          )}
        </div>
      </>
    )
  } else if (browseBook && (parsed.type === 'empty' || (parsed.type === 'book' && parsed.book === browseBook) || parsed.type === 'books')) {
    body = bookView(browseBook)
  } else if (parsed.type === 'empty') {
    const returning = (light?.returning ?? []).map(refFromOsis).filter((r): r is PassageRef => r !== null)
    const picks = suggestionsFor(size, theme, turn)
    body = (
      <>
        <section className="pf__sec">
          <h3 className="pf__h">Good places to begin</h3>
          <div className="pf__themes" role="group" aria-label="Themes">
            <button type="button" className="pf__theme" aria-pressed={theme === null} onClick={() => { setTheme(null); setTurn(0) }}>
              Any
            </button>
            {SUGGESTION_THEMES.map((t) => (
              <button
                key={t}
                type="button"
                className="pf__theme"
                aria-pressed={theme === t}
                onClick={() => {
                  setTheme(theme === t ? null : t)
                  setTurn(0)
                }}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="pf__picks">
            {picks.map((p) => (
              <button key={passageLabel(p.ref)} type="button" className="pf__pick" onClick={() => take(p.ref)}>
                <span className="pf__pick-title">{p.title}</span>
                <span className="pf__pick-ref">{passageLabel(p.ref)}</span>
                <span className="pf__pick-themes">{p.themes.join(' · ')}</span>
              </button>
            ))}
          </div>
          {picks.length >= 6 && (
            <button type="button" className="pf__link pf__more" onClick={() => setTurn((n) => n + 1)}>
              Show others
            </button>
          )}
        </section>
        {returning.length > 0 && (
          <section className="pf__sec">
            <h3 className="pf__h">
              Passages you return to<span className="pf__src">from your own pages</span>
            </h3>
            <div className="pf__chips">
              {(light?.returning ?? []).map((osis) => {
                const r = refFromOsis(osis)
                if (!r) return null
                return (
                  <button key={osis} type="button" className="pf__chip" onClick={() => take(r)}>
                    <span className="pf__glow" aria-hidden />
                    {formatOsisRef(osis)}
                  </button>
                )
              })}
            </div>
          </section>
        )}
        <section className="pf__sec">
          <h3 className="pf__h">The canon</h3>
          <div className="pf__canon">
            {[
              ['Old Testament', OT_BOOKS],
              ['New Testament', NT_BOOKS],
            ].map(([title, list]) => (
              <div key={title as string}>
                <div className="pf__testament">{title as string}</div>
                <div className="pf__books">
                  {(list as BibleBook[]).map((b) => (
                    <button key={b.osis} type="button" className="pf__book" onClick={() => setBrowseBook(b)}>
                      {b.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </>
    )
  } else if (parsed.type === 'book') {
    body = bookView(parsed.book, parsed.also)
  } else if (parsed.type === 'books') {
    body = (
      <section className="pf__sec">
        <h3 className="pf__h">Books</h3>
        {parsed.books.map((b, n) =>
          refRow(b.osis, n, b.name, `${b.chapters} chapter${b.chapters === 1 ? '' : 's'}`, () => setBrowseBook(b)),
        )}
      </section>
    )
  } else if (parsed.type === 'ref' || parsed.type === 'typo') {
    const p = parsed
    const label =
      p.chapter != null
        ? passageLabel({ book: p.book.name, chapter: p.chapter, from: p.from, to: p.to })
        : p.book.name
    body = (
      <section className="pf__sec">
        <h3 className="pf__h">{p.type === 'typo' ? 'Did you mean' : 'Reference'}</h3>
        {refRow('ref', 0, label, p.type === 'typo' ? `for “${p.typed}”` : current ? 'enter to open' : 'enter to begin', rows[0]!.act)}
      </section>
    )
  } else if (parsed.type === 'nobook') {
    body = (
      <p className="pf__soft">
        There’s no book called “{parsed.typed}.” Try a book, a reference, or a single word.
      </p>
    )
  } else {
    const word = parsed.word
    const searched = topic?.word === word
    body = (
      <section className="pf__sec">
        <h3 className="pf__h">
          Passages for “{word}”
          <span className="pf__src">references chosen by a model from your word · the words from the ESV</span>
        </h3>
        {!searched ? (
          <p className="pf__soft">Press Enter to look.</p>
        ) : topic?.hits === null ? (
          <p className="pf__soft pf__loading">Looking…</p>
        ) : topic?.hits?.length ? (
          topic.hits.map((h, n) => refRow(passageLabel(h.ref), n, passageLabel(h.ref), '', () => take(h.ref), h.text))
        ) : (
          <p className="pf__soft">
            {topic?.failed ? 'That search didn’t go through.' : 'No passage for that word.'} Try a book or a
            reference.
          </p>
        )}
      </section>
    )
  }

  return (
    <div className="passage-finder" role="dialog" aria-modal="true" aria-label={`${practice.name} — choose a passage`}>
      <button type="button" className="pf__back" onClick={onBack}>
        <span aria-hidden>←</span> {current ? `Keep ${current}` : `Back to ${backLabel}`}
        <kbd className="rc__kbd">esc</kbd>
      </button>
      <div className="pf__scroll" ref={scrollRef}>
        <div className="pf__col">
          <div className="pf__eyebrow">
            <span className="pf__name">{practice.name}</span>
            <span className="pf__origin">{practice.origin}</span>
          </div>
          <h1 className="pf__title">{current ? 'Choose another passage' : 'What will you read?'}</h1>
          <input
            ref={inputRef}
            className="pf__input"
            value={q}
            placeholder="John 15, Psalm 23, a book, or a word"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="go"
            onChange={(e) => {
              setQ(e.target.value)
              setOpen(null)
              setSel(null)
              setBrowseBook(null)
              setKb(0)
            }}
            onKeyDown={onKey}
          />
          <p className="pf__hint">{practice.passage?.hint}</p>
          {body}
        </div>
      </div>
    </div>
  )
}
