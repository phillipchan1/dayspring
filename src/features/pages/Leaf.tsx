import { useMemo } from 'react'
import { renderMarkdown } from '@/lib/markdown'
import { stripSpiritualBlocks } from '@/lib/spiritualBlocks'
import { passagesForEntry } from '@/lib/remember'
import type { Entry } from '@/lib/types'
import { SPREAD_TRANSITION_NAME } from './viewTransition'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * One page, read rather than glanced at.
 *
 * This is the same component the wall renders at its closest zoom and the
 * Spread renders when you open a page — because they are the same thing seen
 * from two distances, not two features. Its content is the writer's markdown
 * rendered properly (their highlights, their blockquotes) rather than the
 * flattened lines a small card shows.
 *
 * Marks live in the outer margin rather than highlighted in the text, because
 * that is where marginalia goes in a book — and because a page of highlighter
 * is harder to read, not easier.
 */
export function Leaf({
  entry,
  shared,
  markQuotes,
  firstLineTitle,
  onEdit,
}: {
  entry: Entry
  /** Claims the shared transition name — exactly one leaf may, per transition. */
  shared: boolean
  markQuotes: string[]
  firstLineTitle: boolean
  onEdit: (entryId: string) => void
}) {
  /**
   * The whole page opens the editor.
   *
   * It used to carry an "Open to write" link, which is a label explaining what
   * the page already is. A click anywhere writes on it — except when you were
   * selecting text, because reading and copying out of a page is the other
   * thing you come here to do and it must not be hijacked.
   */
  const write = () => {
    const sel = window.getSelection()
    if (sel && !sel.isCollapsed) return
    onEdit(entry.id)
  }
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
    <article
      className="pg-leaf"
      style={shared ? { viewTransitionName: SPREAD_TRANSITION_NAME } : undefined}
      onClick={write}
      onKeyDown={(e) => {
        if (e.key === 'Enter') write()
      }}
      role="button"
      tabIndex={-1}
      aria-label={`${formatDate(entry.created_at)} — open to write`}
    >
      <header className="pg-leaf__head">
        <time className="pg-leaf__date" dateTime={entry.created_at}>
          {formatDate(entry.created_at)}
        </time>
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
