/**
 * A passage set the way a Bible sets it: prose in paragraphs, poetry in its
 * lines — each half-line indented under the one it answers — with space
 * between stanzas, and a psalm's title, an acrostic letter or a speaker in the
 * Song above the words it belongs to.
 *
 * The shape comes from Crossway (see api/_lib/esvHtml.ts); nothing here
 * guesses at it. A verse without `parts` — fixtures, or anything from before
 * the shape was kept — reads as one plain paragraph, as it always did.
 *
 * Rows are the lines and paragraphs; a verse can span several rows and a row
 * can hold several verses, so each row holds fragments that remember which
 * verse they came from and where in that verse's words they start. Word
 * indices and character offsets stay the verse's own, so catching a phrase
 * and lighting it work exactly as they do on the flat text.
 *
 * Pure, so it is tested without a DOM — see passageLayout.test.ts.
 */
import type { VersePart } from '@/lib/spiritual'
import type { Verse } from './passage'

export interface Fragment {
  /** Index of the verse in the passage (not its number). */
  vi: number
  n: number
  /** The verse begins here — its number is drawn. */
  lead: boolean
  text: string
  /** Word index of `text`'s first word within the verse. */
  word: number
  /** Character offset of `text` within the verse's flat text. */
  char: number
  /** The last word is "Selah". */
  selah: boolean
}

export interface Row {
  kind: 'prose' | 'poetry'
  /** Poetry: 1 a line, 2 its indented half, 3 set far in. */
  indent: number
  /** Space above: a new stanza, or prose resuming after a poem. */
  gap: boolean
  /** Prose that starts flush — the passage's first paragraph, or one resuming. */
  flush: boolean
  head?: VersePart['head']
  frags: Fragment[]
}

const tidy = (s: string) => s.replace(/\s+/g, ' ').trim()
const wordCount = (s: string) => (s ? s.split(' ').length : 0)

/** The verse's parts, or the whole verse as one run of prose. */
export function partsOf(v: Verse): VersePart[] {
  const parts = (v.parts ?? []).map((p) => ({ ...p, text: tidy(p.text) })).filter((p) => p.text)
  return parts.length > 0 ? parts : [{ text: tidy(v.text), at: 'flow' }]
}

/** A verse's flat text as the rows draw it: its parts, single-spaced. */
export function flatText(v: Verse): string {
  return partsOf(v)
    .map((p) => p.text)
    .join(' ')
}

export function layoutPassage(verses: readonly Verse[]): Row[] {
  const rows: Row[] = []
  verses.forEach((v, vi) => {
    let word = 0
    let char = 0
    partsOf(v).forEach((p, pi) => {
      const frag: Fragment = {
        vi,
        n: v.n,
        lead: pi === 0,
        text: p.text,
        word,
        char,
        selah: Boolean(p.selah),
      }
      word += wordCount(p.text)
      char += p.text.length + 1

      const last = rows[rows.length - 1]
      if (last && p.at === 'flow' && !p.head) {
        last.frags.push(frag)
        return
      }
      const poetry = p.at === 'line' || p.at === 'stanza'
      const first = rows.length === 0
      rows.push({
        kind: poetry ? 'poetry' : 'prose',
        indent: poetry ? Math.min(Math.max(p.indent ?? 1, 1), 3) : 0,
        gap:
          !first &&
          (p.at === 'stanza' || Boolean(p.head) || (!poetry && last?.kind === 'poetry')),
        flush: !poetry && (first || Boolean(p.resume) || p.at === 'flow'),
        ...(p.head ? { head: p.head } : {}),
        frags: [frag],
      })
    })
  })
  return rows
}

/**
 * Split a word around the divine name. The ESV prints YHWH as LORD (and GOD
 * after "Lord") in small capitals; the text keeps the capitals verbatim and
 * only the drawing changes.
 */
export function divineName(word: string): { text: string; name: boolean }[] {
  return word
    .split(/(?<![A-Za-z])(LORD|GOD)(?![A-Za-z])/)
    .map((text, i) => ({ text, name: i % 2 === 1 }))
    .filter((s) => s.text)
}
