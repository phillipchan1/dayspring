import { useMemo } from 'react'
import { renderMarkdown } from '@/lib/markdown'
import { passagesForEntry } from '@/lib/remember'
import { stripSpiritualBlocks } from '@/lib/spiritualBlocks'
import type { Entry } from '@/lib/types'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * One page, open.
 *
 * ── Why this is its own view, and not the wall ──────────────────────────────
 *
 * Opening a page used to BE the wall, zoomed in and scrolled to that page.
 * That was the plan's own idea and it is wrong in the hand for two reasons.
 *
 * The wall keeps every cell the same size, so a page longer than one cell
 * continued onto the next leaf — which is right when you are moving along a
 * shelf reading spines, and wrong when you have asked for one page. You get a
 * page that ends mid-sentence and resumes below a gap, with the next day's
 * writing waiting underneath. It is a paginated view of something nobody asked
 * to have paginated.
 *
 * And it moved the zoom, which is a persisted setting, so opening one page
 * quietly changed how the whole wall looked afterwards. Reading something is
 * not a statement about how you like your shelf arranged.
 *
 * So opening a page is a page: the whole of it, top to bottom, scrolling the
 * way a document scrolls. The wall keeps its own zoom, untouched, and is
 * exactly as you left it when you come back.
 *
 * Everything on it is still only the writer's: their words, their date, their
 * marginalia. No summary, no title we invented, no chrome except the way out —
 * and that lives in the header, not over the writing.
 */
export function PageReader({
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
  /*
   * Spiritual blocks are their own rendering elsewhere; here they would arrive
   * as raw fenced code, which is markup rather than writing.
   */
  const html = useMemo(
    () =>
      renderMarkdown(stripSpiritualBlocks(entry.body_markdown ?? ''), {
        asTitle: firstLineTitle,
      }),
    [entry.body_markdown, firstLineTitle],
  )

  /** What the writer set apart on this page, verbatim, in the margin. */
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
    return out
  }, [entry, markQuotes])

  /*
   * The whole page opens the editor — except while selecting text, because
   * reading and copying out of a page is the other thing you come here to do
   * and it must not be hijacked.
   */
  const write = () => {
    const sel = window.getSelection()
    if (sel && !sel.isCollapsed) return
    onEdit(entry.id)
  }

  return (
    <div className="pg-read1">
      <article
        className="pg-read1__page"
        onClick={write}
        onKeyDown={(e) => {
          if (e.key === 'Enter') write()
        }}
        role="button"
        tabIndex={0}
        aria-label={`${formatDate(entry.created_at)} — open to write`}
      >
        <header className="pg-read1__head">
          <time className="pg-read1__date" dateTime={entry.created_at}>
            {formatDate(entry.created_at)}
          </time>
        </header>

        <div className="pg-read1__cols">
          <div
            className="pg-read1__body markdown-body"
            dangerouslySetInnerHTML={{ __html: html }}
          />
          {margin.length > 0 ? (
            <aside className="pg-read1__margin" aria-label="What you set apart on this page">
              {margin.map((t, i) => (
                <p className="pg-read1__note" key={i}>
                  {t}
                </p>
              ))}
            </aside>
          ) : null}
        </div>
      </article>
    </div>
  )
}
