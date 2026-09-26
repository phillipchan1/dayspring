/**
 * Drawn lines, read back.
 *
 * On a scripture ritual's page every `> … (v. N)` line is a phrase the writer
 * drew from the passage. The reader shows each as what it is — a quote, with its
 * verse as a small tag rather than raw `(v. 4)` — and lights the same words
 * inside the passage above. Hovering a quote lights its words; hovering the
 * words lights their quote. That is the line, in a single column.
 *
 * Nothing is stored for this: the quote line is the truth, and the words are
 * found by text, exactly as the composer finds them.
 */

const VERSE_TAIL = /\s*\(\s*(vv?)\.?\s*(\d+)(?:\s*[-–]\s*(\d+))?\s*\)\s*$/

/** Same length in, same length out — offsets into the folded text are offsets into the page. */
const fold = (s: string) =>
  s.toLowerCase().replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s/g, ' ')

/** Wrap [start, end) of an element's text in marks, across text nodes and `<br>`s. */
function wrapText(root: HTMLElement, start: number, end: number, make: () => HTMLElement): HTMLElement[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: { node: Text; at: number }[] = []
  let at = 0
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n as Text
    nodes.push({ node: t, at })
    at += t.data.length
  }
  const made: HTMLElement[] = []
  for (const { node, at: s0 } of nodes) {
    const s1 = s0 + node.data.length
    if (end <= s0 || start >= s1) continue
    const range = document.createRange()
    range.setStart(node, Math.max(0, start - s0))
    range.setEnd(node, Math.min(node.data.length, end - s0))
    const mark = make()
    range.surroundContents(mark)
    made.push(mark)
  }
  return made
}

/** The passage's text as the reader shows it, with each `<br>` read as a space. */
function readableText(p: HTMLElement): string {
  let out = ''
  const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) out += (n as Text).data
  return out
}

/**
 * Draw the page's quotes. `scripture` is whether the page is a scripture ritual
 * (then every blockquote is a drawn quote); elsewhere only a blockquote that
 * carries a verse number is one. Returns the cleanup for the hover listeners.
 */
export function drawReaderQuotes(el: HTMLElement, scripture: boolean): () => void {
  const passages = [...el.querySelectorAll<HTMLElement>('figure.read-scripture > p')]
  const quotes = [...el.querySelectorAll<HTMLElement>('blockquote')]
  const cleanups: (() => void)[] = []
  let k = 0
  for (const bq of quotes) {
    const text = (bq.textContent ?? '').trim()
    const tail = text.match(VERSE_TAIL)
    if (!scripture && !tail) continue
    const key = String(k++)
    bq.classList.add('read-quote')
    bq.dataset.q = key
    // The verse, as a tag rather than as words of the quote.
    if (tail) {
      const walker = document.createTreeWalker(bq, NodeFilter.SHOW_TEXT)
      let last: Text | null = null
      for (let n = walker.nextNode(); n; n = walker.nextNode()) if ((n as Text).data.trim()) last = n as Text
      const m = last?.data.match(VERSE_TAIL)
      if (last && m) {
        last.data = last.data.slice(0, m.index)
        const tag = document.createElement('span')
        tag.className = 'read-quote__v'
        tag.textContent = m[3] ? `vv. ${m[2]}–${m[3]}` : `v. ${m[2]}`
        last.parentElement?.appendChild(tag)
      }
    }
    const words = text.replace(VERSE_TAIL, '').trim()
    const needle = fold(words.replace(/\s+/g, ' '))
    const marks: HTMLElement[] = []
    if (needle) {
      for (const p of passages) {
        const hay = fold(readableText(p))
        const at = hay.indexOf(needle)
        if (at === -1) continue
        marks.push(
          ...wrapText(p, at, at + needle.length, () => {
            const mark = document.createElement('mark')
            mark.className = 'read-drawn'
            mark.dataset.q = key
            return mark
          }),
        )
        break
      }
    }
    const light = (on: boolean) => {
      bq.classList.toggle('is-lit', on)
      marks.forEach((m) => m.classList.toggle('is-lit', on))
    }
    const enter = () => light(true)
    const leave = () => light(false)
    for (const t of [bq, ...marks]) {
      t.addEventListener('mouseenter', enter)
      t.addEventListener('mouseleave', leave)
      cleanups.push(() => {
        t.removeEventListener('mouseenter', enter)
        t.removeEventListener('mouseleave', leave)
      })
    }
  }
  return () => cleanups.forEach((c) => c())
}
