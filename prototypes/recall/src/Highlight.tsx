import { subjectMatcher, splitOnMatch } from './match'
import type { Subject } from './corpus'

export function Highlight({ text, subject }: { text: string; subject: Subject | null }) {
  if (!subject) return <>{text}</>
  const re = subjectMatcher(subject)
  const parts = splitOnMatch(text, re)
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="hit">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  )
}
