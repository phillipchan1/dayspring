// ESV passage resolver — the source of truth for verse text.
//
// The model picks references; this module turns a reference string into the
// verbatim ESV text. Resolution is cache-first: we look in the shared
// `scripture_text` table, and only call Crossway's API (api.esv.org) on a miss,
// writing the result back so each passage is fetched at most once.
//
// The ESV API is also our validator: an invalid or nonexistent reference comes
// back with an empty `canonical` / no passages, so a hallucinated reference
// resolves to null and is dropped by the caller — no canon table needed here.
//
// Server-only: reads ESV_API_KEY and uses the service-role Supabase client.
// Never import from anything under src/.

import { supabaseAdmin } from './supabaseAdmin.js'
import { env } from './env.js'

// Required attribution for quoting the ESV (short form, for works quoting < 500
// verses). Surfaced in the app so the citation requirement is satisfied.
export const ESV_COPYRIGHT =
  'Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved.'

const ESV_ENDPOINT = 'https://api.esv.org/v3/passage/text/'

export interface ResolvedPassage {
  /** ESV's canonical reference, e.g. "Romans 8:28". */
  reference: string
  /** Verbatim ESV text, whitespace-normalized for inline display. */
  text: string
}

export interface ChapterVerse {
  n: number
  text: string
}

export interface ResolvedChapter {
  book: string
  chapter: number
  canonical: string
  verses: ChapterVerse[]
}

/** Cache key for a numbered chapter — never collides with a quote-blob `ref`. */
export function chapterCacheKey(book: string, chapter: number): string {
  return `${normalizeRef(`${book} ${chapter}`)}#chapter`
}

/**
 * Split Crossway numbered text (`[1] … [2] …`) into verses. Headings and
 * leftover preamble before the first marker are dropped.
 */
export function parseChapterVerses(raw: string): ChapterVerse[] {
  const parts = raw.split(/\[(\d+)\]/)
  const verses: ChapterVerse[] = []
  for (let i = 1; i < parts.length; i += 2) {
    const n = Number.parseInt(parts[i]!, 10)
    const text = (parts[i + 1] ?? '').replace(/\s+/g, ' ').trim()
    if (Number.isFinite(n) && n > 0 && text) verses.push({ n, text })
  }
  return verses
}

/** Normalize a reference into a stable cache key: lowercased, ws-collapsed. */
function normalizeRef(ref: string): string {
  return ref.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Collapse the API's headings/newlines into clean single-spaced inline prose. */
function cleanText(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim()
}

/**
 * Resolve one reference to verbatim ESV text. Returns null when the reference
 * doesn't resolve to a real passage (so the caller can drop it).
 */
export async function resolvePassage(rawRef: string): Promise<ResolvedPassage | null> {
  const ref = normalizeRef(rawRef)
  if (!ref) return null

  const sb = supabaseAdmin()

  // 1) Cache hit → serve locally.
  const { data: cached } = await sb
    .from('scripture_text')
    .select('canonical, text')
    .eq('ref', ref)
    .eq('translation', 'ESV')
    .maybeSingle()
  if (cached) return { reference: cached.canonical as string, text: cached.text as string }

  // 2) Miss → fetch verbatim text from Crossway, stripped to bare verse prose.
  const url = new URL(ESV_ENDPOINT)
  url.searchParams.set('q', rawRef)
  url.searchParams.set('include-passage-references', 'false')
  url.searchParams.set('include-verse-numbers', 'false')
  url.searchParams.set('include-first-verse-numbers', 'false')
  url.searchParams.set('include-footnotes', 'false')
  url.searchParams.set('include-headings', 'false')
  url.searchParams.set('include-short-copyright', 'false')
  url.searchParams.set('indent-paragraphs', '0')

  const res = await fetch(url, { headers: { Authorization: `Token ${env.esvApiKey()}` } })
  if (!res.ok) {
    console.error(`[esv] ${res.status} resolving "${rawRef}"`)
    return null
  }

  const data = (await res.json()) as { canonical?: string; passages?: string[] }
  const canonical = (data.canonical ?? '').trim()
  const passage = data.passages?.[0] ? cleanText(data.passages[0]) : ''
  // Empty canonical or no text → the reference wasn't real. Drop it.
  if (!canonical || !passage) return null

  // 3) Write through to the shared cache (idempotent on the PK). Non-fatal on error.
  const { error } = await sb
    .from('scripture_text')
    .upsert({ ref, translation: 'ESV', canonical, text: passage }, { onConflict: 'ref,translation' })
  if (error) console.error(`[esv] cache write failed for "${ref}": ${error.message}`)

  return { reference: canonical, text: passage }
}

/**
 * Resolve one chapter as numbered verses for the in-journal reader.
 * Cached separately from {@link resolvePassage} so quote blobs stay unnumbered.
 */
export async function resolveChapter(book: string, chapter: number): Promise<ResolvedChapter | null> {
  const name = book.trim()
  if (!name || !Number.isInteger(chapter) || chapter < 1 || chapter > 176) return null

  const query = `${name} ${chapter}`
  const ref = chapterCacheKey(name, chapter)
  const sb = supabaseAdmin()

  const { data: cached } = await sb
    .from('scripture_text')
    .select('canonical, text')
    .eq('ref', ref)
    .eq('translation', 'ESV')
    .maybeSingle()
  if (cached) {
    const verses = parseChapterVerses(cached.text as string)
    if (verses.length > 0) {
      return { book: name, chapter, canonical: cached.canonical as string, verses }
    }
  }

  const url = new URL(ESV_ENDPOINT)
  url.searchParams.set('q', query)
  url.searchParams.set('include-passage-references', 'false')
  url.searchParams.set('include-verse-numbers', 'true')
  url.searchParams.set('include-first-verse-numbers', 'true')
  url.searchParams.set('include-footnotes', 'false')
  url.searchParams.set('include-headings', 'false')
  url.searchParams.set('include-short-copyright', 'false')
  url.searchParams.set('indent-paragraphs', '0')

  const res = await fetch(url, { headers: { Authorization: `Token ${env.esvApiKey()}` } })
  if (!res.ok) {
    console.error(`[esv] ${res.status} resolving chapter "${query}"`)
    return null
  }

  const data = (await res.json()) as { canonical?: string; passages?: string[] }
  const canonical = (data.canonical ?? '').trim()
  const raw = (data.passages?.[0] ?? '').trim()
  const verses = parseChapterVerses(raw)
  if (!canonical || verses.length === 0) return null

  const { error } = await sb.from('scripture_text').upsert(
    { ref, translation: 'ESV', canonical, text: raw },
    { onConflict: 'ref,translation' },
  )
  if (error) console.error(`[esv] chapter cache write failed for "${ref}": ${error.message}`)

  return { book: name, chapter, canonical, verses }
}
