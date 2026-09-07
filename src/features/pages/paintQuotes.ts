import { stripMarkdownMarkers } from '@/lib/inlineMarkers'
import { splitOnMatch } from './pageExcerpt'

const SKIP = new Set(['CODE', 'PRE', 'SCRIPT', 'STYLE'])

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Paint passages the writer marked while re-reading.
 *
 * A span is intentional: subject lighting uses a mark element and may sit
 * inside this ground, just as a CodeMirror syntax span can sit inside `.cm-mark`.
 */
export function paintQuotes(
  root: HTMLElement,
  quotes: readonly string[],
  className: string,
): number {
  const patterns = [...new Set(
    quotes
      .map((quote) => stripMarkdownMarkers(quote).replace(/\s+/g, ' ').trim())
      .filter(Boolean),
  )]
    .sort((a, b) => b.length - a.length)
    .map((quote) => quote.split(/\s+/).map(escapeRegExp).join('\\s+'))
  if (patterns.length === 0) return 0

  const match = new RegExp(`(?:${patterns.join('|')})`, 'gi')
  const doc = root.ownerDocument
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT
      for (let p = node.parentElement; p && p !== root; p = p.parentElement) {
        if (SKIP.has(p.tagName) || p.classList.contains(className)) {
          return NodeFilter.FILTER_REJECT
        }
      }
      return NodeFilter.FILTER_ACCEPT
    },
  })

  const targets: Text[] = []
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    targets.push(node as Text)
  }

  let painted = 0
  for (const node of targets) {
    const runs = splitOnMatch(node.nodeValue ?? '', match)
    if (runs.length < 3) continue
    const fragment = doc.createDocumentFragment()
    for (let i = 0; i < runs.length; i++) {
      const run = runs[i]!
      if (!run) continue
      if (i % 2 === 1) {
        const span = doc.createElement('span')
        span.className = className
        span.textContent = run
        fragment.append(span)
        painted++
      } else {
        fragment.append(doc.createTextNode(run))
      }
    }
    node.parentNode?.replaceChild(fragment, node)
  }
  return painted
}
