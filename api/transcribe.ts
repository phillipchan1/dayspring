import OpenAI from 'openai'
import { getAuthedUser, notAuthenticated } from './_lib/userAuth.js'
import { preflight, withCors } from './_lib/cors.js'
import { env } from './_lib/env.js'
import { getConcordanceForRender } from './_lib/concordance.js'

// Speech-to-text for voice dictation. The client records a short audio clip
// (webm/mp4) and POSTs it as multipart/form-data; we relay it to OpenAI's
// transcription model and return the text. The API key never touches the client.

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
async function concordanceVocab(owner: string): Promise<string[]> {
  try {
    const rows = await getConcordanceForRender(owner) // ordered by occurrence desc
    // Dedup canonical case-insensitively: the extractor classifies the same name
    // under multiple kinds ("God" as person + org + term), so a raw map would
    // burn the term budget on repeats. Most-used spelling wins (rows are sorted).
    const seen = new Set<string>()
    const terms: string[] = []
    for (const r of rows) {
      const key = r.canonical.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      terms.push(r.canonical)
      if (terms.length >= MAX_VOCAB_TERMS) break
    }
    return terms
  } catch {
    return []
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

  try {
    const result = await openai().audio.transcriptions.create({
      file: audio,
      model: env.transcribeModel(),
      prompt,
      response_format: 'json',
    })
    return withCors(req, Response.json({ text: result.text.trim() }))
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
