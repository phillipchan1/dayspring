import { useEffect, useMemo, useRef } from 'react'
import { renderMarkdown } from '@/lib/markdown'
import { stripSpiritualBlocks } from '@/lib/spiritualBlocks'
import { passagesForEntry } from '@/lib/remember'
import type { Entry } from '@/lib/types'

interface Props {
  entries: Entry[]
  /** Index of the left-hand page. */
  index: number
  onIndex: (next: number) => void
  onClose: () => void
  /** One page at a time on a phone. */
  single: boolean
  markQuotes: Map<string, string[]>
  firstLineTitle: boolean
  onEdit: (entryId: string) => void
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * The Spread — where you actually read, rather than scan.
 *
 * Focus mode's sibling. The editor is sacred because writing deserves an
 * uninterrupted surface; re-reading your own decade deserves the same one, so
 * everything except the two pages goes away.
 *
 * Marks live in the outer margin rather than highlighted in the text, because
 * that is where marginalia goes in a book — and because a page of highlighter is
 * harder to read, not easier.
 */
export function Spread({
  entries,
  index,
  onIndex,
  onClose,
  single,
  markQuotes,
  firstLineTitle,
  onEdit,
}: Props) {
  const step = single ? 1 : 2
  const closeRef = useRef<HTMLButtonElement>(null)

  const shown = useMemo(
    () => entries.slice(index, index + step).filter(Boolean),
    [entries, index, step],
  )

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault()
        if (index + step < entries.length) onIndex(index + step)
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        if (index - step >= 0) onIndex(index - step)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, step, entries.length, onIndex, onClose])

  const atStart = index <= 0
  const atEnd = index + step >= entries.length

  return (
    <div className="pg-spread" role="dialog" aria-modal="true" aria-label="Reading">
      <div className="pg-spread__bar">
        <button
          ref={closeRef}
          type="button"
          className="pg-spread__x"
          onClick={onClose}
          aria-label="Back to the wall"
        >
          Back to the wall
        </button>
        <div className="pg-spread__turn">
          <button
            type="button"
            className="pg-spread__arrow"
            onClick={() => onIndex(index - step)}
            disabled={atStart}
            aria-label="Previous pages"
          >
            ←
          </button>
          <button
            type="button"
            className="pg-spread__arrow"
            onClick={() => onIndex(index + step)}
            disabled={atEnd}
            aria-label="Next pages"
          >
            →
          </button>
        </div>
      </div>

      <div className="pg-spread__leaves" data-single={single ? 'true' : undefined}>
        {shown.map((entry) => (
          <Leaf
            key={entry.id}
            entry={entry}
            markQuotes={markQuotes.get(entry.id) ?? []}
            firstLineTitle={firstLineTitle}
            onEdit={onEdit}
          />
        ))}
      </div>
    </div>
  )
}

function Leaf({
  entry,
  markQuotes,
  firstLineTitle,
  onEdit,
}: {
  entry: Entry
  markQuotes: string[]
  firstLineTitle: boolean
  onEdit: (entryId: string) => void
}) {
  // Spiritual blocks are their own rendering elsewhere; on a reading page they'd
  // arrive as raw fenced code, which is markup, not writing.
  const html = useMemo(
    () => renderMarkdown(stripSpiritualBlocks(entry.body_markdown ?? ''), { asTitle: firstLineTitle }),
    [entry.body_markdown, firstLineTitle],
  )

  // Marginalia: what the writer set apart on this page, verbatim.
  const margin = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const q of markQuotes) {
      const t = q.replace(/\s+/g, ' ').trim()
      if (t && !seen.has(t)) {
        seen.add(t)
        out.push(t)
      }
    }
    for (const p of passagesForEntry(entry)) {
      if (!seen.has(p.text)) {
        seen.add(p.text)
        out.push(p.text)
      }
    }
    return out.slice(0, 4)
  }, [entry, markQuotes])

  return (
    <article className="pg-leaf">
      <header className="pg-leaf__head">
        <time className="pg-leaf__date" dateTime={entry.created_at}>
          {formatDate(entry.created_at)}
        </time>
        <button type="button" className="pg-leaf__edit" onClick={() => onEdit(entry.id)}>
          Open to write
        </button>
      </header>
      <div className="pg-leaf__cols">
        <div className="pg-leaf__body markdown-body" dangerouslySetInnerHTML={{ __html: html }} />
        {margin.length > 0 ? (
          <aside className="pg-leaf__margin" aria-label="What you set apart on this page">
            {margin.map((t, i) => (
              <p className="pg-leaf__note" key={i}>
                {t}
              </p>
            ))}
          </aside>
        ) : null}
      </div>
    </article>
  )
}
