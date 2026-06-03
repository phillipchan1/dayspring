import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { markdownForDisplay, type DisplayOptions } from './entryMarkdown'

marked.setOptions({
  gfm: true,
  breaks: true, // journal entries: single newlines become <br>
})

/** Render markdown to sanitized HTML for the read-only reading view. */
export function renderMarkdown(md: string, opts: DisplayOptions = {}): string {
  const raw = marked.parse(markdownForDisplay(md, opts), { async: false })
  return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } })
}
