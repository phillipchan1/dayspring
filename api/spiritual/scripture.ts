// POST /api/spiritual/scripture
// Authenticated via the user's Supabase JWT (Authorization: Bearer <token>).
//
// PHASE 1 of a two-step, progressive lookup. The model reads the journal content
// and picks relevant ESV references (book/chapter/verse) plus a one-line reason.
// It NEVER recites verse text — verbatim text is resolved separately (phase 2,
// /api/spiritual/scripture-resolve) so references can render the instant this
// returns while the text streams in behind them.
//
// The model returns 3-6 candidates (best-fit first) — more when many passages
// clearly fit, fewer when only a couple truly resonate.

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
          reason: { type: 'string', maxLength: 120 },
        },
        required: ['reference', 'reason'],
        additionalProperties: false,
      },
      minItems: 3,
      maxItems: 6,
    },
  },
  required: ['passages'],
  additionalProperties: false,
}

const SYSTEM = `You are a scripture companion for a private Christian journaling app.
Given the user's journal entry text or topic, pick 3-6 relevant Bible passages from the ESV, ordered best-fit first.

Return more passages (up to 6) when several clearly speak to the theme. Return fewer (as few as 3) when only a handful truly fit — don't pad with loose connections.

For each passage provide:
- reference: a precise ESV reference using the standard English book name, e.g. "Psalm 23:1-4" or "Romans 8:28". Chapter-and-verse only — never include verse text.
- reason: one short sentence (under 15 words) on why it fits.

Pick real, exact references you are confident exist. Choose verses that feel like a gentle companion — comfort, perspective, or quiet truth — not a sermon. Do NOT quote or paraphrase any verse text; return references only.`

interface RefResult {
  passages: Array<{ reference: string; reason: string }>
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

  let body: { content?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return withCors(req, Response.json({ error: 'invalid JSON body' }, { status: 400 }))
  }

  const content = (body.content ?? '').trim()
  if (!content) return withCors(req, Response.json({ error: 'content is required' }, { status: 400 }))

  try {
    const picked = await callModel<RefResult>(SYSTEM, { content }, SCHEMA, 'scripture_refs', 'none', 512)
    return withCors(req, Response.json({ passages: picked.passages }))
  } catch (e) {
    return withCors(req, Response.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 }))
  }
}
