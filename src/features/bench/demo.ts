// Running the engine over a demo page, live.
//
// The point of a demo is that you can see what the machine did and check it
// against what it should have done, on prose whose right answer is already
// known. The 130-entry recognition corpus is exactly that: hand-authored
// journal prose with hand-labelled expected output, and nothing in it came
// from a real journal — so it can be shown, edited and broken freely.
//
// Only the DETERMINISTIC half of the engine runs here: scripture parsing, fence
// parsing, subject matching and the join. That is not a limitation to apologise
// for — it is most of the pipeline, it is the half that runs on every save, and
// it is the half where drift is silent. The model-dependent half (the harvest,
// subject tagging) is scored by `npm run eval:recognition`, and its expected
// output is shown here beside the live result so the gap stays visible.

import { parseSpiritualBlocks } from '@/lib/spiritualBlocks'
import { parseReferences } from '@/lib/scripture/parse'
import type { LoadedEntry } from '@/lib/recognition/corpus'
import { markingsNearSubject, type LocatableMarking } from '@/lib/subjectJoin'
import type { SpiritualItemType } from '@/lib/types'
import { subjectMatcher } from './measure'

export interface FoundRef {
  osis: string
  charStart: number
  charEnd: number
  confidence: number
  /** Matches something the corpus expects here. */
  expected: boolean
}

export interface FoundMarking extends LocatableMarking {
  /** 'fence' — the writer typed it. 'expected' — the model is supposed to find it. */
  origin: 'fence' | 'expected'
}

export interface JoinedRow {
  subject: string
  markings: { type: SpiritualItemType; distance: number; text: string }[]
  refs: { osis: string; distance: number }[]
}

export interface DemoRun {
  refs: FoundRef[]
  /** Expected by the corpus but not found — the misses, named. */
  missedRefs: string[]
  markings: FoundMarking[]
  subjects: string[]
  joined: JoinedRow[]
}

/**
 * Every subject this page offers: the names the corpus expects the Concordance
 * to learn, plus the matters it expects the Altar to derive. Both vocabularies,
 * because a page that only showed one would demonstrate the wrong thing.
 */
export function subjectsFor(entry: LoadedEntry): string[] {
  const names = (entry.entities ?? []).map((e) => e.canonical)
  const matters = (entry.subjects ?? []).map((s) => s.label)
  return [...new Set([...names, ...matters])]
}

/** Line index of a character offset. */
function lineAt(body: string, offset: number): number {
  let line = 0
  for (let i = 0; i < Math.min(offset, body.length); i++) {
    if (body.charCodeAt(i) === 10) line++
  }
  return line
}

/**
 * Run the deterministic engine over a body and join what it found to subjects.
 *
 * `entry` supplies the expectations only. The body is passed separately so the
 * page stays live under editing — the whole value of a sandbox is being able to
 * change one word and watch the output move.
 */
export function runDemo(
  body: string,
  entry: LoadedEntry | null,
  within: number,
  personForms: string[] = [],
): DemoRun {
  const expectedOsis = new Set((entry?.refs ?? []).map((r) => r.osis))

  const parsed = parseReferences(body, personForms.length ? { personForms } : undefined)
  const refs: FoundRef[] = parsed.map((r) => ({
    osis: r.osis_ref,
    charStart: r.char_start,
    charEnd: r.char_end,
    confidence: r.confidence,
    expected: expectedOsis.has(r.osis_ref),
  }))
  const foundOsis = new Set(refs.map((r) => r.osis))
  const missedRefs = [...expectedOsis].filter((o) => !foundOsis.has(o))

  // What the writer typed — fences, with their exact offsets.
  const markings: FoundMarking[] = parseSpiritualBlocks(body).map((b) => ({
    id: b.id,
    type: b.type,
    content: b.content,
    charStart: b.from,
    origin: 'fence' as const,
  }))

  // What the model is supposed to notice. Located by verbatim search, which is
  // the same guarantee the harvest itself has to meet.
  for (const [i, p] of (entry?.passages ?? []).entries()) {
    const at = body.indexOf(p.text)
    markings.push({
      id: `expected-${i}`,
      type: p.type,
      content: p.text,
      charStart: at === -1 ? null : at,
      origin: 'expected',
    })
  }

  const subjects = entry ? subjectsFor(entry) : []
  const joined: JoinedRow[] = subjects.map((label) => {
    const match = subjectMatcher(label)
    const near = markingsNearSubject(body, match, markings, within)
    const byId = new Map(markings.map((m) => [m.id, m]))
    const mentionAt = [...body.matchAll(subjectMatcher(label))].map((m) => lineAt(body, m.index ?? 0))
    return {
      subject: label,
      markings: near.map((h) => ({
        type: h.type,
        distance: h.distance,
        text: byId.get(h.id)?.content ?? '',
      })),
      refs: refs
        .map((r) => {
          const line = lineAt(body, r.charStart)
          let nearest = Number.POSITIVE_INFINITY
          for (const m of mentionAt) nearest = Math.min(nearest, Math.abs(m - line))
          return { osis: r.osis, distance: nearest }
        })
        .filter((r) => r.distance <= within),
    }
  })

  return { refs, missedRefs, markings, subjects, joined }
}
