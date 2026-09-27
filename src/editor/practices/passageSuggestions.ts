/**
 * Good places to begin — a short, hand-chosen shelf of passages people have
 * prayed with for centuries, each a good length for the ritual it is offered to.
 *
 * What this is NOT: a reading plan (VISION: Dayspring is downstream of
 * reading), and not anything inferred from the writer. It knows nothing about
 * them. It is the same for everyone, like the library's practices, and it only
 * offers — the finder, the canon and "passages you return to" are all still
 * there. Phil asked for it on 2026-09-26: the pleasure of picking something good
 * and reflecting on it, without having to know where to look.
 *
 * Titles are our plain descriptions, never the verse text (Guardrail H3: verse
 * text comes from the ESV or the writer, never from us). Themes name what the
 * passage is about, not what the writer is going through — "Fear", not "for
 * when you are afraid" (Principle 6: their words, their theology).
 */
import type { PassageRef } from './passage'

export type SuggestionTheme =
  | 'Rest'
  | 'Fear'
  | 'Being known'
  | 'Waiting'
  | 'Grief'
  | 'Joy'
  | 'Direction'
  | 'Calling'
  | 'Forgiveness'
  | 'Love'

export const SUGGESTION_THEMES: readonly SuggestionTheme[] = [
  'Rest',
  'Fear',
  'Being known',
  'Waiting',
  'Grief',
  'Joy',
  'Direction',
  'Calling',
  'Forgiveness',
  'Love',
]

export interface Suggestion {
  ref: PassageRef
  title: string
  themes: SuggestionTheme[]
  /** A few verses to sit with, or one whole story to tell back. */
  kind: 'short' | 'story'
}

const s = (
  book: string,
  chapter: number,
  from: number | null,
  to: number | null,
  title: string,
  themes: SuggestionTheme[],
  kind: 'short' | 'story' = 'short',
): Suggestion => ({ ref: { book, chapter, from, to }, title, themes, kind })

export const SUGGESTIONS: readonly Suggestion[] = [
  // A few verses to sit with.
  s('Matthew', 11, 28, 30, 'Come to me, all who are weary', ['Rest']),
  s('Psalms', 23, null, null, 'The shepherd', ['Rest', 'Fear']),
  s('Psalms', 46, null, null, 'Be still, and know', ['Fear', 'Rest']),
  s('Psalms', 131, null, null, 'A quieted soul', ['Rest']),
  s('Psalms', 139, 1, 12, 'You have searched me and known me', ['Being known']),
  s('Psalms', 62, 1, 8, 'My soul waits in silence', ['Waiting', 'Rest']),
  s('Psalms', 27, 1, 5, 'Whom shall I fear?', ['Fear']),
  s('Psalms', 42, null, null, 'As a deer longs for water', ['Grief', 'Waiting']),
  s('Psalms', 16, 5, 11, 'The path of life', ['Joy', 'Direction']),
  s('Psalms', 103, 1, 5, 'Do not forget his benefits', ['Joy']),
  s('Psalms', 51, 10, 12, 'A clean heart', ['Forgiveness']),
  s('Isaiah', 40, 28, 31, 'They will run and not grow weary', ['Waiting', 'Rest']),
  s('Isaiah', 43, 1, 3, 'I have called you by name', ['Being known', 'Fear']),
  s('Isaiah', 55, 1, 3, 'Come, all who are thirsty', ['Rest', 'Love']),
  s('Isaiah', 30, 15, 15, 'In returning and rest', ['Rest']),
  s('Lamentations', 3, 22, 24, 'New every morning', ['Grief', 'Waiting']),
  s('Zephaniah', 3, 17, 17, 'He rejoices over you with singing', ['Love', 'Joy']),
  s('Habakkuk', 3, 17, 19, 'Though the fig tree does not blossom', ['Grief', 'Joy']),
  s('Micah', 6, 8, 8, 'What the Lord requires', ['Direction']),
  s('Proverbs', 3, 5, 6, 'Trust, and he will make your paths straight', ['Direction']),
  s('Ecclesiastes', 3, 1, 8, 'A time for everything', ['Waiting', 'Grief']),
  s('Matthew', 6, 25, 34, 'Do not worry about tomorrow', ['Fear', 'Rest']),
  s('John', 15, 1, 11, 'The vine and the branches', ['Rest', 'Love']),
  s('Romans', 8, 31, 39, 'Nothing can separate us', ['Love', 'Fear']),
  s('Romans', 12, 1, 2, 'Be transformed', ['Direction', 'Calling']),
  s('2 Corinthians', 12, 7, 10, 'My grace is sufficient', ['Grief']),
  s('Ephesians', 3, 14, 21, 'To know a love that surpasses knowledge', ['Love']),
  s('Philippians', 4, 4, 9, 'The peace that guards your heart', ['Fear', 'Joy']),
  s('Philippians', 2, 5, 11, 'He emptied himself', ['Calling', 'Love']),
  s('Colossians', 3, 12, 17, 'Clothe yourselves with compassion', ['Love', 'Forgiveness']),
  s('Hebrews', 12, 1, 3, 'Run with endurance', ['Waiting', 'Calling']),
  s('James', 1, 2, 5, 'When trials come', ['Grief', 'Direction']),
  s('1 Peter', 5, 6, 7, 'Cast your cares on him', ['Fear', 'Rest']),
  s('1 John', 4, 7, 19, 'God is love', ['Love']),
  s('1 Kings', 19, 11, 13, 'A still, small voice', ['Calling', 'Rest']),

  // One whole story to tell back.
  s('Mark', 4, 35, 41, 'The storm on the lake', ['Fear'], 'story'),
  s('Luke', 15, 11, 32, 'The father and his two sons', ['Forgiveness', 'Love'], 'story'),
  s('Luke', 10, 38, 42, 'Mary and Martha', ['Rest'], 'story'),
  s('John', 4, 5, 26, 'The woman at the well', ['Being known'], 'story'),
  s('Mark', 10, 46, 52, 'Blind Bartimaeus', ['Being known', 'Calling'], 'story'),
  s('Matthew', 14, 22, 33, 'Walking on the water', ['Fear'], 'story'),
  s('John', 21, 15, 19, 'Do you love me?', ['Forgiveness', 'Calling'], 'story'),
  s('Luke', 24, 13, 35, 'The road to Emmaus', ['Grief', 'Being known'], 'story'),
  s('Genesis', 32, 22, 31, 'Jacob wrestles until daybreak', ['Being known'], 'story'),
  s('Exodus', 3, 1, 6, 'The burning bush', ['Calling'], 'story'),
  s('1 Samuel', 3, 1, 10, 'Speak, for your servant is listening', ['Calling'], 'story'),
  s('John', 11, 32, 44, 'Jesus weeps at the tomb', ['Grief'], 'story'),
  s('Luke', 5, 1, 11, 'Put out into deep water', ['Calling'], 'story'),
  s('Luke', 7, 36, 50, 'The woman who anointed his feet', ['Forgiveness', 'Love'], 'story'),
  s('Mark', 5, 25, 34, 'The woman who touched his cloak', ['Being known'], 'story'),
  s('Luke', 19, 1, 10, 'Zacchaeus', ['Being known', 'Forgiveness'], 'story'),
  s('John', 13, 1, 15, 'He washed their feet', ['Love', 'Calling'], 'story'),
  s('Luke', 18, 9, 14, 'Two men praying', ['Forgiveness'], 'story'),
  s('Matthew', 20, 1, 16, 'The workers in the vineyard', ['Love'], 'story'),
  s('Ruth', 1, 15, 18, 'Where you go, I will go', ['Love', 'Grief'], 'story'),
  s('1 Kings', 19, 3, 8, 'Elijah under the broom tree', ['Rest', 'Grief'], 'story'),
]

/**
 * What to offer, for a practice's size, under a theme (or all of them): a few
 * at a time, turning each day, and a turn further each time the writer asks
 * for others. The same for everyone on the same day.
 */
export function suggestionsFor(
  size: 'few' | 'story' | 'any',
  theme: SuggestionTheme | null,
  turn: number,
  count = 6,
  today: Date = new Date(),
): Suggestion[] {
  const pool = SUGGESTIONS.filter(
    (x) =>
      (size === 'any' || (size === 'story' ? x.kind === 'story' : x.kind === 'short')) &&
      (theme === null || x.themes.includes(theme)),
  )
  if (pool.length <= count) return pool
  const day = Math.floor(today.getTime() / 86_400_000)
  const start = ((day * 7 + turn * count) % pool.length + pool.length) % pool.length
  return Array.from({ length: count }, (_, k) => pool[(start + k) % pool.length]!)
}
