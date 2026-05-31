import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { markdownForDisplay } from './entryMarkdown'

marked.setOptions({
  gfm: true,
  breaks: true, // journal entries: single newlines become <br>
})

/** Render markdown to sanitized HTML for the read-only reading view. */
export function renderMarkdown(md: string): string {
  const raw = marked.parse(markdownForDisplay(md), { async: false })
  return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } })
}
