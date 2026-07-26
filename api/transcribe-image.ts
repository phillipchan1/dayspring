import OpenAI from 'openai'
import { getAuthedUser, notAuthenticated } from './_lib/userAuth.js'
import { preflight, withCors } from './_lib/cors.js'
import { env } from './_lib/env.js'
import { concordanceVocab } from './_lib/dictationPrompt.js'

// Handwriting transcription for scanned journal pages. The client photographs one
// or more pages of a physical entry and POSTs them as multipart/form-data; we relay
// the images to OpenAI's vision model — biased toward the writer's Concordance so
// their own names and spellings come through — and return a faithful markdown
// transcription. The result is always a *draft* the writer reviews; we transcribe,
// we never rewrite. The API key never touches the client.

let client: OpenAI | null = null
function openai(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: env.openaiKey(), maxRetries: 4, timeout: 120_000 })
  return client
}

// Cap each page so a runaway upload can't pin a serverless function. A phone photo
// of a page sits comfortably under this; we also bound the page count.
const MAX_BYTES = 12 * 1024 * 1024
const MAX_PAGES = 8

// The transcription discipline. Mirrors the voice-cleanup ethos: this is a personal,
// often spiritual journal, so faithfulness to the writer's exact words beats polish.
// The vision model READS the page; it must not improve, summarize, or invent.
const SYSTEM = `You transcribe a photographed handwritten journal entry into plain text. The writer wrote it by hand and wants a faithful digital copy.

Rules:
- Reproduce exactly what is written, word for word. Keep their wording, their grammar, their misspellings, their raw and unpolished voice. Do NOT paraphrase, summarize, correct, reorder, or "improve" anything.
- Preserve paragraph breaks and line breaks as the page shows them. Use a blank line between paragraphs.
- Keep scripture references exactly as written (e.g. "Psalm 23:1", "Rom 8:28"). Do not expand abbreviations or look anything up.
- Output plain Markdown text only — no commentary, no headings you invented, no "Page 1" labels.
- If a word is genuinely illegible and context does not make it obvious, write [?] in its place rather than guessing a word that changes the meaning. Use this sparingly.
- If multiple page images are given, they are consecutive pages of ONE continuous entry — transcribe them in order as a single flowing entry, not separate sections.

Return only the transcription.`

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

  // Pages arrive as repeated `page` fields, in capture order.
  const pages = form.getAll('page').filter((p): p is File => p instanceof File)
  if (pages.length === 0) {
    return withCors(req, Response.json({ error: 'at least one page image is required' }, { status: 400 }))
  }
  if (pages.length > MAX_PAGES) {
    return withCors(req, Response.json({ error: `too many pages (max ${MAX_PAGES})` }, { status: 413 }))
  }
  for (const p of pages) {
    if (p.size === 0) {
      return withCors(req, Response.json({ error: 'empty page image' }, { status: 400 }))
    }
    if (p.size > MAX_BYTES) {
      return withCors(req, Response.json({ error: 'page image too large' }, { status: 413 }))
    }
    if (!p.type.startsWith('image/')) {
      return withCors(req, Response.json({ error: 'pages must be images' }, { status: 400 }))
    }
  }

  // Vocabulary biasing: the writer's Concordance (server-side, private), plus any
  // caller-supplied terms — the same personalization moat voice dictation uses, so
  // their own names and spellings survive the handwriting read.
  const clientVocab = form.get('vocab')
  let terms = await concordanceVocab(user.id)
  if (typeof clientVocab === 'string' && clientVocab.trim()) {
    terms = terms.concat(clientVocab.split(',').map((t) => t.trim()).filter(Boolean))
  }
  const vocabLine = terms.length
    ? `\n\nNames and terms the writer often uses (prefer these spellings): ${terms.slice(0, 60).join(', ')}.`
    : ''

  // Encode each page as a data URL, in order. Buffer is available in the Vercel
  // Node runtime; base64 keeps it a single self-contained request (no storage round-trip).
  const imageParts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = []
  for (const p of pages) {
    const b64 = Buffer.from(await p.arrayBuffer()).toString('base64')
    imageParts.push({
      type: 'image_url',
      image_url: { url: `data:${p.type};base64,${b64}`, detail: 'high' },
    })
  }

  try {
    const completion = await openai().chat.completions.create({
      model: env.visionModel(),
      max_tokens: 4096,
      messages: [
        { role: 'system', content: SYSTEM + vocabLine },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                pages.length > 1
                  ? `Transcribe these ${pages.length} consecutive pages as one continuous journal entry.`
                  : 'Transcribe this journal page.',
            },
            ...imageParts,
          ],
        },
      ],
    })
    // The vision model is the most expensive call in the app (a full model, high
    // detail, up to 8 page images). Log the token cost per scan so a page-scan
    // habit is visible in the bill rather than buried in the dashboard total.
    console.log(
      `[tokens] name=scan_pages model=${env.visionModel()} pages=${pages.length} ` +
        `in=${completion.usage?.prompt_tokens ?? 0} out=${completion.usage?.completion_tokens ?? 0}`,
    )
    const text = (completion.choices[0]?.message?.content ?? '').trim()
    if (!text) {
      return withCors(req, Response.json({ error: 'no text found' }, { status: 422 }))
    }
    // `raw` mirrors `text` for now (the vision read is already the verbatim copy);
    // kept in the response shape for parity with /api/transcribe and future use.
    return withCors(req, Response.json({ text, raw: text, pages: pages.length }))
  } catch (e) {
    console.error('image transcription failed:', e)
    return withCors(
      req,
      Response.json(
        { error: e instanceof Error ? e.message : 'transcription failed' },
        { status: 502 },
      ),
    )
  }
}
