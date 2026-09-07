import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { fetchScriptureChapter, type ChapterVerse } from '@/lib/spiritual'
import { esvOrgChapter } from '@/lib/scripture/citation'
import './ChapterPane.css'

export interface ChapterPaneProps {
  book: string
  chapter: number
  highlightVerse?: number | null
  onClose: () => void
  onEdit?: () => void
}

export function ChapterPane({ book, chapter, highlightVerse, onClose, onEdit }: ChapterPaneProps) {
  const [verses, setVerses] = useState<ChapterVerse[] | null>(null)
  const [failed, setFailed] = useState(false)
  const paneRef = useRef<HTMLElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const verseRef = useRef<HTMLParagraphElement>(null)
  const readMoreHref = esvOrgChapter(book, chapter)

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
      const delta = verse.getBoundingClientRect().top - body.getBoundingClientRect().top
      body.scrollTop = Math.max(0, body.scrollTop + delta - body.clientHeight / 3)
    }
    if (window.matchMedia('(max-width: 720px)').matches) {
      paneRef.current?.scrollIntoView({ block: 'start' })
    }
  }, [book, chapter, highlightVerse, verses])

  return (
    <aside ref={paneRef} className="chapter-pane" aria-label={`${book} ${chapter}`}>
      <header className="chapter-pane__head">
        <div>
          <h2 className="chapter-pane__title">
            {book} {chapter}
          </h2>
          <p className="chapter-pane__label">This chapter</p>
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
        {verses?.map((v) => (
          <p
            key={v.n}
            ref={highlightVerse === v.n ? verseRef : undefined}
            className="chapter-pane__verse"
            data-highlight={highlightVerse === v.n ? 'true' : undefined}
          >
            <span className="chapter-pane__num">{v.n}</span>
            {v.text}
          </p>
        ))}
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
