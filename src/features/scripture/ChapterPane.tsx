import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { fetchScriptureChapter, type ChapterVerse } from '@/lib/spiritual'
import {
  citedVerseEdge,
  esvOrgChapter,
  formatChapterHeading,
  verseIsCited,
} from '@/lib/scripture/citation'
import './ChapterPane.css'

export interface ChapterPaneProps {
  book: string
  chapter: number
  highlightVerse?: number | null
  highlightVerseEnd?: number | null
  onClose: () => void
  onEdit?: () => void
}

export function ChapterPane({
  book,
  chapter,
  highlightVerse,
  highlightVerseEnd,
  onClose,
  onEdit,
}: ChapterPaneProps) {
  const [verses, setVerses] = useState<ChapterVerse[] | null>(null)
  const [failed, setFailed] = useState(false)
  const paneRef = useRef<HTMLElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const verseRef = useRef<HTMLParagraphElement>(null)
  const readMoreHref = esvOrgChapter(book, chapter)
  const heading = formatChapterHeading({
    book,
    chapter,
    verse: highlightVerse ?? null,
    verseEnd: highlightVerseEnd ?? null,
  })
  const focused = highlightVerse != null
  const firstCited = verses?.find((v) => verseIsCited(v.n, highlightVerse, highlightVerseEnd))?.n

  useEffect(() => {
    let cancelled = false
    setVerses(null)
    setFailed(false)
    void fetchScriptureChapter(book, chapter)
      .then((hit) => {
        if (cancelled) return
        setVerses(hit.verses)
        if (hit.verses.length === 0) setFailed(true)
      })
      .catch(() => {
        if (!cancelled) {
          setVerses([])
          setFailed(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [book, chapter])

  useLayoutEffect(() => {
    const body = bodyRef.current
    const verse = verseRef.current
    if (body && verse) {
      const align = () => {
        const delta = verse.getBoundingClientRect().top - body.getBoundingClientRect().top
        body.scrollTop = Math.max(0, body.scrollTop + delta - body.clientHeight / 3)
      }
      // Her verse should be the thing she sees, not verse 1. offsetTop is
      // relative to the offset parent, which isn't the scroller — measure the
      // gap between the two rects instead. A follow-up frame catches flex
      // height that settles after the verses replace "Loading…".
      align()
      const frame = requestAnimationFrame(align)
      if (window.matchMedia('(max-width: 720px)').matches) {
        paneRef.current?.scrollIntoView({ block: 'start' })
      }
      return () => cancelAnimationFrame(frame)
    }
    if (window.matchMedia('(max-width: 720px)').matches) {
      paneRef.current?.scrollIntoView({ block: 'start' })
    }
  }, [book, chapter, highlightVerse, highlightVerseEnd, verses])

  return (
    <aside
      ref={paneRef}
      className="chapter-pane"
      data-focused={focused ? 'true' : undefined}
      aria-label={heading}
    >
      <header className="chapter-pane__head">
        <div>
          <h2 className="chapter-pane__title">{heading}</h2>
          <p className="chapter-pane__label">{focused ? 'In this chapter' : 'This chapter'}</p>
        </div>
        <div className="chapter-pane__actions">
          {onEdit && (
            <button type="button" className="chapter-pane__quiet" onClick={onEdit}>
              Edit
            </button>
          )}
          <button type="button" className="chapter-pane__quiet" onClick={onClose}>
            Close
          </button>
        </div>
      </header>
      <div className="chapter-pane__body" ref={bodyRef}>
        {verses === null && <p className="chapter-pane__status">Loading…</p>}
        {verses && verses.length === 0 && failed && (
          <p className="chapter-pane__status">Open ESV.org to read this chapter.</p>
        )}
        {verses?.map((v) => {
          const edge = citedVerseEdge(v.n, highlightVerse, highlightVerseEnd)
          return (
            <p
              key={v.n}
              ref={firstCited === v.n ? verseRef : undefined}
              className="chapter-pane__verse"
              data-highlight={edge ? 'true' : undefined}
              data-edge={edge ?? undefined}
              aria-current={edge ? 'location' : undefined}
            >
              <span className="chapter-pane__num">{v.n}</span>
              {v.text}
            </p>
          )
        })}
      </div>
      <footer className="chapter-pane__foot">
        <span>ESV</span>
        <a className="chapter-pane__read-more" href={readMoreHref} target="_blank" rel="noopener noreferrer">
          Continue on ESV.org →
        </a>
      </footer>
    </aside>
  )
}
