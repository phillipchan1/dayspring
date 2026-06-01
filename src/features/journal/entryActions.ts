import { renderMarkdown } from '@/lib/markdown'
import type { Entry } from '@/lib/types'
import { deriveTitle } from './deriveTitle'

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

function filenameFor(entry: Entry): string {
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

export async function copyEntryMarkdown(entry: Entry): Promise<void> {
  const title = entryTitle(entry)
  await navigator.clipboard.writeText(`# ${title}\n\n${entry.body_markdown}`)
}

export function downloadEntryMarkdown(entry: Entry): void {
  const title = entryTitle(entry)
  const body = `# ${title}\n\n${entry.body_markdown}`
  const blob = new Blob([body], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filenameFor(entry)
  a.click()
  URL.revokeObjectURL(url)
}

/** Opens a minimal print view for the entry body. */
export function printEntry(entry: Entry): void {
  const title = entryTitle(entry)
  const html = renderMarkdown(entry.body_markdown)
  const win = window.open('', '_blank', 'noopener')
  if (!win) return
  const safeTitle = escapeHtml(title)
  win.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${safeTitle}</title>
<style>
  body { font-family: Georgia, serif; max-width: 40rem; margin: 2rem auto; line-height: 1.55; color: #222; }
  h1,h2,h3 { font-family: system-ui, sans-serif; }
</style></head><body>${html}</body></html>`)
  win.document.close()
  win.focus()
  win.print()
}
