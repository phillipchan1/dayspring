import { getConcordanceForRender } from './concordance.js'

// The vocabulary-biasing prompt shared by both dictation transcription paths:
// the one-shot/streamed clip endpoint (api/transcribe.ts) and the realtime live
// caption session (api/realtime-token.ts). Keeping it in one place means the
// live captions and the authoritative final pass bias toward the same words.

// A gentle bias toward the vocabulary this app lives in — proper-cased book names,
// reverent phrasing — so "habakuk three" lands as "Habakkuk 3".
export const BASE_PROMPT =
  'A personal spiritual journal entry. Expect scripture references (e.g. Habakkuk 3, ' +
  'Romans 8:28, Psalm 23), prayer, and reflection. Use sentence case and natural punctuation.'

// The transcription `prompt` is token-bounded, so cap the vocabulary we inject.
const MAX_VOCAB_TERMS = 60
// Drop one-off captures: a term seen in a single entry is usually extraction
// noise ("the world is flat"), while a name worth biasing recurs.
const MIN_OCCURRENCES = 2

// Title-case all-lowercase words so a name captured mid-sentence ("esther")
// biases toward its proper rendering ("Esther"). Words that already contain a
// capital — acronyms (IHOP, KC, HS) and mixed-case names — are left untouched.
function normalizeTerm(s: string): string {
  return s
    .split(' ')
    .map((w) => (w && !/[A-Z]/.test(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ')
}

// The personalization moat: bias transcription toward the writer's own proper
// nouns and spellings from their Concordance (the dark per-user fidelity record),
// most-used first. Fail-open: any error (incl. an empty table for a cold-start
// user) → just the base prompt.
async function concordanceVocab(owner: string): Promise<string[]> {
  try {
    const rows = await getConcordanceForRender(owner) // ordered by occurrence desc
    // Dedup canonical case-insensitively: the extractor classifies the same name
    // under multiple kinds ("God" as person + org + term), so a raw map would
    // burn the term budget on repeats. Most-used spelling wins (rows are sorted).
    const seen = new Set<string>()
    const terms: string[] = []
    for (const r of rows) {
      if (r.occurrence_count < MIN_OCCURRENCES) continue
      const key = r.canonical.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      terms.push(normalizeTerm(r.canonical))
      if (terms.length >= MAX_VOCAB_TERMS) break
    }
    return terms
  } catch {
    return []
  }
}

/**
 * Build the transcription prompt for a writer: the base spiritual-journal bias
 * plus their Concordance vocabulary, with any caller-supplied terms appended.
 */
export async function buildDictationPrompt(
  owner: string,
  clientVocab?: string | null,
): Promise<string> {
  const terms = await concordanceVocab(owner)
  if (typeof clientVocab === 'string' && clientVocab.trim()) {
    terms.push(...clientVocab.split(',').map((t) => t.trim()).filter(Boolean))
  }
  return terms.length
    ? `${BASE_PROMPT} Names and terms the writer often uses: ${terms.slice(0, MAX_VOCAB_TERMS).join(', ')}.`
    : BASE_PROMPT
}
