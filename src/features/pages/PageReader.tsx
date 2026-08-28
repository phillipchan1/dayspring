import { useLayoutEffect, useMemo, useRef } from 'react'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useSwipeToDismiss } from '@/hooks/useSwipeToDismiss'
import { renderMarkdown } from '@/lib/markdown'
import { passagesForEntry } from '@/lib/remember'
import { stripSpiritualBlocks } from '@/lib/spiritualBlocks'
import { MarkGlyph } from '@/components/MarkGlyph'
import { MARK_KIND } from '@/lib/markKinds'
import type { PageMarking } from '@/lib/spiritual'
import type { Entry, SpiritualItemType } from '@/lib/types'
import { paintMatches } from './paintMatches'
import { drawMarkings, flatten, sortMarkings } from './pageMarkings'

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
 * and that lives in the header, not over the writing. The lit words are not an
 * exception to that rule: they are the writer's own words, lit.
 */
export function PageReader({
  entry,
  markQuotes,
  markings,
  match,
  firstLineTitle,
  onEdit,
  onBack,
}: {
  entry: Entry
  markQuotes: string[]
  /**
   * What the page carries, with the sentences it was made of.
   *
   * A marking used to be a page-level boolean with no words, so "Tiffany and
   * Scripture" could only mean "both true somewhere here" and an opened page
   * had nothing to show for it. With the text, the ones the page actually says
   * are drawn where they sit and the rest go to the margin (see
   * `pageMarkings.ts`).
   */
  markings: readonly PageMarking[]
  /**
   * The lit subjects, for painting the matched words. Null when nothing is lit.
   *
   * Without this, opening a page from a filtered wall dropped the highlighting
   * the card had: you searched for a name, saw it on the card, clicked in, and
   * the page looked like every other page. The word that made this page appear
   * has to still be visible on it, or the filter has no through line.
   */
  match: RegExp | null
  firstLineTitle: boolean
  onEdit: (entryId: string) => void
  /** Back to the list this page was opened from. */
  onBack: () => void
}) {
  /*
   * Touch changes two things about this page, and both are about there being
   * exactly one place a page is read.
   *
   * A pointer can rest on the page without pressing it, so "click the page to
   * write on it" costs a mouse nothing. A finger cannot: on a phone every tap
   * meant for scrolling, for dismissing the keyboard, for nothing at all threw
   * the reader into the editor — a second full-screen view of the same entry,
   * arrived at by accident. So on touch the page is only a page, and `Write` in
   * the header is the way in.
   *
   * And the way out becomes a gesture. `either` direction: backing out is a
   * rightward drag on iOS and a leftward one in plenty of Android apps, and a
   * reader that answers to only one of them reads as broken to whoever has the
   * other habit.
   */
  const touch = useMediaQuery('(pointer: coarse)')
  const back = useSwipeToDismiss({
    onDismiss: () => {
      // Dragging out a selection is a horizontal gesture too, and copying a
      // sentence out of a page is the other thing this view is for.
      const sel = window.getSelection()
      if (sel && !sel.isCollapsed) return
      onBack()
    },
    enabled: touch,
    direction: 'either',
    threshold: 64,
  })
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

  /**
   * Light the lit words, after the markdown is on the page.
   *
   * The body is rendered HTML, so the matches cannot be wrapped in the string —
   * a subject called "img" or "class" would rewrite the markup. `paintMatches`
   * walks text nodes instead, which can only ever touch what the writer wrote.
   *
   * The `innerHTML` reset is what makes this idempotent. React skips the DOM
   * write when `html` is unchanged, so a previous pass's `<mark>`s would still
   * be sitting there when the subject changes; restoring the pristine markup
   * first means the paint is always applied to a clean page rather than layered
   * onto the last one.
   */
  /**
   * The markings this page says out loud, and the ones it doesn't.
   *
   * A declared `/pray` is stripped from both the prose and the rendered page,
   * so it is correctly never found — it is not missing, it is its own thing,
   * and the margin is where it goes.
   */
  const { inProse, loose } = useMemo(
    () => sortMarkings(entry.body_markdown, markings),
    [entry.body_markdown, markings],
  )

  const bodyRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = bodyRef.current
    if (!el) return
    el.innerHTML = html
    paintMatches(el, match, 'pg-read1__lit')
    drawMarkings(el, inProse)
  }, [html, match, inProse])

  /**
   * What the writer set apart on this page, verbatim, in the margin.
   *
   * Three sources, deduped on the flattened text because they overlap: a
   * highlighted sentence is often also the sentence a prayer was harvested
   * from. A marking goes in labelled with its kind — that label is the only
   * word in the margin the writer did not type, and it names one of six closed
   * kinds rather than describing anything.
   */
  const margin = useMemo(() => {
    const seen = new Set<string>()
    const out: { text: string; kind?: SpiritualItemType }[] = []
    const add = (raw: string, kind?: SpiritualItemType) => {
      const t = raw.replace(/\s+/g, ' ').trim()
      const key = flatten(t)
      if (!t || !key || seen.has(key)) return
      seen.add(key)
      out.push(kind ? { text: t, kind } : { text: t })
    }
    for (const q of markQuotes) add(q)
    for (const m of loose) add(m.content, m.type)
    for (const p of passagesForEntry(entry)) add(p.text)
    return out
  }, [entry, markQuotes, loose])

  /*
   * On a pointer the whole page opens the editor — except while selecting text,
   * because reading and copying out of a page is the other thing you come here
   * to do and it must not be hijacked. On touch nothing here writes: see the
   * note on `touch` above.
   */
  const write = () => {
    const sel = window.getSelection()
    if (sel && !sel.isCollapsed) return
    onEdit(entry.id)
  }

  const asButton = touch
    ? {}
    : {
        onClick: write,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === 'Enter') write()
        },
        role: 'button',
        tabIndex: 0,
        'aria-label': `${formatDate(entry.created_at)} — open to write`,
      }

  return (
    <div className="pg-read1" {...back.handlers}>
      {/*
        The page follows the finger while the back-swipe is being made, and
        snaps or leaves on release. On the inner element rather than the
        scroller, because `.pg-read1` carries the entrance animation and an
        animated transform beats an inline one for as long as the animation's
        `both` fill holds.
      */}
      <div
        className="pg-read1__slide"
        data-dragging={back.dragging ? 'true' : undefined}
        style={back.dragX ? { transform: `translateX(${back.dragX}px)` } : undefined}
      >
        {/*
          Keyed on the entry, so stepping to the next page re-runs the article's
          entrance. Without the key React reuses the element and the words swap
          with no acknowledgement at all — which on a surface built for reading is
          the one place a beat is worth having.
        */}
        <article key={entry.id} className="pg-read1__page" {...asButton}>
          <header className="pg-read1__head">
            <time className="pg-read1__date" dateTime={entry.created_at}>
              {formatDate(entry.created_at)}
            </time>
          </header>

          <div className="pg-read1__cols">
            <div
              ref={bodyRef}
              className="pg-read1__body markdown-body"
              dangerouslySetInnerHTML={{ __html: html }}
            />
            {margin.length > 0 ? (
              <aside className="pg-read1__margin" aria-label="What you set apart on this page">
                {margin.map((note, i) => (
                  <p className="pg-read1__note" key={i}>
                    {note.kind ? (
                      <span
                        className="pg-read1__kind"
                        style={{ ['--tone']: MARK_KIND[note.kind]?.tone } as React.CSSProperties}
                      >
                        <MarkGlyph kind={note.kind} className="pg-read1__kind-hand" />
                        {MARK_KIND[note.kind]?.label ?? note.kind}
                      </span>
                    ) : null}
                    {note.text}
                  </p>
                ))}
              </aside>
            ) : null}
          </div>
        </article>
      </div>
    </div>
  )
}
