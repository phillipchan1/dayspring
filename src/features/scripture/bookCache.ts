import { assertSameOwner, cacheGeneration, getCache, setCache, windowCacheKey } from '@/lib/asyncCache'
import {
  getBookChapterHeat,
  getBookEntries,
  getBookSummary,
  getReturning,
  type BookChapterHeat,
  type BookEntry,
  type BookSummary,
  type DateWindow,
  type ReturningRef,
} from '@/lib/scripture/query'

/**
 * Everything the Lamp's book panel shows, read once and kept.
 *
 * Every open used to null the panel's state, print "Reading…", and pop the
 * book in when four reads came back — the second time you opened Psalms
 * exactly as slowly as the first (DESIGN_PRINCIPLES N5). Now the last reading
 * of a book through a window is kept in `asyncCache`, the same store the canon
 * paints from, and the panel draws it at once while a fresh read runs behind.
 *
 * Keyed under `scripture:` so `invalidateScriptureCache()` (a scan finishing)
 * and `clearAllCache()` (sign-out) take these with everything else.
 */
export interface BookPage {
  entries: BookEntry[]
  heat: BookChapterHeat
  summary: BookSummary
  returning: ReturningRef[]
}

export function bookCacheKey(osis: string, window: DateWindow): string {
  return `scripture:book:${osis}:${windowCacheKey(window)}`
}

/** The last reading of this book through this window, if there is one. */
export function cachedBook(osis: string, window: DateWindow): BookPage | undefined {
  return getCache<BookPage>(bookCacheKey(osis, window))
}

/**
 * Read the book through the window, keep it, and hand it back.
 *
 * Guarded like every other cached surface read: a read that outlives the owner
 * it started under (sign-out mid-flight) throws rather than landing one
 * account's verses in another's session.
 */
export async function loadBook(osis: string, window: DateWindow): Promise<BookPage> {
  const gen = cacheGeneration()
  const [entries, heat, summary, returning] = await Promise.all([
    getBookEntries(osis, window),
    getBookChapterHeat(osis, window),
    getBookSummary(osis, window),
    getReturning(8, window, osis),
  ])
  assertSameOwner(gen)
  const page: BookPage = { entries, heat, summary, returning }
  setCache(bookCacheKey(osis, window), page)
  return page
}
