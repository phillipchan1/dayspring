import { renderMarkdown } from '@/lib/markdown'
import { markdownForDisplay } from '@/lib/entryMarkdown'
import { HIGHLIGHT_HUES, HIGHLIGHT_ORDER } from '@/lib/highlightColors'
import type { Entry } from '@/lib/types'
import { deriveTitle } from './deriveTitle'

/**
 * Highlighter styles for the print window, which is a bare document with none
 * of the app's theme variables — so the hues are interpolated from their one
 * source of truth rather than restated.
 *
 * `print-color-adjust: exact` is not optional: browsers drop element
 * backgrounds when actually printing, and without it the highlight vanishes
 * from the one output where a highlight matters most.
 */
function highlightPrintCss(): string {
  const rules = HIGHLIGHT_ORDER.map(
    (c) => `  mark.hl--${c} { background: rgba(${HIGHLIGHT_HUES[c]}, 0.32); }`,
  ).join('\n')
  return `  mark.hl { padding: 0 .12em; border-radius: .18em; color: inherit; }
${rules}
  u.ul { text-decoration-thickness: .08em; text-underline-offset: .16em; }
  hr {
    border: 0;
    height: 2.2em;
    margin: 0.4em 0;
    background:
      linear-gradient(90deg, transparent, #888) no-repeat,
      linear-gradient(90deg, #888, transparent) no-repeat;
    background-size: calc(50% - 0.7em) 1px;
    background-position: left center, right center;
  }
  @media print {
    mark.hl { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }`
}

function entryTitle(entry: Entry): string {
  return deriveTitle(entry.body_markdown) || entry.title || 'Untitled'
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function filenameFor(entry: Entry): string {
  const base = entryTitle(entry)
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 48)
  const day = entry.created_at.slice(0, 10)
  return `${base || 'entry'}-${day}.md`
}

export async function copyEntryText(entry: Entry): Promise<void> {
  await navigator.clipboard.writeText(entry.body_markdown)
}

export async function copyEntryMarkdown(entry: Entry, asTitle = true): Promise<void> {
  // The body already opens with the first line; promote it to `# …` (when titles
  // are on) instead of prepending a second copy — which duplicated the title.
  await navigator.clipboard.writeText(markdownForDisplay(entry.body_markdown, { asTitle }))
}

export function downloadEntryMarkdown(entry: Entry, asTitle = true): void {
  const body = markdownForDisplay(entry.body_markdown, { asTitle })
  const blob = new Blob([body], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filenameFor(entry)
  a.click()
  URL.revokeObjectURL(url)
}

/** Opens a minimal print view for the entry body. */
export function printEntry(entry: Entry, asTitle = true): void {
  const title = entryTitle(entry)
  const html = renderMarkdown(entry.body_markdown, { asTitle })
  const win = window.open('', '_blank', 'noopener')
  if (!win) return
  const safeTitle = escapeHtml(title)
  win.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${safeTitle}</title>
<style>
  body { font-family: Georgia, serif; max-width: 40rem; margin: 2rem auto; line-height: 1.55; color: #222; }
  h1,h2,h3 { font-family: system-ui, sans-serif; }
  ol ol { list-style-type: lower-alpha; }
  ol ol ol { list-style-type: lower-roman; }
${highlightPrintCss()}
</style></head><body>${html}</body></html>`)
  win.document.close()
  win.focus()
  win.print()
}
