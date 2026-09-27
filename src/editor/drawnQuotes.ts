import { EditorSelection, EditorState, Prec, RangeSet, RangeValue, type Extension, type Text, type TransactionSpec } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'

/**
 * Drawn quotes are the passage's words, not the writer's — so in a scripture
 * ritual's answer a `>` line is one object: it can be deleted whole, never
 * edited, and nothing the writer types ever becomes part of it.
 *
 * Why it matters beyond feel: every `>` line inside a scripture ritual is read
 * as Scripture (writerWords, Guardrail H3), and its words are found in the
 * passage by text. Before this, Enter at the end of a quote continued the
 * markup (`> `), so the writer's next line was stored as a verse and dropped
 * from everything that reads "your words"; and a changed word broke the line
 * back to the passage without saying so.
 *
 * - The caret steps over a quote (atomic), so it can only sit at either end.
 * - Enter or typing at a quote's end starts the writer's own paragraph below
 *   it; at its start, one above it.
 * - Backspace/Delete into a quote takes the whole quote (atomic); a delete that
 *   would glue a line onto it instead selects it, so a second press removes it.
 * - Quotes placed by the composer (no user event) pass through untouched.
 */

const QUOTE = /^\s*>/
const isQuote = (text: string) => QUOTE.test(text)
const blank = (text: string) => text.trim() === ''

class Atom extends RangeValue {}
const ATOM = new Atom()

function quoteRanges(doc: Text): RangeSet<Atom> {
  const ranges = []
  for (let n = 1; n <= doc.lines; n++) {
    const line = doc.line(n)
    if (isQuote(line.text) && line.to > line.from) ranges.push(ATOM.range(line.from, line.to))
  }
  return RangeSet.of(ranges)
}

/** Quote lines, and how many of them run straight into the writer's words (markdown would fold those in). */
function shape(doc: Text): { quotes: string[]; glued: number } {
  const quotes: string[] = []
  let glued = 0
  for (let n = 1; n <= doc.lines; n++) {
    const text = doc.line(n).text
    if (!isQuote(text)) continue
    quotes.push(text.trim())
    const next = n < doc.lines ? doc.line(n + 1).text : null
    const prev = n > 1 ? doc.line(n - 1).text : null
    if (next != null && !blank(next) && !isQuote(next)) glued++
    if (prev != null && !blank(prev) && !isQuote(prev)) glued++
  }
  return { quotes, glued }
}

/**
 * Where the writer's own line goes when they write at a quote's end: a blank
 * line below the quote, then theirs — reusing blank lines already there.
 */
function belowQuote(doc: Text, lineNo: number): { at: number; insert: string; caret: number } {
  const line = doc.line(lineNo)
  const n1 = lineNo < doc.lines ? doc.line(lineNo + 1) : null
  if (!n1) return { at: line.to, insert: '\n\n', caret: line.to + 2 }
  if (!blank(n1.text)) return { at: line.to, insert: '\n\n\n', caret: line.to + 2 }
  const n2 = lineNo + 1 < doc.lines ? doc.line(lineNo + 2) : null
  if (!n2) return { at: n1.to, insert: '\n', caret: n1.to + 1 }
  if (blank(n2.text) && n2.text.length === 0) return { at: n2.from, insert: '', caret: n2.from }
  return { at: n1.to, insert: '\n\n', caret: n1.to + 1 }
}

function enterAtQuote(view: EditorView): boolean {
  const { state } = view
  const sel = state.selection.main
  if (!sel.empty) return false
  const line = state.doc.lineAt(sel.head)
  if (!isQuote(line.text)) return false
  if (sel.head === line.from && line.from !== line.to) {
    // At its start: a new line above, and the caret stays on it.
    view.dispatch({ changes: { from: line.from, insert: '\n\n' }, selection: { anchor: line.from }, userEvent: 'input', scrollIntoView: true })
    return true
  }
  const { at, insert, caret } = belowQuote(state.doc, line.number)
  view.dispatch({ changes: insert ? { from: at, insert } : [], selection: { anchor: caret }, userEvent: 'input', scrollIntoView: true })
  return true
}

const guard = EditorState.transactionFilter.of((tr) => {
  if (!tr.docChanged) return tr
  if (!tr.isUserEvent('input') && !tr.isUserEvent('delete') && !tr.isUserEvent('move')) return tr
  const start = tr.startState.doc

  // One plain insertion at a quote's edge: move it into the writer's own line.
  const edits: { fromA: number; toA: number; text: string }[] = []
  tr.changes.iterChanges((fromA, toA, _fb, _tb, inserted) => edits.push({ fromA, toA, text: inserted.toString() }))
  if (edits.length === 1 && edits[0]!.fromA === edits[0]!.toA && edits[0]!.text) {
    const { fromA, text } = edits[0]!
    const line = start.lineAt(fromA)
    if (isQuote(line.text) && line.to > line.from) {
      if (fromA === line.to) {
        // A newline here is Enter, however it arrived: the paragraph below is the break.
        const body = text.replace(/^\n+/, '')
        const below = belowQuote(start, line.number)
        const insert = below.insert + body
        return { changes: insert ? { from: below.at, insert } : [], selection: { anchor: below.caret + body.length }, userEvent: 'input', scrollIntoView: true } satisfies TransactionSpec
      }
      if (fromA === line.from) {
        const body = text.replace(/\n+$/, '')
        return { changes: { from: line.from, insert: `${body}\n\n` }, selection: { anchor: line.from + body.length }, userEvent: 'input', scrollIntoView: true } satisfies TransactionSpec
      }
      return [] // inside a quote: its words are the passage's
    }
  }

  // Anything else: every quote survives whole or goes whole, and none gets glued to prose.
  const before = shape(start)
  const after = shape(tr.newDoc)
  const newText = tr.newDoc.toString()
  const kept = new Set(after.quotes)
  const broken = before.quotes.some((q) => !kept.has(q) && newText.includes(q.replace(QUOTE, '').trim()))
  const reshaped = after.quotes.some((q) => !before.quotes.includes(q)) && after.quotes.length <= before.quotes.length
  if (!broken && !reshaped && after.glued <= before.glued) return tr

  // Refused. If it was a delete, hand the writer the quote it ran into, so the next press removes it.
  if (tr.isUserEvent('delete')) {
    let target: { from: number; to: number } | null = null
    tr.changes.iterChangedRanges((fromA, toA) => {
      if (target) return
      for (const pos of [fromA, toA, Math.max(0, fromA - 1), Math.min(start.length, toA + 1)]) {
        const line = start.lineAt(pos)
        if (isQuote(line.text)) {
          target = { from: line.from, to: line.to }
          return
        }
      }
    })
    if (target) return { selection: EditorSelection.single((target as { from: number }).from, (target as { to: number }).to) }
  }
  return []
})

export function drawnQuotesExtension(): Extension {
  return [
    Prec.highest(keymap.of([{ key: 'Enter', run: enterAtQuote }])),
    guard,
    EditorView.atomicRanges.of((view) => quoteRanges(view.state.doc)),
  ]
}
