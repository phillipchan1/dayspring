/**
 * Deterministic sentence split + span merge for Jev harvest.
 * Spans are slices of the original writer-words text, so they stay verbatim.
 */

import { writerWords } from '../writerWords.js'

export interface Sentence {
  id: string
  text: string
  start: number
  end: number
}

export type SentenceLabel = 'prayer' | 'sense' | 'neither'

const MAX_SENTENCES_PER_REQUEST = 240

/**
 * Split writer-words into sentences. `text` is always a substring of the
 * writer-words string (and therefore of the body, modulo H3 stripping).
 */
export function splitSentences(body: string): Sentence[] {
  const source = writerWords(body)
  if (!source.trim()) return []

  const spans: { start: number; end: number }[] = []
  const re = /[.!?]+(?:["”')\]]+)?(?=\s+|$)|(?:\n\s*\n)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(source)) !== null) {
    const end = m.index + m[0].length
    pushTrimmed(source, last, end, spans)
    last = end
  }
  if (last < source.length) pushTrimmed(source, last, source.length, spans)

  return spans.map((s, i) => ({
    id: `s${i}`,
    text: source.slice(s.start, s.end),
    start: s.start,
    end: s.end,
  }))
}

function pushTrimmed(
  source: string,
  from: number,
  to: number,
  out: { start: number; end: number }[],
): void {
  const slice = source.slice(from, to)
  if (!slice.trim()) return
  const lead = slice.match(/^\s*/)?.[0].length ?? 0
  const trail = slice.match(/\s*$/)?.[0].length ?? 0
  out.push({ start: from + lead, end: to - trail })
}

/** Join adjacent same-label sentences into one verbatim span via original offsets. */
export function mergeSpans(
  sentences: Sentence[],
  labels: SentenceLabel[],
  source: string,
): { type: 'prayer' | 'sense'; text: string }[] {
  const out: { type: 'prayer' | 'sense'; text: string }[] = []
  let i = 0
  while (i < sentences.length) {
    const label = labels[i]
    if (label !== 'prayer' && label !== 'sense') {
      i++
      continue
    }
    let j = i + 1
    while (j < sentences.length && labels[j] === label) j++
    const start = sentences[i]!.start
    const end = sentences[j - 1]!.end
    const text = source.slice(start, end)
    if (text.trim()) out.push({ type: label, text })
    i = j
  }
  return out
}

export function chunkSentences<T>(items: T[], size = MAX_SENTENCES_PER_REQUEST): T[][] {
  if (items.length === 0) return [[]]
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export { MAX_SENTENCES_PER_REQUEST }
