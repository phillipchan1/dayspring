/**
 * THE REFRAIN, CHECKED AGAINST THE PAGE — grounded, or silent.
 *
 * The yearly rollup verified its refrain as an exact substring of the entry
 * body on the day it was built. That is not the same as the line being on the
 * page the reader opens today: the entry may since have been edited, deleted
 * (the Diarly twins went on Aug 27 2026), or the words may sit somewhere the
 * page never shows — a fence, a token, an imported footer. A line set large at
 * the top of the year that the writer can't find on its page reads as
 * fabricated, and to them it is.
 *
 * So before the Summit shows it, the words must appear in the page's VISIBLE
 * text, now. If they don't, the refrain is dropped — no replacement, no
 * paraphrase.
 */

import { entryContentLines } from '@/lib/entryLabels'
import { writerWords } from '@/lib/writerWords'
import { getEntryById } from '@/lib/entries'
import { cacheGet } from '@/lib/db'
import { stripMarkdownMarkers } from '@/lib/inlineMarkers'
import type { WordsData } from './types'

function norm(s: string): string {
  return s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim()
}

/** True when `text` is on the page as the writer reads it, in her own words —
 *  a refrain is shown as hers, so a verse she quoted never counts (Guardrail H3). */
export function isOnPage(text: string, body: string): boolean {
  const visible = norm(entryContentLines(writerWords(body)).map(stripMarkdownMarkers).join(' '))
  const needle = norm(text)
  return needle.length > 0 && visible.includes(needle)
}

/** The year's words with the refrain kept only if it is really on its page. */
export async function withCheckedRefrain(words: WordsData | null): Promise<WordsData | null> {
  const refrain = words?.moments?.[0]
  if (!words || !refrain) return words
  let body: string | undefined
  try {
    body = (await cacheGet(refrain.entryId))?.body_markdown
    if (body === undefined) body = (await getEntryById(refrain.entryId))?.body_markdown
  } catch {
    body = undefined
  }
  if (body !== undefined && isOnPage(refrain.text, body)) return words
  console.warn('[summit] refrain not found on its page — hidden', refrain.entryId)
  return null
}
