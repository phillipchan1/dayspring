import OpenAI from 'openai'
import { getAuthedUser, notAuthenticated } from './_lib/userAuth.js'
import { preflight, withCors } from './_lib/cors.js'
import { env } from './_lib/env.js'
import { buildDictationPrompt } from './_lib/dictationPrompt.js'

// Mints a short-lived ephemeral client secret for an OpenAI Realtime
// *transcription* session, so the browser can stream microphone audio straight
// to OpenAI and receive live transcript deltas as the user speaks — the "it's
// hearing me right now" signal. The real API key never reaches the client; the
// secret is scoped to a transcription session and expires in seconds.
//
// This is purely the live-caption feel. The authoritative transcript still comes
// from the full-clip pass in api/transcribe.ts once the user taps Done, so a
// flaky realtime connection never costs the user their words.

let client: OpenAI | null = null
function openai(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: env.openaiKey(), maxRetries: 2, timeout: 20_000 })
  return client
}

export async function OPTIONS(req: Request): Promise<Response> {
  return preflight(req) ?? new Response(null, { status: 405 })
}

export async function POST(req: Request): Promise<Response> {
  const flight = preflight(req)
  if (flight) return flight

  const user = await getAuthedUser(req)
  if (!user) return notAuthenticated()

  // Same vocabulary biasing as the final pass, so live captions and the
  // authoritative transcript spell the writer's people/places/terms alike.
  let vocab: string | null = null
  try {
    const body = (await req.json()) as { vocab?: unknown }
    if (typeof body?.vocab === 'string') vocab = body.vocab
  } catch {
    /* no body — fine, fall back to the Concordance-only prompt */
  }
  const prompt = await buildDictationPrompt(user.id, vocab)

  try {
    const secret = await openai().realtime.clientSecrets.create({
      // Keep the window tight — it only needs to live long enough to open the
      // socket. The session itself continues after the secret expires.
      expires_after: { anchor: 'created_at', seconds: 60 },
      session: {
        type: 'transcription',
        audio: {
          input: {
            // PCM16 @ 24kHz mono — the only format realtime transcription accepts.
            format: { type: 'audio/pcm', rate: 24000 },
            transcription: { model: env.transcribeModel(), prompt, language: 'en' },
            // Let the server segment speech so we get committed transcript chunks.
            turn_detection: { type: 'server_vad' },
            noise_reduction: { type: 'near_field' },
          },
        },
      },
    })
    // Every minted secret is a live-caption session that will stream the WHOLE
    // recording to OpenAI — on top of the clip pass in api/transcribe.ts, which
    // transcribes the same audio again. One dictation therefore bills twice.
    // Count the sessions here so that duplication is visible, not assumed.
    console.log(`[realtime] name=live_captions model=${env.transcribeModel()} session=minted`)
    return withCors(req, Response.json({ value: secret.value, expiresAt: secret.expires_at }))
  } catch (e) {
    // Fail soft: the client treats any failure here as "no live captions" and
    // falls back to the recorded-clip transcription. Never block dictation.
    console.error('realtime token mint failed:', e)
    return withCors(
      req,
      Response.json(
        { error: e instanceof Error ? e.message : 'could not start live captions' },
        { status: 502 },
      ),
    )
  }
}
