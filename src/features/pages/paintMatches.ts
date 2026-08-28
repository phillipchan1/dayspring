// Lighting the lit words inside a rendered page.
//
// A card paints its matches by splitting flat text (`splitOnMatch`), which is
// easy because a card's excerpt IS flat text. An open page is not: it is the
// writer's markdown, rendered — their headings, blockquotes, highlights and
// links — and the only honest way to light a word inside that is to touch the
// text nodes and nothing else.
//
// So: never a regex over the HTML string. Attribute values, tag names and URLs
// all live in that string, and a subject called "img" or "class" would rewrite
// the markup. Walking text nodes cannot: whatever is matched is text the writer
// wrote, and whatever is wrapped is wrapped in place.

import { splitOnMatch } from './pageExcerpt'

/**
 * Where a match is not a match.
 *
 * Inside a code span the characters are a literal, not prose — the same reason
 * `facets.ts` reads content lines rather than raw markdown.
 */
const SKIP = new Set(['CODE', 'PRE', 'SCRIPT', 'STYLE', 'MARK'])

/**
 * Wrap every match under `root` in a `<mark>`, in place.
 *
 * Returns how many it painted, which is what lets a caller say "this page is
 * lit but the word is not on screen" rather than guessing.
 *
 * ── One limitation, stated rather than worked around ────────────────────────
 *
 * A match that straddles an element boundary — `**Est**her` — is not found,
 * because it is two text nodes. Stitching them would mean re-wrapping arbitrary
 * inline markup around a split, and the writer's emphasis is not ours to move.
 * The card has the same blind spot for the same reason (its excerpt strips
 * markers, so the two agree), and a subject broken mid-word by emphasis is rare
 * enough to be worth an honest miss over a clever mangle.
 */
export function paintMatches(root: HTMLElement, match: RegExp | null, className: string): number {
  if (!match) return 0
  const doc = root.ownerDocument
  if (!doc) return 0

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT
      for (let p = node.parentElement; p && p !== root; p = p.parentElement) {
        if (SKIP.has(p.tagName)) return NodeFilter.FILTER_REJECT
      }
      return NodeFilter.FILTER_ACCEPT
    },
  })

  // Collected before anything is replaced: mutating the tree under a live
  // TreeWalker is how you get a half-painted page and a walker pointing at a
  // node that is no longer in the document.
  const targets: Text[] = []
  for (let n = walker.nextNode(); n; n = walker.nextNode()) targets.push(n as Text)

  let painted = 0
  for (const node of targets) {
    // Odd indices are the matched runs — the same contract the cards use.
    const runs = splitOnMatch(node.nodeValue ?? '', match)
    if (runs.length < 3) continue
    const frag = doc.createDocumentFragment()
    for (let i = 0; i < runs.length; i++) {
      const run = runs[i]!
      if (!run) continue
      if (i % 2 === 1) {
        const el = doc.createElement('mark')
        el.className = className
        el.textContent = run
        frag.appendChild(el)
        painted++
      } else {
        frag.appendChild(doc.createTextNode(run))
      }
    }
    node.parentNode?.replaceChild(frag, node)
  }
  return painted
}
