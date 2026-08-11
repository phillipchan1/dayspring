// Find or Ask — guessed from what was typed, never a mode the writer has to set.
//
// The rule the guess encodes: you FIND a word, you ASK a question. A noun phrase
// ("NQ", "Esther", "prop account") is a lookup. A sentence with a verb in it
// ("have I ever felt this before") is a question about a life.
//
// The guess is always overridable — the palette's verb button toggles it and
// locks until the query changes. Being wrong is cheap; trapping someone in the
// wrong mode is not.

export type Verb = 'find' | 'ask'

/**
 * Words that turn a phrase into a question about oneself. Deliberately narrow:
 * a false ASK costs a model call and a two-second wait, so the bar is a real
 * interrogative or a first-person verb, not merely a long query.
 */
const ASK_WORDS =
  /\b(have|has|had|did|do|does|when|what|why|how|who|where|was|were|am|ever|feel|feeling|felt|think|thought|talk|talked|say|said|pray|praying|prayed|write|wrote|remember|struggle|struggled|start|started|stop|stopped|first|last|about|tell|show|find)\b/i

/** Long enough that it can't be a name or a term. */
const LONG_QUERY_WORDS = 5

export function guessVerb(query: string): Verb {
  const q = query.trim()
  if (!q) return 'find'
  if (q.endsWith('?')) return 'ask'

  const words = q.split(/\s+/)
  if (words.length >= LONG_QUERY_WORDS) return 'ask'
  if (words.length >= 2 && ASK_WORDS.test(q)) return 'ask'
  return 'find'
}

/**
 * Whether a query with no literal matches should flip itself to ASK. This is the
 * moment the feature explains itself: keyword search failing is exactly when
 * searching by meaning is worth offering, and it needs no tooltip to land.
 * A single word is excluded — a typo shouldn't cost a model call.
 */
export function shouldOfferAsk(query: string): boolean {
  const q = query.trim()
  if (q.length < 3) return false
  return q.split(/\s+/).length >= 2
}
