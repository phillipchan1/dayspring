import { BOOKS } from '@/lib/bible/canon'
import type { Entry } from '@/lib/types'
import { readPassage, type PassageRef } from './passage'
import { PRACTICE_BY_NAME, type Practice } from './practicesData'
import { ritualEntryShape } from './ritualDocument'

/** Where the Bible door picks up: the chapter after the last one read, walked the same way. */
export interface BibleResume {
  practice: Practice
  ref: PassageRef
}

/**
 * The chapter after this passage's, running on into the next book — or null
 * past the end of Revelation. Always a whole chapter: a reading plan would
 * track verses, and this is only "where you were".
 */
export function nextChapter(ref: PassageRef): PassageRef | null {
  const book = BOOKS.find((b) => b.name === ref.book)
  if (!book) return null
  if (ref.chapter < book.chapters) return { book: book.name, chapter: ref.chapter + 1, from: null, to: null }
  const following = BOOKS.find((b) => b.order === book.order + 1)
  return following ? { book: following.name, chapter: 1, from: null, to: null } : null
}

/**
 * The Bible door's "continue": the newest scripture ritual page, its practice,
 * and the chapter after its passage.
 *
 * Grounded in what the writer actually wrote and nothing else — no schedule,
 * no count, no "again". A page read from the writer's own Bible counts too:
 * the reference is all it keeps, and that is enough to go on from.
 */
export function bibleResume(entries: readonly Entry[]): BibleResume | null {
  let best: { at: string; practice: Practice; ref: PassageRef } | null = null
  for (const entry of entries) {
    const md = entry.body_markdown ?? ''
    // Cheap reject before parsing — this runs over the whole archive.
    if (!md.includes('<!-- ritual:')) continue
    if (best && entry.created_at <= best.at) continue
    const shape = ritualEntryShape(md)
    if (shape.kind !== 'ritual') continue
    const practice = PRACTICE_BY_NAME.get(shape.contents.name)
    if (!practice?.passage || practice.retired) continue
    const ref = readPassage(shape.contents.texts[0] ?? '')?.ref
    if (!ref) continue
    best = { at: entry.created_at, practice, ref }
  }
  if (!best) return null
  const ref = nextChapter(best.ref)
  return ref ? { practice: best.practice, ref } : null
}
