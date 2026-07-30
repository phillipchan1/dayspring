import OpenAI from 'openai'
import { getAuthedUser, notAuthenticated } from './_lib/userAuth.js'
import { preflight, withCors } from './_lib/cors.js'
import { env } from './_lib/env.js'
import { buildDictationPrompt } from './_lib/dictationPrompt.js'
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
  const clientVocab = form.get('vocab')
  const prompt = await buildDictationPrompt(
    user.id,
    typeof clientVocab === 'string' ? clientVocab : null,
  )

  // Caller can opt out of tidying (e.g. a future "raw dictation" setting).
  const tidy = form.get('tidy') !== 'false'

  // Audio is billed by DURATION, not tokens, so it never shows up in the
  // [tokens] lines. Log the clip size — paired with the [realtime] session lines,
  // this is what tells you how much of the bill is dictation vs synthesis.
  console.log(
    `[audio] name=transcribe_clip model=${env.transcribeModel()} bytes=${audio.size} tidy=${tidy}`,
  )

  // Progressive streaming: relay the transcription deltas as Server-Sent Events
  // so the sheet fills in live, then run the cleanup pass and emit a `final`
  // event with the tidied text. No websockets — the audio is already recorded;
  // we just stream the *result*. Falls back to the one-shot JSON path below.
  if (form.get('stream') === 'true') {
    const encoder = new TextEncoder()
    const sse = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: string, data: unknown) =>
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        try {
          const events = await openai().audio.transcriptions.create({
            file: audio,
            model: env.transcribeModel(),
            prompt,
            stream: true,
          })
          let full = ''
          for await (const ev of events) {
            if (ev.type === 'transcript.text.delta') {
              full += ev.delta
              send('delta', { delta: ev.delta })
            } else if (ev.type === 'transcript.text.done') {
              full = ev.text // authoritative full transcript
            }
          }
          const rawText = full.trim()
          const text = tidy ? await tidyDictation(rawText) : rawText
          send('final', { text, raw: rawText })
        } catch (e) {
          console.error('streaming transcription failed:', e)
          send('error', { error: e instanceof Error ? e.message : 'transcription failed' })
        } finally {
          controller.close()
        }
      },
    })
    return withCors(
      req,
      new Response(sse, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
        },
      }),
    )
  }

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
