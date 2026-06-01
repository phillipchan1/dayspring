// POST /api/spiritual/scripture
// Authenticated via the user's Supabase JWT (Authorization: Bearer <token>).
// Returns 3 ESV passages relevant to the submitted journal content or topic.

import { supabaseAdmin } from '../_lib/supabaseAdmin.js'
import { callModel } from '../_lib/openai.js'
import { corsHeaders, preflight, withCors } from '../_lib/cors.js'

const SCHEMA = {
  type: 'object',
  properties: {
    passages: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          reference: { type: 'string', maxLength: 48 },
          text: { type: 'string', maxLength: 160 },
          reason: { type: 'string', maxLength: 120 },
        },
        required: ['reference', 'text', 'reason'],
        additionalProperties: false,
      },
      minItems: 3,
      maxItems: 3,
    },
  },
  required: ['passages'],
  additionalProperties: false,
}

function buildSystem(translation: string): string {
  return `You are a scripture companion for a private Christian journaling app.
Given the user's journal entry text or topic, return exactly 3 relevant Bible passages from the ${translation} translation.

For each passage provide:
- reference: book, chapter, and verse range (e.g. "Psalm 23:1-4" or "Romans 8:28")
- text: one ${translation} verse only, quoted verbatim, under 25 words
- reason: one short sentence (under 15 words) on why it fits

Keep the full JSON compact. Choose verses that feel like a gentle companion — comfort, perspective, or quiet truth — not a sermon.`
}

interface ScriptureResult {
  passages: Array<{ reference: string; text: string; reason: string }>
}

export async function OPTIONS(req: Request): Promise<Response> {
  return preflight(req) ?? new Response(null, { status: 204, headers: corsHeaders(req) })
}

export async function POST(req: Request): Promise<Response> {
  const header = req.headers.get('authorization') ?? ''
  const jwt = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!jwt) return withCors(req, Response.json({ error: 'unauthorized' }, { status: 401 }))

  const sb = supabaseAdmin()
  const {
    data: { user },
    error: authError,
  } = await sb.auth.getUser(jwt)
  if (authError || !user) return withCors(req, Response.json({ error: 'unauthorized' }, { status: 401 }))

  let body: { content?: string; translation?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return withCors(req, Response.json({ error: 'invalid JSON body' }, { status: 400 }))
  }

  const content = (body.content ?? '').trim()
  if (!content) return withCors(req, Response.json({ error: 'content is required' }, { status: 400 }))

  const VALID_TRANSLATIONS = new Set(['ESV', 'NIV', 'NLT', 'KJV', 'NASB'])
  const rawTranslation = (body.translation ?? 'ESV').trim().toUpperCase()
  const translation = VALID_TRANSLATIONS.has(rawTranslation) ? rawTranslation : 'ESV'

  try {
    const result = await callModel<ScriptureResult>(
      buildSystem(translation),
      { content },
      SCHEMA,
      'scripture_passages',
      'none',
      8192,
    )
    return withCors(req, Response.json(result))
  } catch (e) {
    return withCors(req, Response.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 }))
  }
}
