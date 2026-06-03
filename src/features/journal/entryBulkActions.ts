import JSZip from 'jszip'
import { markdownForDisplay } from '@/lib/entryMarkdown'
import type { Entry } from '@/lib/types'
import { deriveTitle } from './deriveTitle'
import { filenameFor } from './entryActions'

function entryTitle(entry: Entry): string {
  return deriveTitle(entry.body_markdown) || entry.title || 'Untitled'
}

function markdownDocument(entry: Entry, asTitle: boolean): string {
  return markdownForDisplay(entry.body_markdown, { asTitle })
}

export async function copyEntriesText(entries: Entry[]): Promise<void> {
  const body = entries
    .map((e) => {
      const title = entryTitle(e)
      return `--- ${title} ---\n\n${e.body_markdown}`
    })
    .join('\n\n')
  await navigator.clipboard.writeText(body)
}

export async function copyEntriesMarkdown(entries: Entry[], asTitle = true): Promise<void> {
  const body = entries.map((e) => markdownDocument(e, asTitle)).join('\n\n---\n\n')
  await navigator.clipboard.writeText(body)
}

export async function exportEntriesZip(entries: Entry[], asTitle = true): Promise<void> {
  const zip = new JSZip()
  const used = new Set<string>()
  for (const entry of entries) {
    let name = filenameFor(entry)
    if (used.has(name)) {
      const dot = name.lastIndexOf('.')
      const stem = dot === -1 ? name : name.slice(0, dot)
      const ext = dot === -1 ? '' : name.slice(dot)
      let n = 2
      while (used.has(`${stem}-${n}${ext}`)) n++
      name = `${stem}-${n}${ext}`
    }
    used.add(name)
    zip.file(name, markdownDocument(entry, asTitle))
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  const day = new Date().toISOString().slice(0, 10)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `dayspring-${entries.length}-entries-${day}.zip`
  a.click()
  URL.revokeObjectURL(url)
}
