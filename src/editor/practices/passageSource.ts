/**
 * Where a scripture ritual's words and light come from.
 *
 * - A chapter: the ESV, one chapter at a time, through the endpoint the
 *   chapter pane already uses (D-024's licence shape). Kept for the session,
 *   because the leaf re-reads the same chapter on every movement.
 * - The light: the Scripture surface's own heat and "you return to" strip,
 *   the same cached read — so the finder's lit canon is the writer's own
 *   history, never a recommendation.
 * - A word: the model picks references only; their words come from the ESV.
 *
 * Every one fails quiet. The finder still works from a typed reference when
 * the light will not load, and a chapter that will not load becomes a
 * reference read from your own Bible.
 *
 * In the dev `?__preview=` harnesses (no sign-in) the words are public-domain
 * WEB fixtures instead — see passageFixtures.ts.
 */
import { BOOKS } from '@/lib/bible/canon'
import { fetchScriptureChapter, fetchScriptureRefs, resolveScripturePassages } from '@/lib/spiritual'
import { loadScriptureCanonPage } from '@/lib/scripture/query'
import { chapterFromCitation } from '@/lib/scripture/citation'
import type { PassageRef, Verse } from './passage'

function inPreview(): boolean {
  return import.meta.env.DEV && typeof location !== 'undefined' && location.search.includes('__preview=')
}

const chapters = new Map<string, Promise<Verse[]>>()

/** One chapter's numbered verses; empty when it cannot be had. */
export function loadChapter(book: string, chapter: number): Promise<Verse[]> {
  const key = `${book} ${chapter}`
  const hit = chapters.get(key)
  if (hit) return hit
  const run = (async (): Promise<Verse[]> => {
    if (import.meta.env.DEV && inPreview()) {
      const { FIXTURE_CHAPTERS } = await import('./passageFixtures')
      return FIXTURE_CHAPTERS[key] ?? []
    }
    const res = await fetchScriptureChapter(book, chapter)
    return res.verses.map((v) => ({ n: v.n, text: v.text }))
  })().catch(() => [] as Verse[])
  chapters.set(key, run)
  // A failure is not remembered: offline now is online in a minute.
  void run.then((v) => {
    if (v.length === 0) chapters.delete(key)
  })
  return run
}

export interface PassageLight {
  /** Book OSIS → distinct entries that cite it. */
  books: Map<string, number>
  /** `${osis}:${chapter}` → distinct entries. */
  chapters: Map<string, number>
  max: number
  /** OSIS refs the writer keeps returning to, busiest first. */
  returning: string[]
}

const NO_LIGHT: PassageLight = { books: new Map(), chapters: new Map(), max: 0, returning: [] }

/** Where the writer's journal already leans. Dark, never wrong, when it can't load. */
export async function loadLight(): Promise<PassageLight> {
  if (import.meta.env.DEV && inPreview()) {
    const { FIXTURE_LIGHT } = await import('./passageFixtures')
    return FIXTURE_LIGHT
  }
  try {
    const page = await loadScriptureCanonPage()
    return {
      books: page.heat.books,
      chapters: page.heat.chapters,
      max: page.heat.max,
      returning: page.returning.map((r) => r.osis_ref),
    }
  } catch {
    return NO_LIGHT
  }
}

export interface TopicHit {
  ref: PassageRef
  /** The verse text, from the ESV; null while it resolves or when it would not. */
  text: string | null
}

/** Passages for a word: references chosen by the model, words from the ESV. */
export async function searchTopic(word: string): Promise<TopicHit[]> {
  if (import.meta.env.DEV && inPreview()) {
    const { FIXTURE_TOPICS, FIXTURE_CHAPTERS } = await import('./passageFixtures')
    const refs = (FIXTURE_TOPICS.find((t) => t.re.test(word)) ?? FIXTURE_TOPICS[0]!).refs
    return refs.flatMap((r) => {
      const ref = toRef(r)
      if (!ref) return []
      const verses = FIXTURE_CHAPTERS[`${ref.book} ${ref.chapter}`] ?? []
      const first = verses.find((v) => ref.from == null || v.n === ref.from)
      return [{ ref, text: first?.text ?? null }]
    })
  }
  const picks = (await fetchScriptureRefs(word)).slice(0, 4)
  const refs = picks.map((p) => p.reference)
  const resolved = await resolveScripturePassages(refs).catch(() => refs.map(() => null))
  return refs.flatMap((r, n) => {
    const ref = toRef(r)
    const text = resolved[n]?.text ?? null
    // An invalid reference resolves to nothing — the ESV is the validator.
    return ref && text ? [{ ref, text }] : []
  })
}

function toRef(reference: string): PassageRef | null {
  const t = chapterFromCitation(reference)
  if (!t) return null
  const book = BOOKS.find((b) => b.name === t.book)
  if (!book) return null
  return {
    book: book.name,
    chapter: t.chapter,
    from: t.verse,
    to: t.verse == null ? null : (t.verseEnd ?? t.verse),
  }
}
