import emojiKeywords from 'emojilib'

export interface EmojiEntry {
  char: string
  /** Human-readable name derived from the primary keyword slug, e.g. "folded hands". */
  name: string
  keywords: string[]
}

export const ALL_EMOJI: EmojiEntry[] = Object.entries(emojiKeywords).map(([char, keywords]) => ({
  char,
  name: (keywords[0] ?? char).replace(/_/g, ' '),
  keywords,
}))

const BY_CHAR = new Map(ALL_EMOJI.map((e) => [e.char, e]))

/**
 * Hand-picked defaults shown before a search term narrows the grid — there's no
 * per-user "frequently used" history to draw from yet, so this is a small,
 * broadly useful starting set (moods, hands, light/nature, common marks).
 */
const DEFAULT_EMOJI_CHARS = [
  '😊', '😂', '🥲', '😢', '😍', '🙂', '😔', '😮',
  '🙏', '🙌', '👏', '❤️', '🔥', '✨', '💭', '💡',
  '🌅', '☀️', '🌧️', '🌿', '🕊️', '📖', '✅', '🎉',
]

export const DEFAULT_EMOJI: EmojiEntry[] = DEFAULT_EMOJI_CHARS.map((c) => BY_CHAR.get(c)).filter(
  (e): e is EmojiEntry => e != null,
)

/** Best (lowest) rank across an entry's keywords, or null if none match. */
function rank(entry: EmojiEntry, q: string): number | null {
  let best: number | null = null
  for (const k of entry.keywords) {
    const kw = k.toLowerCase()
    let score: number | null = null
    if (kw === q) score = 0
    else if (kw.startsWith(q)) score = 1
    else if (kw.includes(q)) score = 2
    if (score !== null && (best === null || score < best)) best = score
    if (best === 0) break
  }
  return best
}

/** Search by keyword — exact match, then prefix, then substring. Empty query returns the defaults. */
export function searchEmoji(query: string, limit = 48): EmojiEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return DEFAULT_EMOJI

  const scored: { entry: EmojiEntry; score: number }[] = []
  for (const entry of ALL_EMOJI) {
    const score = rank(entry, q)
    if (score !== null) scored.push({ entry, score })
  }
  scored.sort((a, b) => a.score - b.score)
  return scored.slice(0, limit).map((s) => s.entry)
}
