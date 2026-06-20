import OpenAI from 'openai'
import { getAuthedUser, notAuthenticated } from './_lib/userAuth.js'
import { preflight, withCors } from './_lib/cors.js'
import { env } from './_lib/env.js'
import { getConcordanceForRender } from './_lib/concordance.js'
import { callModel } from './_lib/openai.js'

// Speech-to-text for voice dictation. The client records a short audio clip
// (webm/mp4) and POSTs it as multipart/form-data; we relay it to OpenAI's
// transcription model, lightly tidy the result, and return it. The API key never
// touches the client. The response carries both `text` (tidied) and `raw` (the
// verbatim transcript) so the UI can offer "show original" later.

let client: OpenAI | null = null
function openai(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: env.openaiKey(), maxRetries: 4, timeout: 60_000 })
  return client
}

// Cap uploads so a runaway recording can't pin a serverless function. ~10 min of
// Opus audio sits comfortably under this.
const MAX_BYTES = 25 * 1024 * 1024

// A gentle bias toward the vocabulary this app lives in — proper-cased book names,
// reverent phrasing — so "habakuk three" lands as "Habakkuk 3".
const BASE_PROMPT =
  'A personal spiritual journal entry. Expect scripture references (e.g. Habakkuk 3, ' +
  'Romans 8:28, Psalm 23), prayer, and reflection. Use sentence case and natural punctuation.'

// The personalization moat: bias transcription toward the writer's own proper
// nouns and spellings from their Concordance (the dark per-user fidelity record),
// most-used first, so dictation spells their people/places/terms right. The
// transcription `prompt` is token-bounded, so cap it. Fail-open: any error (incl.
// the table being empty for a cold-start user) → just the base prompt.
const MAX_VOCAB_TERMS = 60
// Drop one-off captures: a term seen in a single entry is usually extraction
// noise ("the world is flat"), while a name worth biasing recurs. As the
// Concordance fills, the most-used terms dominate the top-60 anyway.
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

// ── Light cleanup pass ───────────────────────────────────────────────────────
// Spoken prose is full of disfluencies and runs on without paragraphs. A cheap
// nano-model pass tidies it — but LIGHTLY: this is a personal, often spiritual
// journal, so we preserve the writer's exact words and voice and only remove
// filler and add paragraph breaks. Never paraphrase, summarize, or reorder.
const CLEANUP_SYSTEM = `You lightly tidy a voice-dictated journal entry. The writer spoke it aloud and it was transcribed verbatim.

Make ONLY these edits:
1. Remove speech disfluencies — filler words (um, uh, er, like, "you know", "I mean"), false starts, and accidental immediate word repetitions.
2. Insert paragraph breaks (a blank line) where the thought clearly shifts.

Do NOT paraphrase, summarize, reword, reorder, "improve", fix grammar, or change the writer's meaning, tone, or voice. Keep every real word they said. This is a personal, often spiritual journal — faithfulness to their exact words matters far more than polish. If the text is already clean, return it essentially unchanged.

Return JSON {"cleaned": "<the tidied text>"}.`

const CLEANUP_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['cleaned'],
  properties: { cleaned: { type: 'string' } },
} as const

async function tidyDictation(raw: string): Promise<string> {
  // Too short to benefit — skip the latency and the over-edit risk.
  if (raw.length < 100) return raw
  try {
    const { cleaned } = await callModel<{ cleaned: string }>(
      CLEANUP_SYSTEM,
      raw,
      CLEANUP_SCHEMA,
      'dictation_cleanup',
      'low',
      4096,
    )
    const out = cleaned.trim()
    // Fidelity guard: if the model dropped too much (truncation or over-editing),
    // discard it and keep the verbatim transcript. Disfluency removal trims a
    // little; losing half the words means something went wrong.
    if (!out || out.length < raw.length * 0.5) return raw
    return out
  } catch {
    return raw // fail-open — a cleanup failure must never lose the transcript
  }
}

export async function OPTIONS(req: Request): Promise<Response> {
  return preflight(req) ?? new Response(null, { status: 405 })
}

export async function POST(req: Request): Promise<Response> {
  const flight = preflight(req)
  if (flight) return flight

  const user = await getAuthedUser(req)
  if (!user) return notAuthenticated()

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return withCors(req, Response.json({ error: 'expected multipart/form-data' }, { status: 400 }))
  }

  const audio = form.get('audio')
  if (!(audio instanceof File)) {
    return withCors(req, Response.json({ error: 'audio file is required' }, { status: 400 }))
  }
  if (audio.size === 0) {
    return withCors(req, Response.json({ error: 'empty audio' }, { status: 400 }))
  }
  if (audio.size > MAX_BYTES) {
    return withCors(req, Response.json({ error: 'audio too large' }, { status: 413 }))
  }

  // Vocabulary biasing: the writer's Concordance (server-side, private), plus any
  // caller-supplied terms as a supplement.
  const terms = await concordanceVocab(user.id)
  const clientVocab = form.get('vocab')
  if (typeof clientVocab === 'string' && clientVocab.trim()) {
    terms.push(...clientVocab.split(',').map((t) => t.trim()).filter(Boolean))
  }
  const prompt = terms.length
    ? `${BASE_PROMPT} Names and terms the writer often uses: ${terms.slice(0, MAX_VOCAB_TERMS).join(', ')}.`
    : BASE_PROMPT

  // Caller can opt out of tidying (e.g. a future "raw dictation" setting).
  const tidy = form.get('tidy') !== 'false'

  try {
    const result = await openai().audio.transcriptions.create({
      file: audio,
      model: env.transcribeModel(),
      prompt,
      response_format: 'json',
    })
    const raw = result.text.trim()
    const text = tidy ? await tidyDictation(raw) : raw
    return withCors(req, Response.json({ text, raw }))
  } catch (e) {
    console.error('transcription failed:', e)
    return withCors(
      req,
      Response.json(
        { error: e instanceof Error ? e.message : 'transcription failed' },
        { status: 502 },
      ),
    )
  }
}
