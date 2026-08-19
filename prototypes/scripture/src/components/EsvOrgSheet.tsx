import type { Chapter } from '../corpus'
import { esvOrgChapter } from '../lib/esvOrg'

interface Props {
  chapter: Chapter
  highlightVerse?: number
  onClose: () => void
}

/** Mock ESV.org-style sheet — external read, journal dimmed behind. */
export function EsvOrgSheet({ chapter, highlightVerse, onClose }: Props) {
  const href = esvOrgChapter(chapter.book, chapter.chapter)

  return (
    <div className="esv-scrim" onClick={onClose} role="presentation">
      <article className="esv-sheet" onClick={(e) => e.stopPropagation()} role="dialog">
        <header className="esv-sheet__chrome">
          <span className="esv-sheet__site">esv.org</span>
          <button type="button" onClick={onClose}>
            Done
          </button>
        </header>
        <h1 className="esv-sheet__title">
          {chapter.book} {chapter.chapter}
        </h1>
        <p className="esv-sheet__sub">World English Bible · mock text</p>
        <div className="esv-sheet__body">
          {chapter.verses.map((v) => (
            <p
              key={v.n}
              className="esv-sheet__verse"
              data-highlight={highlightVerse === v.n ? 'true' : undefined}
            >
              <sup>{v.n}</sup> {v.text}
            </p>
          ))}
        </div>
        <footer className="esv-sheet__foot">
          <a href={href} target="_blank" rel="noopener noreferrer">
            Open full chapter on ESV.org →
          </a>
        </footer>
      </article>
    </div>
  )
}
