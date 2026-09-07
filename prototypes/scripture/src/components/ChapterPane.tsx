import { useLayoutEffect, useRef } from 'react'
import type { Chapter } from '../corpus'
import { esvOrgChapter } from '../lib/esvOrg'

interface Props {
  chapter: Chapter
  highlightVerse?: number
  onClose?: () => void
  label?: string
  showClose?: boolean
  /** When set, footer shows a link to ESV.org for deeper reading. */
  readMore?: boolean
}

export function ChapterPane({
  chapter,
  highlightVerse,
  onClose,
  label,
  showClose = true,
  readMore = false,
}: Props) {
  const readMoreHref = readMore ? esvOrgChapter(chapter.book, chapter.chapter) : undefined
  const paneRef = useRef<HTMLElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const verseRef = useRef<HTMLParagraphElement>(null)

  useLayoutEffect(() => {
    const body = bodyRef.current
    const verse = verseRef.current
    // Reading clientHeight forces layout, so these measurements are already
    // final — no rAF needed (and rAF never fires in a backgrounded tab).
    if (body && verse) {
      // Her verse should be the thing she sees, not verse 1. offsetTop is
      // relative to the offset parent, which isn't the scroller — measure the
      // gap between the two rects instead.
      const delta = verse.getBoundingClientRect().top - body.getBoundingClientRect().top
      body.scrollTop = Math.max(0, body.scrollTop + delta - body.clientHeight / 3)
    }
    // On phones the pane stacks below the journal, behind the sticky footer —
    // bring it into view so opening a chapter looks like it did something.
    // No `behavior: 'smooth'`: some embedded webviews silently ignore it.
    if (window.matchMedia('(max-width: 720px)').matches) {
      paneRef.current?.scrollIntoView({ block: 'start' })
    }
  }, [chapter.book, chapter.chapter, highlightVerse])

  return (
    <aside
      ref={paneRef}
      className="chapter-pane"
      aria-label={`${chapter.book} ${chapter.chapter}`}
    >
      <header className="chapter-pane__head">
        <div>
          <h2 className="chapter-pane__title">
            {chapter.book} {chapter.chapter}
          </h2>
          {label && <p className="chapter-pane__label">{label}</p>}
        </div>
        {showClose && onClose && (
          <button type="button" className="chapter-pane__close" onClick={onClose}>
            Close
          </button>
        )}
      </header>
      <div className="chapter-pane__body" ref={bodyRef}>
        {chapter.verses.map((v) => (
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
        <span>World English Bible · mock text</span>
        {readMoreHref && (
          <a
            className="chapter-pane__read-more"
            href={readMoreHref}
            target="_blank"
            rel="noopener noreferrer"
          >
            Continue on ESV.org →
          </a>
        )}
      </footer>
    </aside>
  )
}
